// src/components/TeacherNav.jsx
import { NavLink } from "react-router-dom";
import { makeT } from "../i18n";

const t = makeT('TeacherNav');

export default function TeacherNav() {
  const tab = ({ isActive }) =>
    [
      "rounded-xl px-3 py-1.5 text-sm font-semibold ring-1 transition active:scale-[0.99]",
      isActive
        ? "bg-slate-900 text-white ring-slate-900"
        : "bg-white text-slate-900 ring-slate-300 hover:bg-slate-50",
    ].join(" ");

  return (
    <nav aria-label="Teacher navigation" className="mb-4 flex items-center gap-2">
      <div className="flex flex-wrap gap-2">
        <NavLink to="/t/start" className={tab}>
          {t('start')}
        </NavLink>
        <NavLink to="/t/zadania" className={tab}>
          {t('assignments')}
        </NavLink>
        <NavLink to="/t/wysylka" className={tab}>
          {t('send')}
        </NavLink>
        <NavLink to="/t/ocenianie" className={tab}>
          {t('grading')}
        </NavLink>
        <NavLink to="/t/grupy" className={tab}>
          {t('groups')}
        </NavLink>
        <NavLink to="/t/dziennik" className={tab}>
          {t('journal')}
        </NavLink>
        <NavLink to="/t/ustawienia" className={tab}>
          {t('settings')}
        </NavLink>
      </div>
    </nav>
  );
}
