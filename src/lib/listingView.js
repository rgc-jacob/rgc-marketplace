/** How the user opened the card detail page — drives layout and primary actions. */
export const LISTING_VIEW = {
  marketplace: 'marketplace',
  collection: 'collection',
  library: 'library',
  trending: 'trending',
};

const VALID = new Set(Object.values(LISTING_VIEW));

/**
 * @param {URLSearchParams} searchParams
 * @returns {keyof typeof LISTING_VIEW}
 */
export function getListingViewFromSearch(searchParams) {
  const raw = searchParams.get('ctx') || searchParams.get('view');
  if (raw && VALID.has(raw)) return raw;
  return LISTING_VIEW.marketplace;
}

/**
 * @param {string} listingId - raw id (not encoded)
 * @param {string} [view]
 * @returns {string} path + optional query
 */
export function listingPath(listingId, view = LISTING_VIEW.marketplace) {
  const enc = encodeURIComponent(listingId);
  if (!view || view === LISTING_VIEW.marketplace) {
    return `/listing/${enc}`;
  }
  return `/listing/${enc}?ctx=${view}`;
}
