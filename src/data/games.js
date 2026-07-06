// Static categories (DB is card-centric; only "Singles" is backed by get_marketplace_listings)
export const CATEGORIES = [
  { id: 'singles', name: 'Single Cards', slug: 'singles', description: 'Individual cards' },
  { id: 'sealed-boxes', name: 'Sealed Boxes', slug: 'sealed-boxes', description: 'Booster boxes & cases' },
  { id: 'sealed-packs', name: 'Sealed Packs', slug: 'sealed-packs', description: 'Booster packs' },
  { id: 'decks-kits', name: 'Decks & Kits', slug: 'decks-kits', description: 'Prebuilt decks, ETBs' },
  { id: 'complete-sets', name: 'Complete Sets', slug: 'complete-sets', description: 'Full sets' },
  { id: 'accessories', name: 'Supplies & Accessories', slug: 'accessories', description: 'Sleeves, binders, playmats' },
];

// Seller listing condition labels (matches marketplace_listings.condition_label, free text).
export const CONDITIONS = [
  'Near Mint',
  'Lightly Played',
  'Moderately Played',
  'Heavily Played',
  'Damaged',
];
