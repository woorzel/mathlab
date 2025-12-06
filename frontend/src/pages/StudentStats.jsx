// src/pages/StudentStats.jsx
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api";
import StudentNav from "../components/StudentNav";

/* ============ Helpers ============ */
// ASCII helpers
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

// daty/terminy
function effectiveDue(a) {
  return a?.studentDueAt || a?.dueAt || null;
}
function isValidDate(v) {
  const d = v instanceof Date ? v : v ? new Date(v) : null;
  return !!d && !isNaN(d.getTime());
}
function isPast(iso) {
  return !!iso && isValidDate(iso) && new Date(iso).getTime() < Date.now();
}
function fmtDateSafe(v) {
  if (!v) return null;
  try {
    const d =
      v instanceof Date ? v :
      typeof v === "number" ? new Date(v) :
      typeof v === "string" ? new Date(v) :
      null;
    if (!d || isNaN(d.getTime())) return String(v);
    return d.toLocaleString();
  } catch {
    return String(v);
  }
}
function timeLeftLabel(iso) {
  if (!iso || !isValidDate(iso)) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "po terminie";
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  if (d >= 1) return `za ${d} d`;
  return `za ${h} h`;
}

// pierwsza poprawna data z listy (używane do „Zmiana statusu”)
function pickDate(...xs) {
  for (const x of xs) {
    const d = x ? new Date(x) : null;
    if (d && !isNaN(d.getTime())) return x;
  }
  return null;
}

// inne
function numFromScore(score) {
  if (score == null) return null;
  const m = String(score).match(/[0-9]+([.,][0-9]+)?/);
  if (!m) return null;
  const v = parseFloat(m[0].replace(",", "."));
  return isFinite(v) ? v : null;
}

/* ============ Strona ============ */
import { makeT } from "../i18n";
const t = makeT('StudentStats');

