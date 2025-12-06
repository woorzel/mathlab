import { NavLink } from "react-router-dom";
import { makeT } from "../i18n";

const t = makeT('StudentNav');

export default function StudentNav({ auth }) {
  const tab = ({ isActive }) =>
    [
      "rounded-xl px-3 py-1.5 text-sm font-semibold ring-1 transition active:scale-[0.99]",
      isActive
        ? "bg-slate-900 text-white ring-slate-900"
        : "bg-white text-slate-900 ring-slate-300 hover:bg-slate-50",
    ].join(" ");

  return (
    <nav aria-label="Student navigation" className="mb-4 flex items-center gap-2">
      <div className="flex flex-wrap gap-2">
        <NavLink to="/student" end className={tab}>
          {t('start')}
        </NavLink>

        <NavLink to="/student/zadania" className={tab}>
          {t('assignments')}
        </NavLink>

        <NavLink to="/student/oceny" className={tab}>
          {t('grades')}
        </NavLink>

        <NavLink to="/student/statystyki" className={tab}>
          {t('stats')}
        </NavLink>

        <NavLink to="/student/grupy" className={tab}>
          {t('groups')}
        </NavLink>

        {/* NOWE: Ustawienia */}
        <NavLink to="/student/ustawienia" className={tab}>
          {t('settings')}
        </NavLink>
      </div>

      <span className="ml-auto rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200" aria-hidden="true">
        {t('yourId')} <b>#{auth?.userId}</b>
      </span>
    </nav>
  );
}
