-- Orders/payments schema skeleton (Phase 1 of the fully-functional-marketplace plan).
-- Tables only, no Stripe wiring yet -- landed now (rather than alongside checkout) so
-- Phase 4's auction close-out job can create an order for the winning bidder without a
-- circular dependency on checkout landing first.
--
-- Security model for every table below: all state-changing writes happen from Edge
-- Functions using the Supabase service role key (which bypasses RLS), never from the
-- browser. Client-side supabase-js therefore only ever needs SELECT, scoped to rows the
-- signed-in user is a party to. No INSERT/UPDATE/DELETE grants are given to
-- anon/authenticated on any table in this file.

-- 1. Buyer-facing order + one sub-order per seller (Stripe Connect destination charges
--    tie one PaymentIntent to exactly one connected account, so a mixed-seller cart is
--    modeled as one order with multiple order_seller_groups, not one PaymentIntent).

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'awaiting_payment'
    CHECK (status IN ('awaiting_payment', 'partially_paid', 'paid', 'cancelled')),
  currency text NOT NULL DEFAULT 'usd',
  shipping_address jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX orders_buyer_id ON public.orders (buyer_id);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_select_own
  ON public.orders FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid());

GRANT SELECT ON public.orders TO authenticated;

CREATE TABLE public.order_seller_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  subtotal_amount numeric(12,2) NOT NULL CHECK (subtotal_amount >= 0),
  application_fee_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (application_fee_amount >= 0),
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  stripe_payment_intent_id text UNIQUE,
  status text NOT NULL DEFAULT 'awaiting_payment'
    CHECK (status IN ('awaiting_payment', 'paid', 'failed', 'expired', 'cancelled', 'refunded')),
  reserved_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX order_seller_groups_order_id ON public.order_seller_groups (order_id);
CREATE INDEX order_seller_groups_seller_id ON public.order_seller_groups (seller_id);
CREATE INDEX order_seller_groups_awaiting_expiry
  ON public.order_seller_groups (reserved_until)
  WHERE status = 'awaiting_payment';

ALTER TABLE public.order_seller_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY order_seller_groups_select_party
  ON public.order_seller_groups FOR SELECT
  TO authenticated
  USING (
    seller_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_seller_groups.order_id AND o.buyer_id = auth.uid()
    )
  );

GRANT SELECT ON public.order_seller_groups TO authenticated;

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suborder_id uuid NOT NULL REFERENCES public.order_seller_groups(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity >= 1),
  unit_price_usd numeric(12,2) NOT NULL CHECK (unit_price_usd >= 0),
  -- Snapshot of title/image/condition at purchase time: protects order history if the
  -- listing is later edited, cancelled, or deleted.
  item_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'awaiting_payment'
    CHECK (status IN ('awaiting_payment', 'paid', 'failed', 'expired', 'cancelled', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX order_items_suborder_id ON public.order_items (suborder_id);
CREATE INDEX order_items_listing_id ON public.order_items (listing_id);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY order_items_select_party
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.order_seller_groups osg
      JOIN public.orders o ON o.id = osg.order_id
      WHERE osg.id = order_items.suborder_id
        AND (osg.seller_id = auth.uid() OR o.buyer_id = auth.uid())
    )
  );

GRANT SELECT ON public.order_items TO authenticated;

-- 2. Stripe webhook idempotency log. Purely internal -- no client access at all.

CREATE TABLE public.stripe_webhook_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies, no grants to anon/authenticated: only the service role (which bypasses
-- RLS) ever touches this table.

-- 3. Seller payout destination + buyer saved payment method.
--    Both are written ONLY by Edge Functions using the service role key -- no
--    INSERT/UPDATE/DELETE grant to authenticated on either table.

CREATE TABLE public.seller_payment_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id text UNIQUE,
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,
  onboarding_status text NOT NULL DEFAULT 'not_started',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_payment_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY seller_payment_accounts_select_own
  ON public.seller_payment_accounts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.seller_payment_accounts TO authenticated;

CREATE TABLE public.buyer_payment_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.buyer_payment_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY buyer_payment_profiles_select_own
  ON public.buyer_payment_profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.buyer_payment_profiles TO authenticated;
