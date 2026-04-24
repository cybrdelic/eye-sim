import { NavLink } from 'react-router-dom';
import { APP_NAV_ITEMS } from '../routes/routeConfig';

type AppNavProps = {
  className?: string;
};

export default function AppNav({ className = '' }: AppNavProps) {
  return (
    <div className={`flex max-w-[calc(100vw-2rem)] flex-wrap gap-1.5 rounded-[1.45rem] border border-white/10 bg-black/45 px-3 py-2 text-xs backdrop-blur-xl sm:gap-2 sm:rounded-full sm:text-sm ${className}`.trim()}>
      {APP_NAV_ITEMS.map((item) => (
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
    </div>
  );
}
