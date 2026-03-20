/**
 * Build `/browse?…` with params merged into an existing query string (e.g. keep `game` when adding `q`).
 * Empty string values remove the key.
 * @param {string} [currentSearch] - `location.search` including leading `?` or not
 * @param {Record<string, string | number | null | undefined>} patch
 * @returns {string} path starting with `/browse`
 */
export function buildBrowsePath(currentSearch, patch) {
  const raw = typeof currentSearch === 'string' ? currentSearch.replace(/^\?/, '') : '';
  const sp = new URLSearchParams(raw);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === '') {
      sp.delete(key);
    } else {
      sp.set(key, String(value));
    }
  }
  const qs = sp.toString();
  return qs ? `/browse?${qs}` : '/browse';
}
