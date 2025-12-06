// src/pages/TeacherHome.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api";
import TeacherNav from "../components/TeacherNav.jsx";

// simple per-file i18n: read 'lang' from localStorage ('pl' | 'en')
import { makeT } from "../i18n";
const t = makeT('TeacherHome');

export default function TeacherHome({ auth }) {
  const [pendingCount, setPendingCount] = useState(null); // SUBMITTED
  const [groupsCount, setGroupsCount] = useState(null);
  const [msg, setMsg] = useState("");

  // Minimalne liczby do badge (bez „dashboardu”)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // wszystkie zgłoszenia do moich zadań -> zlicz SUBMITTED
        const subs = await apiGet(`/api/submissions?teacherId=${auth.userId}`, auth.token);
        if (alive) setPendingCount((subs || []).filter((s) => s.status === "SUBMITTED").length);
      } catch (e) {
        if (alive) setPendingCount(0);
        setMsg(t('fetchCountError'));
      }
      try {
        const groups = await apiGet(`/api/groups?teacherId=${auth.userId}`, auth.token);
        if (alive) setGroupsCount((groups || []).length);
      } catch {
        if (alive) setGroupsCount(0);
      }
    })();
    return () => { alive = false; };
  }, [auth?.userId, auth?.token]);

  return (
    <div className="relative min-h-[100svh] overflow-x-hidden">
      {/* tło */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_45%,#eef6fb_100%)]" />
        <div className="absolute -top-24 left-1/3 h-80 w-80 rounded-full bg-sky-300/15 blur-[90px]" />
        <div className="absolute top-64 -left-20 h-72 w-72 rounded-full bg-indigo-300/10 blur-[90px]" />
        <div className="absolute bottom-24 right-10 h-96 w-96 rounded-full bg-cyan-300/10 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.04] [background:radial-gradient(#0f172a_0.8px,transparent_0.8px)] [background-size:8px_8px]" />
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-20">
        <TeacherNav />

        {/* HERO — prosto i krótko */}
        <header className="mt-6 rounded-2xl bg-white/80 backdrop-blur-sm shadow-sm ring-1 ring-slate-200">
          <div className="relative overflow-hidden rounded-2xl">
            <div className="absolute inset-x-0 -top-10 h-24 bg-gradient-to-r from-sky-200/30 via-indigo-200/30 to-cyan-200/30 blur-2xl" />
            <div className="relative grid gap-2 p-6 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900">{t('pageTitle')}</h1>
                <p className="mt-1 text-sm text-slate-600" dangerouslySetInnerHTML={{ __html: t('heroDesc') }} />
              </div>
              <div className="flex flex-wrap items-center gap-3 md:justify-end">
           
                <Link
                  to="/t/zadania"
                  className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-105"
                >
                  {t('newAssignment')}
                </Link>
                <Link
                  to="/t/wysylka"
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100/60"
                >
                  {t('assignDeadline')}
                </Link>
              </div>
            </div>
          </div>
        </header>

        {msg && (
          <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-200">
            {msg}
          </div>
        )}

        {/* GŁÓWNE MENU — jedna siatka kafli */}
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Tile to="/t/zadania" title={t('tile_assign_title')} desc={t('tile_assign_desc')} emoji="🧩" />
          <Tile to="/t/wysylka" title={t('tile_send_title')} desc={t('tile_send_desc')} emoji="📤" />
          <Tile
            to="/t/ocenianie"
            title={t('tile_grade_title')}
            desc={t('tile_grade_desc')}
            emoji="✅"
            badge={pendingCount == null ? "…" : String(pendingCount)}
          />
          <Tile to="/t/dziennik" title={t('tile_journal_title')} desc={t('tile_journal_desc')} emoji="📑" />
          <Tile
            to="/t/grupy"
            title={t('tile_groups_title')}
            desc={t('tile_groups_desc')}
            emoji="👥"
            badge={groupsCount == null ? "…" : String(groupsCount)}
          />
          <Tile to="/t/ustawienia" title={t('tile_settings_title')} desc={t('tile_settings_desc')} emoji="⚙️" />
        </section>
      </div>
    </div>
  );
}

/* --- mini-komponent kafla --- */
function Tile({ to, title, desc, emoji, badge }) {
  return (
    <Link
      to={to}
      className="group relative block rounded-2xl bg-white/90 p-5 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md active:scale-[0.99]"
    >
      {badge != null && (
        <span className="absolute right-4 top-4 rounded-full bg-sky-600 px-2.5 py-0.5 text-xs font-semibold text-white">
          {badge}
        </span>
      )}
      <div className="text-3xl">{emoji}</div>
      <div className="mt-2 text-base font-semibold text-slate-900">{title}</div>
      <div className="text-sm text-slate-600">{desc}</div>
    </Link>
  );
}
