// src/pages/TeacherJournal.jsx
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api";
import TeacherNav from "../components/TeacherNav.jsx";
import { makeT } from "../i18n";
const t = makeT('TeacherJournal');

/* ==== ASCII helpers (bez polskich znaków) ==== */
function toAscii(value) {
  if (value == null) return "";
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "");
}
function csvEscapeAscii(cell) {
  const v = toAscii(cell);
  return /[";\n,]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/* bezpieczne imię/nazwisko */
function nameOf(u) {
  const n = (u?.name || "").trim();
  return n || u?.email || t('studentDefault', u?.id ?? "?");
}
/* heurystyka do liczby z oceny */
function numericFromScore(score) {
  if (score == null) return null;
  const m = String(score).match(/[0-9]+([.,][0-9]+)?/);
  if (!m) return null;
  const v = parseFloat(m[0].replace(",", "."));
  return isFinite(v) ? v : null;
}

export default function TeacherJournal({ auth }) {
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [members, setMembers] = useState([]); // [{id,name,email}]
  const [rows, setRows] = useState([]);       // statystyki per uczen
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState("");

  // sortowanie
  const [sortKey, setSortKey] = useState("name"); // name | assigned | done | graded | avg | last
  const [sortDir, setSortDir] = useState("asc");  // asc | desc
  const sortIcon = (key) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  // 1) grupy nauczyciela
  useEffect(() => {
    (async () => {
      try {
        const gs = await apiGet(`/api/groups?teacherId=${auth.userId}`, auth.token);
        setGroups(gs || []);
        if ((gs || []).length && !groupId) setGroupId(String(gs[0].id));
      } catch {
        setGroups([]);
      }
    })();
    // eslint-disable-next-line
  }, [auth?.userId, auth?.token]);

  // 2) członkowie grupy
  useEffect(() => {
    if (!groupId) { setMembers([]); return; }
    (async () => {
      try {
        const list = await apiGet(`/api/groups/${groupId}/students`, auth.token);
        setMembers(list || []);
      } catch {
        setMembers([]);
      }
    })();
  }, [groupId, auth]);

  // 3) statystyki per uczeń (bez filtrów dat)
  async function recompute() {
    if (!members?.length) { setRows([]); return; }
    setLoading(true);
    setMsg("");

    try {
      const myAssignments = await apiGet(`/api/assignments?teacherId=${auth.userId}`, auth.token);
      const myAssignmentIds = new Set((myAssignments || []).map(a => String(a.id)));

      const out = [];

      for (const u of members) {
        // surowe dane ucznia (z fallbackiem bez teacherId)
        const [assignedRaw, subsRaw] = await Promise.all([
          apiGet(`/api/assignments/assigned?studentId=${u.id}&teacherId=${auth.userId}`, auth.token)
            .catch(() => apiGet(`/api/assignments/assigned?studentId=${u.id}`, auth.token)),
          apiGet(`/api/submissions?studentId=${u.id}&teacherId=${auth.userId}`, auth.token)
            .catch(() => apiGet(`/api/submissions?studentId=${u.id}`, auth.token)),
        ]);

        // tylko moje zadania
        const assignedMine = (assignedRaw || []).filter(a => myAssignmentIds.has(String(a.id)));
        const subsMine = (subsRaw || []).filter(s => myAssignmentIds.has(String(s.assignmentId)));

        // metryki
        const totalAssigned = assignedMine.length;
        const doneAny = new Set(subsMine.map(s => s.assignmentId)).size;

        const gradedSubs = subsMine
          .filter(s => s.status === "GRADED")
          .slice()
          .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

        const graded = gradedSubs.length;
        const gradesList = gradedSubs.map(s => (s.score == null ? "" : String(s.score))).filter(Boolean);
        const gradesText = gradesList.join(", ");

        const gradedNumeric = gradedSubs
          .map(s => numericFromScore(s.score))
          .filter(v => v != null);

        const avg = gradedNumeric.length
          ? gradedNumeric.reduce((a, b) => a + b, 0) / gradedNumeric.length
          : null;

        const last =
          subsMine
            .map(s => (s.createdAt ? new Date(s.createdAt) : null))
            .filter(Boolean)
            .sort((a, b) => b - a)[0] || null;

        out.push({
          student: u,
          totalAssigned,
          doneAny,
          graded,
          gradesText,
          avg,
          lastAt: last,
        });
      }

        setRows(out);
    } catch (e) {
        setMsg(t('errorFetchData') + (e?.message || e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { recompute(); /* eslint-disable-next-line */ }, [members]);

  // agregaty grupowe
  const groupAgg = useMemo(() => {
    if (!rows.length) return null;
    const sum = rows.reduce(
      (acc, r) => {
        acc.totalAssigned += r.totalAssigned;
        acc.doneAny += r.doneAny;
        acc.graded += r.graded;
        if (r.avg != null) { acc.avgSum += r.avg; acc.avgCnt += 1; }
        return acc;
      },
      { totalAssigned: 0, doneAny: 0, graded: 0, avgSum: 0, avgCnt: 0 }
    );
    const n = rows.length;
    const classAvg = sum.avgCnt ? sum.avgSum / sum.avgCnt : null;
    return {
      n,
      avgText: classAvg != null ? classAvg.toFixed(2) : "—",
      perStudent: {
        assigned: (sum.totalAssigned / n).toFixed(1),
        doneAny: (sum.doneAny / n).toFixed(1),
        graded: (sum.graded / n).toFixed(1),
      },
    };
  }, [rows]);

  // filtr tekstowy
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const s = r.student;
      return (
        (s?.name || "").toLowerCase().includes(q) ||
        (s?.email || "").toLowerCase().includes(q)
      );
    });
  }, [rows, query]);

  // sortowanie
  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    const cmp = (a, b) => {
      let va, vb;
      switch (sortKey) {
        case "assigned": va = a.totalAssigned; vb = b.totalAssigned; break;
        case "done":     va = a.doneAny;       vb = b.doneAny;       break;
        case "graded":   va = a.graded;        vb = b.graded;        break;
        case "avg":      va = a.avg ?? -Infinity; vb = b.avg ?? -Infinity; break;
        case "last":     va = a.lastAt ? a.lastAt.getTime() : 0; vb = b.lastAt ? b.lastAt.getTime() : 0; break;
        case "name":
        default:
          va = (nameOf(a.student) || "").toLowerCase();
          vb = (nameOf(b.student) || "").toLowerCase();
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    };
    copy.sort(cmp);
    return copy;
  }, [filteredRows, sortKey, sortDir]);

  function onSort(col) {
    if (sortKey === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(col); setSortDir("asc"); }
  }

  // EXPORT CSV – ASCII, z kolumną „Oceny”
  function exportCSV() {
    const header = (t('csvHeader') || ["Student","Email","Assigned","Done","Graded","Grades","Average","Last activity"]);
    const lines = [header];

    sortedRows.forEach((r) => {
      lines.push([
        nameOf(r.student),
        r.student.email || "",
        String(r.totalAssigned),
        String(r.doneAny),
        String(r.graded),
        r.gradesText || "",
        r.avg != null ? r.avg.toFixed(2) : "",
        r.lastAt ? r.lastAt.toLocaleString() : "",
      ]);
    });

    const csv = lines.map((row) => row.map(csvEscapeAscii).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const groupName = toAscii(groups.find((g) => String(g.id) === String(groupId))?.name || t('groupFallback'))
      .replace(/\s+/g, "_").toLowerCase();
    a.href = url;
    a.download = `dziennik_${groupName}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ===================== UI (spójny wygląd) ===================== */
  return (
    <div className="relative min-h-[100svh] overflow-x-hidden">
      {/* Tło jak na innych stronach nauczyciela */}
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

        {/* FILTRY / AKCJE (bez dat) */}
        <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 md:grid-cols-[1fr_auto]">
            <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-600">{t('groupLabel')}</span>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{toAscii(g.name)}</option>
              ))}
            </select>

            <input
              placeholder={t('searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="ml-1 w-52 rounded-xl border border-slate-300 px-3 py-1.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            />

            <button
              onClick={recompute}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 transition hover:bg-slate-100/60"
            >
              {t('refreshBtn')}
            </button>
          </div>

          <div className="flex items-center justify-start md:justify-end">
            <button
              onClick={exportCSV}
              title={t('exportCsvTitle')}
              className="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99]"
            >
              {t('exportCsvBtn')}
            </button>
          </div>
        </div>

        {/* PODSUMOWANIE GRUPY */}
        {groupAgg && (
          <div className="mt-4 rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-slate-200">
            <b className="text-slate-900">{t('groupSummaryTitle')}</b>
            <div className="mt-1 text-sm text-slate-700">
              {t('groupSummaryText', groupAgg.avgText, groupAgg.perStudent.assigned, groupAgg.perStudent.doneAny, groupAgg.perStudent.graded)}
            </div>
          </div>
        )}

        {/* TABELA */}
        <div className="mt-4 overflow-auto rounded-2xl ring-1 ring-slate-200">
          <table className="min-w-full border-collapse bg-white/95 text-sm">
            <thead className="sticky top-0 z-[1] bg-white/95">
              <tr className="text-left text-slate-700">
                <ThBtn onClick={() => onSort("name")}     active={sortKey==="name"}     dir={sortDir}>{t('th_student')}{sortIcon("name")}</ThBtn>
                <ThBtn onClick={() => onSort("assigned")} active={sortKey==="assigned"} dir={sortDir}>{t('th_assigned')}{sortIcon("assigned")}</ThBtn>
                <ThBtn onClick={() => onSort("done")}     active={sortKey==="done"}     dir={sortDir}>{t('th_done')}{sortIcon("done")}</ThBtn>
                <ThBtn onClick={() => onSort("graded")}   active={sortKey==="graded"}   dir={sortDir}>{t('th_graded')}{sortIcon("graded")}</ThBtn>
                <th className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-semibold">{t('th_grades')}</th>
                <ThBtn onClick={() => onSort("avg")}      active={sortKey==="avg"}      dir={sortDir}>{t('th_avg')}{sortIcon("avg")}</ThBtn>
                <ThBtn onClick={() => onSort("last")}     active={sortKey==="last"}     dir={sortDir}>{t('th_last')}{sortIcon("last")}</ThBtn>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-3 text-slate-600">{t('loading')}</td></tr>
              ) : sortedRows.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-3 text-slate-600">{t('noData')}</td></tr>
              ) : (
                sortedRows.map((r) => (
                  <tr key={r.student.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 align-top">
                      <div className="font-semibold text-slate-900">{toAscii(nameOf(r.student))}</div>
                      <div className="text-xs text-slate-600">{toAscii(r.student.email)}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right align-top">{r.totalAssigned}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right align-top">{r.doneAny}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right align-top">{r.graded}</td>
                    <td className="px-3 py-2 align-top">{toAscii(r.gradesText || "—")}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right align-top">{r.avg != null ? r.avg.toFixed(2) : "—"}</td>
                    <td className="px-3 py-2 align-top">{r.lastAt ? r.lastAt.toLocaleString() : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-200">
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}

/* Mały pomocnik do nagłówków tabeli */
function ThBtn({ children, onClick, active, dir }) {
  return (
    <th
      onClick={onClick}
      className={`cursor-pointer select-none whitespace-nowrap border-b border-slate-200 px-3 py-2 font-semibold transition ${
        active ? "text-slate-900" : "text-slate-700 hover:text-slate-900"
      }`}
      title={t('sortTitle')}
    >
      {children}
    </th>
  );
}
