import { useEffect, useState } from "react";
import { apiGet, apiPost, apiDelete } from "../api";
import TeacherNav from "../components/TeacherNav.jsx";
import { makeT } from "../i18n";
const t = makeT('TeacherGroups');

export default function TeacherGroups({ auth }) {
  const [groups, setGroups] = useState([]);
  const [sel, setSel] = useState("");                 // wybrana grupa (id)
  const [students, setStudents] = useState([]);       // członkowie wybranej grupy
  const [msg, setMsg] = useState("");

  const [newName, setNewName] = useState("");
  const [addId, setAddId] = useState("");
  const [addEmail, setAddEmail] = useState("");

  async function loadGroups(selectFirst = false) {
    try {
      const list = await apiGet(`/api/groups?teacherId=${auth.userId}`, auth.token);
      const arr = Array.isArray(list) ? list : [];
      setGroups(arr);
      if (selectFirst && arr.length) setSel(String(arr[0].id));
    } catch {
      setGroups([]);
    }
  }

  async function loadMembers(groupId) {
    if (!groupId) { setStudents([]); return; }
    try {
      const list = await apiGet(`/api/groups/${groupId}/students`, auth.token);
      setStudents(Array.isArray(list) ? list : []);
    } catch {
      setStudents([]);
    }
  }

  useEffect(() => { loadGroups(true); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (sel) loadMembers(sel); }, [sel]); // eslint-disable-line

  async function createGroup() {
    if (!newName.trim()) return;
    setMsg("");
    try {
      const g = await apiPost("/api/groups", { name: newName.trim(), teacherId: auth.userId }, auth.token);
      setNewName("");
      await loadGroups(false);
      setSel(String(g.id));
      setMsg(t('createdGroup', g.name));
    } catch (e) {
      setMsg(t('errorCreating') + (e.message || e));
    }
  }

  async function addOne() {
    if (!sel) return;
    if (!addId.trim() || !addEmail.trim()) {
      setMsg(t('provideIdEmail'));
      return;
    }
    setMsg("");
    try {
      const id = Number(addId);
      const body = { members: [{ id, email: addEmail.trim() }] }; // weryfikacja id+email po stronie backendu
      const res = await apiPost(`/api/groups/${sel}/students`, body, auth.token);

      // komunikat po nazwach
      const asNames = ids =>
        (ids || [])
          .map(sid => {
            const u = students.find(x => x.id === sid);
            return (u && (u.name || u.email)) || `ID ${sid}`;
          })
          .join(", ") || "—";

      const parts = [];
  if (res.added?.length)      parts.push(t('added') + asNames(res.added));
  if (res.duplicates?.length) parts.push(t('alreadyInGroup') + asNames(res.duplicates));
  if (res.missingOrMismatch?.length) parts.push(t('missingOrMismatch', res.missingOrMismatch.length));

      await loadMembers(sel);
      setAddId(""); setAddEmail("");
      setMsg(parts.join("  •  ") || t('noChanges'));
    } catch (e) {
      setMsg(t('errorAdding') + (e.message || e));
    }
  }

  async function removeMember(studentId) {
    if (!sel) return;
    const u = students.find(s => s.id === studentId);
  const who = u?.name || u?.email || t('studentFallback');
  if (!window.confirm(t('confirmRemoveMember', who))) return;
    setMsg("");
    try {
      await apiDelete(`/api/groups/${sel}/students/${studentId}`, auth.token);
      await loadMembers(sel);
      setMsg(t('removedFromGroup'));
    } catch (e) {
      setMsg(t('errorRemoving') + (e.message || e));
    }
  }

  async function removeGroup() {
    if (!sel) return;
    const name = groups.find(g => String(g.id) === String(sel))?.name || "grupa";
  if (!window.confirm(t('confirmRemoveGroup', name))) return;
    setMsg("");
    try {
      await apiDelete(`/api/groups/${sel}`, auth.token);
      await loadGroups(true);
      setSel(groups[0] ? String(groups[0].id) : "");
      setStudents([]);
      setMsg(t('removedGroup', name));
    } catch (e) {
      setMsg(t('errorRemovingGroup') + (e.message || e));
    }
  }

  const currentGroupName = groups.find(g => String(g.id) === String(sel))?.name || "";

  return (
    <div className="relative min-h-[100svh] overflow-x-hidden">
      {/* Spokojne tło jak na innych stronach */}
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
                  {t('teacherPanelBadge')}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* GŁÓWNY PANEL */}
        <section className="mt-6 rounded-2xl bg-slate-50 p-4 shadow-sm ring-1 ring-slate-200">
          {/* Pasek akcji dla grup */}
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <div className="flex items-center gap-2">
                <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder={t('groupNamePlaceholder')}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              />
              <button
                onClick={createGroup}
                className="rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99]"
              >
                {t('createGroupBtn')}
              </button>
            </div>

            <div className="flex items-center gap-2 md:justify-end">
              <select
                value={sel}
                onChange={e => setSel(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              >
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button
                onClick={removeGroup}
                className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 active:scale-[0.99]"
              >
                {t('removeGroupBtn')}
              </button>
            </div>
          </div>

          {/* Sekcje: członkowie i dodawanie */}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {/* Członkowie */}
            <div className="rounded-2xl bg-white/90 p-4 ring-1 ring-slate-200">
              <div className="mb-2 text-base font-semibold text-slate-900">
                {t('membersHeading', currentGroupName)}
              </div>

              {students.length === 0 ? (
                <div className="text-sm text-slate-600">{t('empty')}</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {students.map(u => (
                    <div key={u.id} className="flex items-start justify-between gap-3 py-2">
                      <div>
                        <div className="font-semibold text-slate-900">{u.name || u.email}</div>
                        <div className="text-xs text-slate-600">{u.email}</div>
                      </div>
                      <button
                        onClick={() => removeMember(u.id)}
                        className="h-fit rounded-xl border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50 active:scale-[0.98]"
                      >
                        {t('removeFromGroupBtn')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dodanie jednego ucznia: para (ID + e-mail) */}
            <div className="rounded-2xl bg-white/90 p-4 ring-1 ring-slate-200">
              <div className="mb-2 text-base font-semibold text-slate-900">
                {t('addStudentHeading')}
              </div>

              <input
                value={addId}
                onChange={e => setAddId(e.target.value)}
                placeholder={t('studentIdPlaceholder')}
                className="mb-2 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              />
              <input
                value={addEmail}
                onChange={e => setAddEmail(e.target.value)}
                placeholder={t('studentEmailPlaceholder')}
                className="mb-3 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              />
              <button
                onClick={addOne}
                className="rounded-xl border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99]"
              >
                {t('addBtn')}
              </button>
            </div>
          </div>

          {msg && (
            <div
              className={`mt-4 rounded-xl px-4 py-3 text-sm ring-1 ${
                msg.startsWith(t('errorPrefix'))
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
  );
}
