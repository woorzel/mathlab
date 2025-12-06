// src/pages/StudentGrades.jsx
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api";
import StudentNav from "../components/StudentNav";
import { makeT } from "../i18n";
const t = makeT('StudentGrades');

import ascii2mathml from "ascii2mathml";
import katex from "katex";
import "katex/dist/katex.min.css";

const SEP = "\n---\n";

/* ---------- Renderery matematyki ---------- */

// AsciiMath → MathML (bezpiecznie)
function renderAsciiMathSafe(txtRaw) {
  const txt = String(txtRaw || "");
  if (!txt.trim()) return t('none');
  try {
    return ascii2mathml(txt, { standalone: false });
  } catch {
    return `<pre style="white-space:pre-wrap;margin:0">${escapeHtml(txt)}</pre>`;
  }
}

// Zdejmowanie delimiterów i wykrywanie inline/display dla TeX
function parseTeXInput(raw) {
  const s = String(raw || "").trim();
  if ((s.startsWith("\\[") && s.endsWith("\\]")) || (s.startsWith("$$") && s.endsWith("$$"))) {
    return {
      tex: s.replace(/^\s*\\\[/, "").replace(/\\\]\s*$/, "").replace(/^\s*\$\$/, "").replace(/\$\$\s*$/, "").trim(),
      display: true,
    };
  }
  if ((s.startsWith("\\(") && s.endsWith("\\)")) || (s.startsWith("$") && s.endsWith("$"))) {
    return {
      tex: s.replace(/^\s*\\\(/, "").replace(/\\\)\s*$/, "").replace(/^\s*\$/, "").replace(/\$\s*$/, "").trim(),
      display: false,
    };
  }
  return { tex: s, display: true };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

/** Wspólny renderer: ASCIIMATH → MathML, MARKDOWN_TEX → KaTeX */
function renderTeacherBlock(text, format) {
  const txt = String(text || "");
  if (!txt.trim()) return t('none');
  const fmt = (format || "ASCIIMATH").toUpperCase();

  if (fmt === "ASCIIMATH") {
    return renderAsciiMathSafe(txt);
  }
  // TeX/LaTeX
  try {
    const { tex, display } = parseTeXInput(txt);
    return katex.renderToString(tex, {
      throwOnError: false,
      displayMode: display,
      output: "htmlAndMathml",
      strict: "warn",
      trust: false,
    });
  } catch {
    return `<pre style="white-space:pre-wrap;margin:0">${escapeHtml(txt)}</pre>`;
  }
}

/* ---------- Komponent ---------- */

export default function StudentGrades({ auth }) {
  const [subs, setSubs] = useState([]);
  const [assignmentsById, setAssignmentsById] = useState({});
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const [openRows, setOpenRows] = useState(() => new Set());
  // sort & filters
  const [sortKey, setSortKey] = useState("newest"); // newest | oldest | best | worst | title
  const [query, setQuery] = useState("");
  const [onlyNew, setOnlyNew] = useState(false);
  const [onlyWithComment, setOnlyWithComment] = useState(false);
  // pagination
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // „przeczytane”
  const seenKey = `seenGrades:${auth?.userId ?? "anon"}`;
  const [seen, setSeen] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(seenKey) || "[]"));
    } catch {
      return new Set();
    }
  });
  function markSeen(id) {
    const next = new Set(seen);
    next.add(String(id));
    setSeen(next);
    localStorage.setItem(seenKey, JSON.stringify([...next]));
  }

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const [aList, sList] = await Promise.all([
        apiGet(`/api/assignments/assigned?studentId=${auth?.userId}`, auth?.token),
        apiGet(`/api/submissions?studentId=${auth?.userId}`, auth?.token),
      ]);

      const amap = {};
      (aList || []).forEach((a) => (amap[String(a.id)] = a));
      setAssignmentsById(amap);

      // Pokaż tylko NAJNOWSZE zgłoszenie per zadanie i tylko jeśli jest GRADED.
      // Dzięki temu po cofnięciu do DRAFT (retake) zadanie znika z listy ocen.
      const latestByA = {};
      for (const s of (sList || [])) {
        const key = String(s.assignmentId);
        const curr = latestByA[key];
        if (!curr || (Number(s.id || 0) > Number(curr.id || 0))) {
          latestByA[key] = s;
        }
      }
      const latestGraded = Object.values(latestByA).filter((s) => s.status === "GRADED");
      latestGraded.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setSubs(latestGraded);
    } catch (e) {
      setMsg(t('fetchError') + (e?.message || e));
      setSubs([]);
      setAssignmentsById({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [auth?.userId, auth?.token]);

  function toggleDetails(subId) {
    const id = String(subId);
    const next = new Set(openRows);
    next.has(id) ? next.delete(id) : next.add(id);
    setOpenRows(next);
  }

  const rows = useMemo(() => {
    let r = subs ? [...subs] : [];

    // apply filters
    if (onlyNew) {
      r = r.filter((s) => !seen.has(String(s.id)));
    }
    if (onlyWithComment) {
      r = r.filter((s) => !!String(s.reviewNote || "").trim());
    }
    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter((s) => {
        const a = assignmentsById[String(s.assignmentId)] || {};
        const title = String(a.title || t('taskFallback')).toLowerCase();
        const teacher = String(a.teacherName || t('teacherLabel')).toLowerCase();
        const note = String(s.reviewNote || "").toLowerCase();
        return (
          title.includes(q) || teacher.includes(q) || note.includes(q)
        );
      });
    }

    // sorting
    const cmpDateAsc = (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    const cmpDateDesc = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    const toNum = (x) => (x == null || x === "" ? NaN : Number(x));
    if (sortKey === "oldest") r.sort(cmpDateAsc);
    else if (sortKey === "best") {
      r.sort((a, b) => {
        const as = toNum(a.score);
        const bs = toNum(b.score);
        if (isNaN(as) && isNaN(bs)) return cmpDateDesc(a, b);
        if (isNaN(as)) return 1;
        if (isNaN(bs)) return -1;
        if (bs !== as) return bs - as;
        return cmpDateDesc(a, b);
      });
    } else if (sortKey === "worst") {
      r.sort((a, b) => {
        const as = toNum(a.score);
        const bs = toNum(b.score);
        if (isNaN(as) && isNaN(bs)) return cmpDateAsc(a, b);
        if (isNaN(as)) return -1; // no score first for worst
        if (isNaN(bs)) return 1;
        if (as !== bs) return as - bs;
        return cmpDateAsc(a, b);
      });
    } else if (sortKey === "title") {
      r.sort((a, b) => {
        const aa = assignmentsById[String(a.assignmentId)] || {};
        const bb = assignmentsById[String(b.assignmentId)] || {};
        const ta = String(aa.title || t('taskFallback')).toLowerCase();
        const tb = String(bb.title || t('taskFallback')).toLowerCase();
        if (ta < tb) return -1;
        if (ta > tb) return 1;
        return cmpDateDesc(a, b);
      });
    } else {
      r.sort(cmpDateDesc); // newest
    }

    return r;
  }, [subs, assignmentsById, sortKey, query, onlyNew, onlyWithComment, seen]);

  // derive paginated slice
  const paged = useMemo(() => {
    const total = rows.length;
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    const currPage = Math.min(page, maxPage);
    const start = (currPage - 1) * pageSize;
    const end = start + pageSize;
    return {
      slice: rows.slice(start, end),
      total,
      maxPage,
      page: currPage,
    };
  }, [rows, pageSize, page]);

  function clearFilters() {
    setQuery("");
    setOnlyNew(false);
    setOnlyWithComment(false);
    setSortKey("newest");
    setPage(1);
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

        {/* LISTA OCEN */}
        <section className="mt-6 overflow-hidden rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          {/* Toolbar sort/filter */}
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor="grades-search">
                {t('searchPlaceholder')}
              </label>
              <input
                id="grades-search"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder={t('searchPlaceholder')}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor="grades-sort">
                  {t('sortLabel')}
                </label>
                <select
                  id="grades-sort"
                  value={sortKey}
                  onChange={(e) => { setSortKey(e.target.value); setPage(1); }}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                >
                  <option value="newest">{t('sortNewest')}</option>
                  <option value="oldest">{t('sortOldest')}</option>
                  <option value="best">{t('sortBest')}</option>
                  <option value="worst">{t('sortWorst')}</option>
                  <option value="title">{t('sortTitleAZ')}</option>
                </select>
              </div>
              <div className="flex flex-col justify-end gap-1">
                <label className="text-xs font-semibold text-slate-600">{t('filtersLabel')}</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setOnlyNew((v) => !v); setPage(1); }}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
                      onlyNew
                        ? 'bg-emerald-600 text-white ring-emerald-600'
                        : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
                    }`}
                    aria-pressed={onlyNew}
                  >
                    {t('onlyNewToggle')}
                  </button>
                  <button
                    onClick={() => { setOnlyWithComment((v) => !v); setPage(1); }}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
                      onlyWithComment
                        ? 'bg-indigo-600 text-white ring-indigo-600'
                        : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
                    }`}
                    aria-pressed={onlyWithComment}
                  >
                    {t('onlyWithCommentToggle')}
                  </button>
                  {(query || onlyNew || onlyWithComment || sortKey !== 'newest') && (
                    <button
                      onClick={clearFilters}
                      className="rounded-full px-3 py-1 text-xs font-semibold ring-1 transition bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
                    >
                      {t('clearFilters')}
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor="page-size">
                  {t('itemsPerPage')}
                </label>
                <select
                  id="page-size"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                >
                  {[5,10,20,50].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </div>
          {/* Pagination info */}
          {!loading && rows.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <div>
                {t('pageOf', paged.page, paged.maxPage)} • {paged.total} / {pageSize} {t('itemsPerPage').toLowerCase()}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={paged.page === 1}
                  className={`rounded-lg px-2 py-1 text-xs font-semibold ring-1 transition ${paged.page === 1 ? 'opacity-40 cursor-not-allowed bg-white text-slate-400 ring-slate-200' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'}`}
                >
                  {t('prev')}
                </button>
                <button
                  onClick={() => setPage(p => Math.min(paged.maxPage, p + 1))}
                  disabled={paged.page === paged.maxPage}
                  className={`rounded-lg px-2 py-1 text-xs font-semibold ring-1 transition ${paged.page === paged.maxPage ? 'opacity-40 cursor-not-allowed bg-white text-slate-400 ring-slate-200' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'}`}
                >
                  {t('next')}
                </button>
              </div>
            </div>
          )}
          {loading ? (
            <div className="p-3 text-sm text-slate-600">{t('loading')}</div>
          ) : rows.length === 0 ? (
            <div className="p-3 text-sm text-slate-600">{t('noData')}</div>
          ) : (
            paged.slice.map((s) => {
              const a = assignmentsById[String(s.assignmentId)] || null;
              const isNew = !seen.has(String(s.id));
              const isOpen = openRows.has(String(s.id));

              const title = a?.title || t('taskFallback');
              const teacher = a?.teacherName || t('teacherLabel');
              const due = a?.dueAt ? new Date(a.dueAt).toLocaleString() : null;
              const description = (a?.description || "").trim();
              const teacherFormat = (a?.problemFormat || "ASCIIMATH").toUpperCase();

              // ► rozbij treść nauczyciela i odpowiedź ucznia na przykłady (1:1)
              const teacherRaw = String(a?.problemContent || "");
              const ansRaw = String(s?.textAnswer || "");

              const teacherParts = (teacherRaw ? teacherRaw.split(SEP) : []).map((t) => t.trim()).filter(Boolean);
              let answerParts = ansRaw ? ansRaw.split(SEP) : [];

              if (teacherParts.length) {
                const out = [...answerParts];
                while (out.length < teacherParts.length) out.push("");
                if (out.length > teacherParts.length) out.length = teacherParts.length;
                answerParts = out;
              } else {
                // jeśli nauczyciel nie podał przykładów, pokazujemy jedną sekcję
                teacherParts.push(teacherRaw);
                answerParts = [ansRaw];
              }

              return (
                <div key={s.id} className="border-b border-slate-100 p-3 last:border-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold text-slate-900">{title}</div>
                    {isNew && (
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">
                        {t('newBadge')}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 text-xs text-slate-600">
                    {t('teacherLabel')}: <b>{teacher}</b>
                    {due && <> • {t('dueLabel')}: {due}</>}
                  </div>

                  {description && (
                    <div className="mt-1 text-[13px]">
                      <span className="text-slate-600">{t('descriptionLabel')}</span> <span className="text-slate-900">{description}</span>
                    </div>
                  )}

                  <div className="mt-2 text-sm">
                    {t('gradeLabel')} <b>{s.score ?? "-"}</b>
                    {s.reviewNote && (
                      <>
                        {" "}• {t('commentLabel')} <i>{s.reviewNote}</i>
                      </>
                    )}
                  </div>

                  <div className="mt-1 text-xs text-slate-600">
                    {t('sentAtLabel')} {s.createdAt ? new Date(s.createdAt).toLocaleString() : "—"}
                  </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => toggleDetails(s.id)}
                      className="rounded-xl border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-800 hover:bg-slate-50 active:scale-[0.99]"
                    >
                      {isOpen ? t('hideDetails') : t('showDetails')}
                    </button>
                    {isNew && (
                      <button
                        onClick={() => markSeen(s.id)}
                        className="rounded-xl border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-800 hover:bg-slate-50 active:scale-[0.99]"
                      >
                        {t('markRead')}
                      </button>
                    )}
                  </div>

                  {isOpen && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex flex-col gap-3">
                        {teacherParts.map((tp, idx) => {
                          const ap = answerParts[idx] ?? "";
                          return (
                            <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3">
                              <div className="mb-2 font-semibold">{t('exampleLabel', idx + 1)}</div>

                              <div className="grid gap-3 md:grid-cols-2">
                                {/* lewa: treść/obliczenia od nauczyciela (AsciiMath lub TeX) */}
                                <div>
                                  <div className="mb-1 flex items-center gap-2">
                                    <span title={t('teacherContentLabel', teacherFormat === "ASCIIMATH" ? "AsciiMath" : "TeX")}>📘</span>
                                    <div className="text-xs text-slate-600">
                                      {t('teacherContentLabel', teacherFormat === "ASCIIMATH" ? "AsciiMath" : "TeX")}
                                    </div>
                                  </div>
                                  <div
                                    className="rounded-lg border border-slate-200 bg-white p-3 [&_.katex-html]:text-slate-900"
                                    dangerouslySetInnerHTML={{ __html: renderTeacherBlock(tp, teacherFormat) }}
                                  />
                                </div>

                                {/* prawa: odpowiedź ucznia (AsciiMath) */}
                                <div>
                                  <div className="mb-1 flex items-center gap-2">
                                    <span title={t('yourAnswerLabel')}>✍️</span>
                                    <div className="text-xs text-slate-600">{t('yourAnswerLabel')}</div>
                                  </div>
                                  <div
                                    className="rounded-lg border border-slate-200 bg-white p-3 [&_.katex-html]:text-slate-900"
                                    dangerouslySetInnerHTML={{ __html: renderAsciiMathSafe(ap) }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>

        {msg && (
          <div className={[
            "mt-3 rounded-xl px-3 py-2 text-sm ring-1",
            msg.startsWith(t('errorPrefix')) ? "bg-rose-50 text-rose-800 ring-1 ring-rose-200" : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
          ].join(" ")}>
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}