export default function StudentStats({ auth }) {
  const [assignments, setAssignments] = useState([]);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // PAGINATION (Postęp wg zadań)
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setMsg("");
      try {
        const [aList, sList] = await Promise.all([
          apiGet(`/api/assignments/assigned?studentId=${auth.userId}`, auth.token),
          apiGet(`/api/submissions?studentId=${auth.userId}`, auth.token),
        ]);
        if (!alive) return;
        setAssignments(aList || []);
        const ordered = (sList || [])
          .slice()
          .sort((a, b) => (a.id ?? 0) - (b.id ?? 0)); // rosnąco po id -> najnowsze „wygrywają”
        setSubs(ordered);
      } catch (e) {
        if (!alive) return;
        setMsg("Błąd pobierania: " + (e?.message || e));
        setAssignments([]);
        setSubs([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [auth?.userId, auth?.token]);

  // mapy pomocnicze
  const aById = useMemo(() => {
    const m = {};
    (assignments || []).forEach((a) => (m[String(a.id)] = a));
    return m;
  }, [assignments]);

  // najnowsze zgłoszenie per zadanie (bo mogły być poprawy)
  const latestSubByA = useMemo(() => {
    const map = new Map(); // aid -> submission
    for (const s of subs) {
      const key = String(s.assignmentId);
      map.set(key, s); // dzięki sortowaniu rosnąco – ostatni wygrywa
    }
    return map;
  }, [subs]);

  // status dla zadania
  function statusFor(a) {
    const s = latestSubByA.get(String(a.id)) || null;
    const due = effectiveDue(a);
    if (s?.status === "GRADED") return "GRADED";
    if (s?.status === "SUBMITTED") return "SUBMITTED";
    if (due && isPast(due)) return "OVERDUE";
    if (s) return "DRAFT";
    return "NOT_STARTED";
  }

  // data ostatniej zmiany statusu
  function statusChangedAt(a) {
    const s = latestSubByA.get(String(a.id)) || null;
    const st = statusFor(a);
    if (st === "OVERDUE") return effectiveDue(a); // „zmiana” w chwili deadline'u
    if (!s) return null;

    if (st === "GRADED")     return pickDate(s.gradedAt,    s.updatedAt, s.createdAt);
    if (st === "SUBMITTED")  return pickDate(s.submittedAt, s.updatedAt, s.createdAt);
    if (st === "DRAFT")      return pickDate(                s.updatedAt, s.createdAt);
    return null;
  }

  // KPI / SUMY
  const kpi = useMemo(() => {
    const assignedCnt = (assignments || []).length;
    let draftCnt = 0, submittedCnt = 0, gradedCnt = 0, notStartedCnt = 0;
    const gradesNum = [];

    for (const a of assignments) {
      const st = statusFor(a);
      if (st === "GRADED") gradedCnt++;
      else if (st === "SUBMITTED") submittedCnt++;
      else if (st === "DRAFT") draftCnt++;
      else notStartedCnt++;

      const s = latestSubByA.get(String(a.id));
      const v = numFromScore(s?.score);
      if (v != null) gradesNum.push(v);
    }

    const avg = gradesNum.length ? gradesNum.reduce((p, c) => p + c, 0) / gradesNum.length : null;

    // ostatnia aktywność = najnowsze (po id) zgłoszenie
    const last = subs.length ? subs[subs.length - 1] : null;
    const lastAct = last?.createdAt ? new Date(last.createdAt) : null;

    return { assignedCnt, draftCnt, submittedCnt, gradedCnt, avg, lastAct };
  }, [assignments, subs, latestSubByA]);

  // Najbliższe terminy (7 dni), tylko nieocenione
  const upcoming = useMemo(() => {
    const now = Date.now();
    const week = 7 * 24 * 3600 * 1000;
    return (assignments || [])
      .filter((a) => {
        const st = statusFor(a);
        if (st === "GRADED") return false;
        const due = effectiveDue(a);
        if (!due || !isValidDate(due)) return false;
        const t = new Date(due).getTime();
        return t >= now && t - now <= week;
      })
      .sort((a, b) => new Date(effectiveDue(a)) - new Date(effectiveDue(b)));
  }, [assignments]);

  // Wszystkie ocenione (do sekcji)
  const allGradedSorted = useMemo(() => {
    const graded = [];
    for (const a of assignments) {
      const s = latestSubByA.get(String(a.id));
      if (s?.status === "GRADED") graded.push(s);
    }
    return graded.sort((a, b) => (new Date(b.createdAt || 0)) - (new Date(a.createdAt || 0)));
  }, [assignments, latestSubByA]);

  // Postęp wg zadań (surowe)
  const progressRows = useMemo(() => {
    return (assignments || []).map((a) => {
      const s = latestSubByA.get(String(a.id)) || null;
      return {
        a,
        due: effectiveDue(a),
        status: statusFor(a),
        score: s?.score ?? null,
        reviewNote: s?.reviewNote ?? "",
        changeAt: statusChangedAt(a),
      };
    });
  }, [assignments, latestSubByA]);

  // Sort: od najnowszych do najstarszych (po changeAt; fallback: po due; dalej po id)
  const progressSorted = useMemo(() => {
    const t = (x) => (x ? new Date(x).getTime() : 0);
    return [...progressRows].sort((r1, r2) => {
      const a1 = t(r1.changeAt) || t(r1.due) || (r1.a?.id ? Number(r1.a.id) : 0);
      const a2 = t(r2.changeAt) || t(r2.due) || (r2.a?.id ? Number(r2.a.id) : 0);
      return a2 - a1; // DESC
    });
  }, [progressRows]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(progressSorted.length / pageSize));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);
  useEffect(() => { setPage(1); }, [progressSorted.length]); // reset gdy zmienia się lista
  const pageRows = useMemo(
    () => progressSorted.slice((page - 1) * pageSize, page * pageSize),
    [progressSorted, page]
  );

  // Eksport CSV (rozszerzony o status + zmiana statusu + termin)
  function exportGradesCSV() {
    const header = [
      "Zadanie","Nauczyciel","Status","Zmiana statusu","Termin","Ocena","Komentarz","Data utworzenia zgloszenia",
    ];
    const lines = [header];
    for (const a of assignments) {
      const s = latestSubByA.get(String(a.id)) || null;
      const changed = statusChangedAt(a);
      lines.push([
        a?.title || `Zadanie #${a.id}`,
        a?.teacherName || "Nauczyciel",
        statusFor(a),
        changed ? new Date(changed).toLocaleString() : "",
        effectiveDue(a) ? new Date(effectiveDue(a)).toLocaleString() : "",
        s?.score ?? "",
        s?.reviewNote ?? "",
        s?.createdAt ? new Date(s.createdAt).toLocaleString() : "",
      ]);
    }
    const csv = lines.map((row) => row.map(csvEscapeAscii).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `moje_statystyki_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="relative min-h-[100svh] overflow-x-hidden">
      {/* Tło */}
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
                <button
                  onClick={exportGradesCSV}
                  className="rounded-xl border border-emerald-600 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                >
                  {t('exportCsvBtn')}
                </button>
              </div>
            </div>
          </div>
        </header>

        {msg && (
          <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">
            {toAscii(msg)}
          </div>
        )}

        {/* KPI — 5 kart */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard title={t('kpi_assigned')} value={loading ? "…" : kpi.assignedCnt} />
          <KpiCard title={t('kpi_draft')} value={loading ? "…" : kpi.draftCnt} />
          <KpiCard title={t('kpi_submitted')} value={loading ? "…" : kpi.submittedCnt} />
          <KpiCard title={t('kpi_graded')} value={loading ? "…" : kpi.gradedCnt} />
          <KpiCard title={t('kpi_avg')} value={loading ? "…" : kpi.avg != null ? kpi.avg.toFixed(2) : "—"} />
        </div>

        {/* Najbliższe terminy */}
          <div className="mt-4">
          <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
            <b>{t('upcomingTitle')}</b>
            {upcoming.length === 0 ? (
              <div className="mt-2 text-sm text-slate-600">{t('none')}</div>
            ) : (
              <div className="mt-2 grid gap-2">
                {upcoming.map((a) => (
                  <div key={a.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="font-semibold">{toAscii(a.title)}</div>
                    <div className="text-xs text-slate-600">
                      {t('table_teacher')}: <b>{toAscii(a.teacherName || t('table_teacher'))}</b>
                      {" • "}{t('table_due')}: {fmtDateSafe(effectiveDue(a))} ({timeLeftLabel(effectiveDue(a))})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Postęp wg zadań + paginacja */}
        <section className="mt-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <b>Najnowsze aktywności</b>
            {progressSorted.length > 0 && (
              <Pagination
                page={page}
                totalPages={totalPages}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              />
            )}
          </div>

          <div className="mt-2 overflow-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left">{t('table_task')}</th>
                  <th className="px-3 py-2 text-left">{t('table_teacher')}</th>
                  <th className="px-3 py-2 text-left">{t('table_status')}</th>
                  <th className="px-3 py-2 text-left">{t('table_change')}</th>
                  <th className="px-3 py-2 text-left">{t('table_due')}</th>
                  <th className="px-3 py-2 text-left">{t('table_score')}</th>
                  <th className="px-3 py-2 text-left">{t('table_comment')}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-2" colSpan={7}>{t('none')}</td>
                  </tr>
                ) : (
                  pageRows.map((r) => (
                    <tr key={r.a.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">{toAscii(r.a.title)}</td>
                      <td className="px-3 py-2">{toAscii(r.a.teacherName || "Nauczyciel")}</td>
                      <td className="px-3 py-2">
                        {r.status === "OVERDUE" ? (
                          <span className="rounded-full bg-rose-100 px-2 py-[2px] text-rose-700">po terminie</span>
                        ) : (
                          toAscii(r.status)
                        )}
                      </td>
                      <td className="px-3 py-2">{r.changeAt ? fmtDateSafe(r.changeAt) : "—"}</td>
                      <td className="px-3 py-2">{r.due ? fmtDateSafe(r.due) : "—"}</td>
                      <td className="px-3 py-2">{toAscii(r.score ?? "-")}</td>
                      <td className="px-3 py-2">{toAscii(r.reviewNote ?? "")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {progressSorted.length > 0 && (
            <div className="mt-2 flex justify-end">
              <Pagination
                page={page}
                totalPages={totalPages}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              />
            </div>
          )}
        </section>

        {/* Ostatnio ocenione (TOP 5) */}
        <section className="mt-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <b>Ostatnio ocenione</b>
          {allGradedSorted.length === 0 ? (
            <div className="mt-2 text-sm text-slate-600">(brak)</div>
          ) : (
            <div className="mt-2 grid gap-2">
              {allGradedSorted.slice(0, 5).map((s) => {
                const a = aById[String(s.assignmentId)];
                return (
                  <div key={s.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="font-semibold">{toAscii(a?.title || `Zadanie #${s.assignmentId}`)}</div>
                    <div className="text-xs text-slate-600">
                      Nauczyciel: <b>{toAscii(a?.teacherName || "Nauczyciel")}</b>
                      {" • "}Wysłane: {s.createdAt ? new Date(s.createdAt).toLocaleString() : "—"}
                    </div>
                    <div className="mt-1">
                      Ocena: <b>{toAscii(s.score ?? "-")}</b>
                      {s.reviewNote && <> • Komentarz: <i>{toAscii(s.reviewNote)}</i></>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* --- UI mini --- */
function KpiCard({ title, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-xs text-slate-600">{toAscii(title)}</div>
      <div className="mt-1 text-[22px] font-black text-slate-900">{value}</div>
    </div>
  );
}

function Pagination({ page, totalPages, onPrev, onNext }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        onClick={onPrev}
        disabled={page <= 1}
        className={`rounded-lg border px-2 py-1 ${
          page <= 1 ? "cursor-not-allowed border-slate-200 text-slate-400" : "border-slate-300 hover:bg-slate-50"
        }`}
        aria-label={t('pagination_prev')}
      >
        {t('pagination_prev')}
      </button>
      <span className="px-2 py-1 text-slate-700">
        {t('pagination_label')} <b>{page}</b> {"z"} <b>{totalPages}</b>
      </span>
      <button
        onClick={onNext}
        disabled={page >= totalPages}
        className={`rounded-lg border px-2 py-1 ${
          page >= totalPages ? "cursor-not-allowed border-slate-200 text-slate-400" : "border-slate-300 hover:bg-slate-50"
        }`}
        aria-label={t('pagination_next')}
      >
        {t('pagination_next')}
      </button>
    </div>
  );
}
