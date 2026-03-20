ALTER TABLE public.marketplace_listings
  ADD CONSTRAINT marketplace_listings_card_id_fkey
  FOREIGN KEY (card_id) REFERENCES public.cards_v2(id) ON DELETE RESTRICT;
