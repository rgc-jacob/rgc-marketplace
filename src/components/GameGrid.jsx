import { Link } from 'react-router-dom';

const GAME_ICONS = {
  pokemon: '/game-icons/pokemon-white.svg',
  magicthegathering: '/game-icons/mtg.svg',
  yugioh: '/game-icons/yugioh.svg',
  onepiece: '/game-icons/onepiece.svg',
  lorcana: '/game-icons/lorcana.svg',
  starwarsunlimited: '/game-icons/starwars.svg',
  riftbound: '/game-icons/riftbound.svg',
};

const GAME_ICON_STYLES = {
  pokemon: 'h-8 w-8 object-contain opacity-100',
  magicthegathering: 'h-9 w-9 object-contain opacity-100 brightness-0 invert',
  onepiece: 'h-10 w-10 object-contain opacity-100 brightness-0 invert',
  yugioh: 'h-8 w-12 object-contain opacity-100 contrast-125 drop-shadow-[0_0_1.2px_rgba(0,0,0,0.95)]',
  starwarsunlimited: 'h-5 w-11 object-contain opacity-100 brightness-0 invert contrast-200 drop-shadow-[0_0_0.6px_rgba(255,255,255,0.95)]',
};

/** Same card width at each breakpoint: 2 / 3 / 4 columns with gap-3 (0.75rem). */
const POD_WIDTH =
  'w-[calc((100%-0.75rem)/2)] max-w-[calc((100%-0.75rem)/2)] shrink-0 ' +
  'sm:w-[calc((100%-1.5rem)/3)] sm:max-w-[calc((100%-1.5rem)/3)] ' +
  'lg:w-[calc((100%-2.25rem)/4)] lg:max-w-[calc((100%-2.25rem)/4)]';

/** Shared vertical size so every pod matches height in a row and across the grid. */
const POD_HEIGHT = 'min-h-[5.75rem] sm:min-h-[4.75rem]';

export default function GameGrid({ games = [], loading = false }) {
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto flex flex-wrap items-stretch justify-center gap-3 w-full">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`rounded-xl border border-charcoal/35 bg-charcoal/45 animate-pulse ${POD_WIDTH} ${POD_HEIGHT}`}
          />
        ))}
      </div>
    );
  }

  if (!games.length) {
    return (
      <p className="text-sm text-ink-500">No games loaded. Check your Supabase connection.</p>
    );
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-wrap items-stretch justify-center gap-3 w-full">
      {games.map((game) => (
        <Link
          key={game.id}
          to={`/browse?game=${game.slug}`}
          className={`relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-white/30 bg-foil px-4 py-3 text-center transition shadow-[0_2px_0_0_rgba(44,62,80,0.15),8px_10px_22px_-14px_rgba(44,62,80,0.55)] hover:shadow-[0_2px_0_0_rgba(44,62,80,0.2),10px_14px_26px_-14px_rgba(44,62,80,0.65)] sm:flex-row sm:items-center sm:justify-start sm:pl-[4.5rem] sm:text-left ${POD_WIDTH} ${POD_HEIGHT}`}
        >
          <span className="mx-auto mb-2.5 h-12 w-12 shrink-0 rounded-full border border-white/65 bg-white/20 flex items-center justify-center shadow-[0_6px_14px_rgba(0,0,0,0.25)] sm:mb-0 sm:mx-0 sm:absolute sm:left-3 sm:top-1/2 sm:-translate-y-1/2">
            <img
              src={GAME_ICONS[game.id]}
              alt={`${game.name} icon`}
              className={GAME_ICON_STYLES[game.id] || 'h-7 w-7 object-contain opacity-95 brightness-0 invert'}
            />
          </span>
          <span className="block min-w-0 sm:pr-2">
            <span className="font-semibold text-sm block text-white line-clamp-2 sm:line-clamp-none">{game.name}</span>
            <span className="text-xs mt-0.5 block text-white/90">Browse</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
