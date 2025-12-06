// src/pages/StudentGroups.jsx
import { useEffect, useState } from "react";
import { apiGet } from "../api";
import StudentNav from "../components/StudentNav";
import { makeT } from "../i18n";
const t = makeT('StudentGroups');

function displayName(u) {
  const name = (u?.name || "").trim();
  return name || u?.email || "Uczeń";
}

export default function StudentGroups({ auth }) {
  const [groups, setGroups] = useState([]);
  const [membersByGroup, setMembersByGroup] = useState({}); // gid -> [users] | undefined (loading) | []
  const [expanded, setExpanded] = useState({}); // gid -> bool
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // wczytaj grupy, do których należy uczeń
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setMsg("");
      try {
        const res = await apiGet(`/api/groups?studentId=${auth.userId}`, auth.token);
        if (!alive) return;
        setGroups(Array.isArray(res) ? res : []);
      } catch (e) {
        if (!alive) return;
        setMsg("Nie udało się pobrać grup: " + (e?.message || e));
        setGroups([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => (alive = false);
  }, [auth]);

  async function loadMembers(gid) {
    // jeżeli już ładowaliśmy (nawet pustą listę), nie ponawiaj
    if (gid in membersByGroup) return;
    // oznacz jako "loading" przez ustawienie undefined -> pokaże spinner/tekst
    setMembersByGroup((prev) => ({ ...prev, [gid]: undefined }));
    try {
      const list = await apiGet(`/api/groups/${gid}/students`, auth.token);
      setMembersByGroup((prev) => ({ ...prev, [gid]: Array.isArray(list) ? list : [] }));
    } catch {
      setMembersByGroup((prev) => ({ ...prev, [gid]: [] }));
    }
  }

  function toggle(g) {
    const open = !expanded[g.id];
    setExpanded((prev) => ({ ...prev, [g.id]: open }));
    if (open) loadMembers(g.id);
  }

  return (
    <div className="relative min-h-[100svh] overflow-x-hidden">
      {/* tło jak na innych stronach */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_45%,#eef6fb_100%)]" />
        <div className="absolute -top-24 left-1/3 h-80 w-80 rounded-full bg-sky-300/15 blur-[90px]" />
        <div className="absolute top-64 -left-20 h-72 w-72 rounded-full bg-indigo-300/10 blur-[90px]" />
        <div className="absolute bottom-24 right-10 h-96 w-96 rounded-full bg-cyan-300/10 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.04] [background:radial-gradient(#0f172a_0.8px,transparent_0.8px)] [background-size:8px_8px]" />
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-20">
        <StudentNav auth={auth} />

        {/* HERO */}
        <header className="mt-6 rounded-2xl bg-white/80 backdrop-blur-sm shadow-sm ring-1 ring-slate-200">
          <div className="relative overflow-hidden rounded-2xl">
            <div className="absolute inset-x-0 -top-10 h-24 bg-gradient-to-r from-sky-200/30 via-indigo-200/30 to-cyan-200/30 blur-2xl" />
            <div className="relative grid gap-2 p-6 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900">{t('title')}</h1>
                <p className="mt-1 text-sm text-slate-600">{t('heroDesc')}</p>
              </div>
              <div className="flex justify-start gap-2 md:justify-end">
                <span className="rounded-full bg-sky-600/10 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
                  {t('panelBadge')}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* LISTA GRUP */}
        <section className="mt-6 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          {loading ? (
            <div className="p-3 text-sm text-slate-600">{t('loading')}</div>
          ) : groups.length === 0 ? (
            <div className="p-3 text-sm text-slate-600">{t('noneGroups')}</div>
          ) : (
            <div className="grid gap-3">
              {groups.map((g) => {
                const open = !!expanded[g.id];
                const members = membersByGroup[g.id]; // undefined => loading

                const teacher =
                  (g.teacherName && g.teacherName.trim()) || g.teacherEmail || "Nauczyciel";

                return (
                  <div
                    key={g.id}
                    className="overflow-hidden rounded-2xl ring-1 ring-slate-200"
                  >
                    {/* nagłówek karty */}
                    <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2">
                      <div>
                        <div className="font-semibold text-slate-900">{g.name || "Grupa"}</div>
                        <div className="text-xs text-slate-600">
                          {t('teacherLabel')}: <b>{teacher}</b>
                          {typeof g.size === "number" ? (
                            <> • {t('studentsCountPrefix')} {g.size}</>
                          ) : null}
                        </div>
                      </div>

                      <button
                        onClick={() => toggle(g)}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-1 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 active:scale-[0.99]"
                      >
                        {open ? t('hideMembers') : t('showMembers')}
                      </button>
                    </div>

                    {/* rozwijana lista członków */}
                    {open && (
                      <div className="px-3 py-3">
                        {members === undefined ? (
                          <div className="text-sm text-slate-600">{t('membersLoading')}</div>
                        ) : members.length === 0 ? (
                          <div className="text-sm text-slate-600">{t('noMembers')}</div>
                        ) : (
                          <ul className="grid gap-2">
                            {members.map((u) => (
                              <li
                                key={u.id}
                                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
                              >
                                {/* prosty „avatar” z inicjałem */}
                                <div className="grid h-8 w-8 place-items-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
                                  {(displayName(u)[0] || "?").toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate font-semibold text-slate-900">
                                    {displayName(u)}
                                  </div>
                                  <div className="truncate text-xs text-slate-600">{u.email}</div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {msg && (
            <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">
              {msg}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
