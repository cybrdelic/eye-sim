import { NavLink } from 'react-router-dom';
import { LAB_NAV_ITEMS, PRODUCT_NAV_ITEMS } from '../routes/routeConfig';

type AppNavProps = {
  className?: string;
};

export default function AppNav({ className = '' }: AppNavProps) {
  return (
    <nav
      aria-label="App navigation"
      className={`flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-1.5 rounded-[1.45rem] border border-white/10 bg-black/45 px-3 py-2 text-xs backdrop-blur-xl sm:gap-2 sm:rounded-full sm:text-sm ${className}`.trim()}
    >
      {PRODUCT_NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => (
            isActive
              ? 'rounded-full bg-white/10 px-3 py-1 text-white'
              : 'rounded-full px-3 py-1 text-stone-300 transition hover:bg-white/10 hover:text-white'
          )}
        >
          {item.label}
        </NavLink>
      ))}
      <span className="mx-1 hidden h-4 w-px bg-white/15 sm:inline-block" aria-hidden="true" />
      <span className="rounded-full border border-amber-300/15 bg-amber-300/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/70">
        Labs
      </span>
      {LAB_NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => (
            isActive
              ? 'rounded-full bg-amber-300/16 px-3 py-1 text-amber-50'
              : 'rounded-full px-3 py-1 text-stone-300 transition hover:bg-amber-300/10 hover:text-amber-50'
          )}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
