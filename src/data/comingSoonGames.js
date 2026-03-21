/**
 * Games whose full collectible catalog is not loaded in RGC yet.
 * `id` matches `games.id` and browse `?game=` / library game select values.
 */
export const COMING_SOON_LIBRARY_GAME_IDS = Object.freeze(['yugioh', 'starwarsunlimited']);

export function isComingSoonLibraryGame(gameIdOrSlug) {
  if (gameIdOrSlug == null || gameIdOrSlug === '') return false;
  return COMING_SOON_LIBRARY_GAME_IDS.includes(String(gameIdOrSlug));
}
