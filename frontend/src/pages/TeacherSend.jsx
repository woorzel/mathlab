// src/pages/TeacherSend.jsx
import { useEffect, useState, useMemo } from "react";
import { apiGet, apiPost, apiDelete } from "../api";
import TeacherNav from "../components/TeacherNav.jsx";
import { makeT } from "../i18n";
const t = makeT('TeacherSend');

function displayName(u) {
  const name = (u?.name || "").trim();
  return name || u?.email || t('studentDefault');
}

// pomocnik do formatowania teraz->input[type=datetime-local]
function nowLocalForInput() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TeacherSend({ auth }) {
  const [picked, setPicked] = useState([]);
  const [groups, setGroups] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [membersByGroup, setMembersByGroup] = useState({});
  const [assignments, setAssignments] = useState([]);
  const [selAssignmentId, setSelAssignmentId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [msg, setMsg] = useState("");
  const [assignees, setAssignees] = useState([]);
  const [statusByStudent, setStatusByStudent] = useState({});
  const [due, setDue] = useState(""); // termin ustawiany podczas wysyłki

  // błąd walidacji terminu (pusty = OK; przeszłość = błąd)
  const dueError = useMemo(() => {
    if (!due) return "";
    const ts = Date.parse(due); // local time z inputu
    if (Number.isNaN(ts)) return t('invalidDue');
    if (ts < Date.now()) return t('dueInPast');
    return "";
  }, [due]);

  // All members (for pretty names in messages)
  const allMembers = useMemo(() => Object.values(membersByGroup).flat(), [membersByGroup]);
  const findUserById = (id) =>
    picked.find((u) => u.id === id) ||
    allMembers.find((u) => u.id === id) ||
    null;

  /* -------------------- GRUPY -------------------- */
  useEffect(() => {
    (async () => {
      try {
        const list = await apiGet(`/api/groups?teacherId=${auth.userId}`, auth.token);
        setGroups(list || []);
      } catch {
        setGroups([]);
        setMsg(t('fetchGroupsFailed'));
      }
    })();
  }, [auth]);

  async function loadMembers(gid) {
    if (membersByGroup[gid]) return;
    try {
      const list = await apiGet(`/api/groups/${gid}/students`, auth.token);
      setMembersByGroup((prev) => ({ ...prev, [gid]: list || [] }));
    } catch {
      setMembersByGroup((prev) => ({ ...prev, [gid]: [] }));
    }
  }

  function toggleGroup(g) {
    const next = { ...expanded, [g.id]: !expanded[g.id] };
    setExpanded(next);
    if (next[g.id]) loadMembers(g.id);
  }

  /* -------------------- LISTA ZADAŃ -------------------- */
  useEffect(() => {
    (async () => {
      try {
        const list = await apiGet(`/api/assignments?teacherId=${auth.userId}`, auth.token);
        setAssignments(list || []);
        if (!selAssignmentId && list?.length) setSelAssignmentId(String(list[0].id));
      } catch {
        setAssignments([]);
      }
    })();
    // eslint-disable-next-line
  }, []);

  /* -------------------- PRZYPISANI + STATUSY -------------------- */
  useEffect(() => {
    (async () => {
      const aid = Number(selAssignmentId);
      if (!aid) {
        setAssignees([]);
        setStatusByStudent({});
        return;
      }

      try {
        const [ass, subs] = await Promise.all([
          apiGet(`/api/assignments/${aid}/assignees`, auth.token),
          apiGet(`/api/submissions?assignmentId=${aid}`, auth.token),
        ]);
        setAssignees(ass || []);
        const map = {};
        (subs || []).forEach((s) => {
          const key = String(s.studentId);
          map[key] = map[key] === "GRADED" ? "GRADED" : s.status;
        });
        setStatusByStudent(map);
      } catch {
        setAssignees([]);
        setStatusByStudent({});
      }
    })();
  }, [selAssignmentId, auth]);

  /* -------------------- AKCJE -------------------- */
  function togglePick(u) {
    setPicked((prev) =>
      prev.some((p) => p.id === u.id) ? prev.filter((p) => p.id !== u.id) : [...prev, u]
    );
  }

  async function assignToPicked() {
    if (assigning) return;
    setAssigning(true);
    setMsg("");
    try {
      const id = Number(selAssignmentId);
  if (!id) { setMsg(t('chooseAssignment')); return; }
  if (picked.length === 0) { setMsg(t('chooseStudents')); return; }

      // 🔒 Walidacja terminu po stronie klienta (druga linia obrony oprócz disabled)
      if (due) {
        const t = Date.parse(due);
        if (Number.isNaN(t)) { setMsg(t('provideValidDue')); return; }
        if (t < Date.now()) { setMsg(t('cannotAssignPastDue')); return; }
      }

      const body = {
        studentIds: picked.map((p) => p.id),
        dueAt: due ? new Date(due).toISOString() : null,
      };

      const res = await apiPost(`/api/assignments/${id}/students`, body, auth.token);

      const title = assignments.find((a) => Number(a.id) === id)?.title || t('fallbackAssignment');
      const asNames = (ids) =>
        (ids || [])
          .map((sid) => displayName(findUserById(sid) || { email: `ID ${sid}` }))
          .join(", ") || "—";

      const parts = [`${t('assignedDone')} "${title}".`, `${t('addedLabel')}: ${asNames(res.dodani)}`];
      if (res.duplikaty?.length) parts.push(`${t('alreadyHad')}: ${asNames(res.duplikaty)}`);
      if (res.zlaRola?.length) parts.push(`${t('wrongRole')}: ${asNames(res.zlaRola)}`);
      if (res.brak?.length) parts.push(`${t('notFound')}: ${res.brak.length}`);
      if (body.dueAt) parts.push(`${t('dueLabel')}: ${new Date(body.dueAt).toLocaleString()}`);
      setMsg(parts.join("  •  "));

      setPicked([]);
      const fresh = await apiGet(`/api/assignments/${id}/assignees`, auth.token);
      setAssignees(fresh || []);
    } catch (e) {
      setMsg(t('errorPrefix') + " " + (e.message || e));
    } finally {
      setAssigning(false);
    }
  }

  async function unassignOne(studentId) {
    const aid = Number(selAssignmentId);
    if (!aid) return;
    try {
      await apiDelete(`/api/assignments/${aid}/students/${studentId}`, auth.token);
      setAssignees(assignees.filter((a) => a.id !== studentId));
      setMsg(t('unassignTitle') + '.');
    } catch {
      setMsg(t('cannotUnassignLockedTitle'));
    }
  }

  const lockedByGraded = (sid) => statusByStudent[String(sid)] === "GRADED";

  /* -------------------- UI -------------------- */
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

{/* HERO */}
<header className="mt-6 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
  <div className="relative overflow-hidden rounded-2xl">
    <div className="absolute inset-x-0 -top-10 h-24 bg-gradient-to-r from-sky-200/30 via-indigo-200/30 to-cyan-200/30 dark:from-sky-500/20 dark:via-indigo-500/20 dark:to-cyan-500/20 blur-2xl" />
    <div className="relative grid gap-2 p-6 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          {t('assignTaskTitle')}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {t('assignTaskTitle') === 'Assign task'
            ? 'Select students from groups and assign them an assignment. You also set the deadline for that package here.'
            : 'Wybierz uczniów z grup i przydziel im zadanie. Tutaj ustawiasz też termin dla tego wysyłanego pakietu.'}
        </p>
      </div>
      <div className="flex justify-start gap-2 md:justify-end">
        <span className="teacher-panel-badge rounded-full bg-sky-600/10 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 dark:text-white dark:bg-sky-500/20 dark:ring-sky-500/50">
          {(() => {
            const s = t('teacherPanelBadge');
            if (!String(s || '').trim() || s === 'teacherPanelBadge') {
              return t('assignTaskTitle') === 'Assign task' ? 'Teacher panel' : 'Panel nauczyciela';
            }
            return s;
          })()}
        </span>
      </div>
    </div>
  </div>
</header>


        <div className="mt-6 grid gap-4 md:grid-cols-[360px_1fr]">
          {/* LEWA: grupy */}
          <section className="rounded-2xl bg-slate-50 p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-2 text-base font-semibold text-slate-900">{t('noGroups') === '(brak grup)' ? 'Moje grupy' : 'My groups'}</h2>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              {groups.length === 0 ? (
                <div className="p-3 text-sm text-slate-600">{t('noGroups')}</div>
              ) : (
                groups.map((g) => {
                  const open = !!expanded[g.id];
                  const members = membersByGroup[g.id] || [];
                  return (
                    <div key={g.id} className="border-b border-slate-100">
                      <button
                        onClick={() => toggleGroup(g)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <div className="font-semibold text-slate-900">{g.name}</div>
                        <div className="text-xs text-slate-500">{open ? "−" : "+"}</div>
                      </button>
                      {open && (
                        <div className="bg-white/95 px-3 pb-2">
                          {members.length === 0 ? (
                            <div className="py-2 text-sm text-slate-600">{t('emptyGroup')}</div>
                          ) : (
                            members.map((u) => (
                              <button
                                key={u.id}
                                onClick={() => togglePick(u)}
                                className={`mb-2 w-full rounded-lg border px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                                  picked.some((p) => p.id === u.id)
                                    ? "border-sky-300 bg-sky-50"
                                    : "border-slate-200 bg-white"
                                }`}
                              >
                                <div className="font-medium text-slate-900">{displayName(u)}</div>
                                <div className="text-xs text-slate-600">{u.email}</div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-3 text-sm">
              <b>{t('selectedPrefix')}</b>{" "}
              {picked.length ? (
                <span className="text-slate-8 00">{picked.map(displayName).join(", ")}</span>
              ) : (
                <span className="text-slate-500">{t('none')}</span>
              )}
            </div>
          </section>

          {/* PRAWA: przypisanie */}
          <section className="rounded-2xl bg-slate-50 p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-base font-semibold text-slate-900">{t('assignTaskTitle')}</h2>

            <label className="mt-3 block text-xs font-medium text-slate-700">{t('assignmentLabel')}</label>
            <select
              value={selAssignmentId}
              onChange={(e) => setSelAssignmentId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            >
              {assignments.length === 0 && <option value="">{t('noAssignmentsOption')}</option>}
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>

            <label className="mt-3 block text-xs font-medium text-slate-700">{t('dueOptional')}</label>
            <input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              min={nowLocalForInput()} // UI: nie pozwól wybrać przeszłości
              className={`mt-1 w-full rounded-xl border px-3 py-2 text-slate-900 outline-none transition focus:ring-4 ${
                dueError
                  ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                  : "border-slate-300 focus:border-sky-400 focus:ring-sky-100"
              }`}
            />
            {dueError && <div className="mt-1 text-xs text-rose-700">{dueError}</div>}

            <button
              onClick={assignToPicked}
              disabled={assigning || !!dueError}
              title={dueError || undefined}
              className="mt-3 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-2 font-semibold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99] disabled:opacity-70"
            >
              {assigning ? t('assigning') : t('assign')}
            </button>

            <div className="mt-6">
              <div className="mb-2 text-sm font-semibold text-slate-900">{t('assigneesTitle')}</div>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                {assignees.length === 0 ? (
                  <div className="p-3 text-sm text-slate-600">{t('noAssignees')}</div>
                ) : (
                  assignees.map((u) => {
                    const locked = lockedByGraded(u.id);
                    const status = statusByStudent[String(u.id)] || "—";
                    const dueAt = u.dueAt ? new Date(u.dueAt).toLocaleString() : "—";
                    return (
                      <div key={u.id} className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                        <div>
                          <div className="font-medium text-slate-900">{displayName(u)}</div>
                          <div className="text-xs text-slate-600">{t('statusLabel')}: {status} • {t('dueLabel')}: {dueAt}</div>
                        </div>
                        <button
                          onClick={() => unassignOne(u.id)}
                          disabled={locked}
                          className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                            locked
                              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                              : "border-rose-300 text-rose-600 hover:bg-rose-50"
                          }`}
                          title={locked ? t('cannotUnassignLockedTitle') : t('unassignTitle')}
                        >
                          {locked ? t('gradedLocked') : t('removeFromAssignment')}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {msg && (
              <div
                className={`mt-4 rounded-xl px-3 py-2 text-sm ring-1 ${
                  msg.startsWith("Błąd")
                    ? "bg-rose-50 text-rose-800 ring-rose-200"
                    : "bg-emerald-50 text-emerald-800 ring-emerald-200"
                }`}
              >
                {msg}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
