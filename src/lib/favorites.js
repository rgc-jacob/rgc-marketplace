const KEY = 'rgc-marketplace:favorite-listing-ids';

function bump() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rgc-favorites'));
  }
}

function readSet() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeSet(set) {
  localStorage.setItem(KEY, JSON.stringify([...set]));
}

export function isFavoriteListingId(listingId) {
  if (!listingId) return false;
  return readSet().has(listingId);
}

export function toggleFavoriteListingId(listingId) {
  if (!listingId) return false;
  const s = readSet();
  const next = !s.has(listingId);
  if (next) s.add(listingId);
  else s.delete(listingId);
  writeSet(s);
  bump();
  return next;
}

/** All locally-favorited listing ids (signed-out fallback storage). */
export function getAllFavoriteListingIds() {
  return [...readSet()];
}

/** Used after merging local favorites into the server watchlist on sign-in. */
export function clearAllFavorites() {
  writeSet(new Set());
  bump();
}
