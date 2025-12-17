// src/pages/StudentHome.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api";
import StudentNav from "../components/StudentNav";
import { makeT } from "../i18n";
const t = makeT('StudentHome');
const APP_NAME = 'MathLab';

/* helpers */
const effectiveDue = (a) => a?.studentDueAt || a?.dueAt || null;
const isValidDate = (v) => {
  const d = v instanceof Date ? v : v ? new Date(v) : null;
  return !!d && !isNaN(d.getTime());
};
const isPast = (iso) => !!iso && isValidDate(iso) && new Date(iso).getTime() < Date.now();

export default function StudentHome({ auth }) {
  const [assignments, setAssignments] = useState([]);
  const [subs, setSubs] = useState([]);
  const [groups, setGroups] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [aList, sList, gList] = await Promise.all([
          apiGet(`/api/assignments/assigned?studentId=${auth.userId}`, auth.token),
          apiGet(`/api/submissions?studentId=${auth.userId}`, auth.token),
          apiGet(`/api/groups?studentId=${auth.userId}`, auth.token),
        ]);
        if (!alive) return;
        setAssignments(Array.isArray(aList) ? aList : []);
        setSubs(Array.isArray(sList) ? sList : []);
        setGroups(Array.isArray(gList) ? gList : []);
      } catch (e) {
        if (!alive) return;
        setAssignments([]); setSubs([]); setGroups([]);
        setMsg("Nie udało się pobrać danych.");
      }
    })();
    return () => { alive = false; };
  }, [auth?.userId, auth?.token]);

  // Ustaw tytuł strony dla panelu ucznia
  useEffect(() => {
    try {
      document.title = `${APP_NAME} – ${t('title')}`;
    } catch {}
  }, []);

  // najnowsze zgłoszenie per zadanie (po id)
  const latestSubByA = useMemo(() => {
    const map = {};
    for (const s of subs) {
      const k = String(s.assignmentId);
      if (!map[k] || (s.id ?? 0) > (map[k].id ?? 0)) map[k] = s;
    }
    return map;
  }, [subs]);

  // status per assignment
  function statusFor(a) {
    const s = latestSubByA[String(a.id)];
    const due = effectiveDue(a);
    if (s?.status === "GRADED") return "GRADED";
    if (s?.status === "SUBMITTED") return "SUBMITTED";
    if (due && isPast(due)) return "OVERDUE";
    if (s) return "DRAFT";
    return "NOT_STARTED";
  }

  // liczniki do badge
  const counts = useMemo(() => {
    let todo = 0, overdue = 0, submitted = 0, graded = 0;
    for (const a of assignments) {
      const st = statusFor(a);
      if (st === "NOT_STARTED" || st === "DRAFT") todo++;
      if (st === "OVERDUE") overdue++;
      if (st === "SUBMITTED") submitted++;
      if (st === "GRADED") graded++;
    }
    return {
      assigned: assignments.length,
      todo, overdue, submitted, graded,
      groups: groups.length,
    };
  }, [assignments, groups, latestSubByA]);

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
        <StudentNav auth={auth} />

        {/* HERO – prosto i krótko */}
        <header className="mt-6 rounded-2xl bg-white/80 backdrop-blur-sm shadow-sm ring-1 ring-slate-200">
          <div className="relative overflow-hidden rounded-2xl">
            <div className="absolute inset-x-0 -top-10 h-24 bg-gradient-to-r from-sky-200/30 via-indigo-200/30 to-cyan-200/30 blur-2xl" />
            <div className="relative grid gap-2 p-6 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900">
                  {t('title')}
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  {t('heroDesc')}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 md:justify-end">
      
                <Link
                  to="/student/zadania"
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100/60"
                >
                  {t('goToAssignments')}
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

        {/* GŁÓWNE MENU — duże kafle */}
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Tile to="/student/zadania" title={t('tile_assign_title')} desc={t('tile_assign_desc')} emoji="🧩" badge={String(counts.assigned)} />
          <Tile to="/student/zadania" title={t('tile_todo_title')} desc={t('tile_todo_desc')} emoji="🕒" badge={String(counts.todo)} />
          {/* USUNIĘTY kafel „Po terminie” */}
          <Tile to="/student/zadania" title={t('tile_sent_title')} desc={t('tile_sent_desc')} emoji="📤" badge={String(counts.submitted)} />
          <Tile to="/student/oceny" title={t('tile_graded_title')} desc={t('tile_graded_desc')} emoji="✅" badge={String(counts.graded)} />
          <Tile to="/student/grupy" title={t('tile_groups_title')} desc={t('tile_groups_desc')} emoji="👥" badge={String(counts.groups)} />
          {/* NOWE: Ustawienia */}
          <Tile to="/student/ustawienia" title={t('tile_settings_title')} desc={t('tile_settings_desc')} emoji="⚙️" />
        </section>
      </div>
    </div>
  );
}

/* --- kafel --- */
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
