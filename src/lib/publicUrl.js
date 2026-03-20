/**
 * URL for files copied from `public/` into dist root. Honors Vite `base` (GitHub Pages subpath).
 * @param {string} path - e.g. `rgc-logo.png` or `game-icons/pokemon.svg` (no leading slash)
 */
export function publicUrl(path) {
  const trimmed = path.replace(/^\/+/, '');
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? `${base}${trimmed}` : `${base}/${trimmed}`;
}
