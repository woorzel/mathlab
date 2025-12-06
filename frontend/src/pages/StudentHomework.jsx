// src/pages/StudentHomework.jsx
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut } from "../api";
import ascii2mathml from "ascii2mathml";
import katex from "katex";
import "katex/dist/katex.min.css";
import StudentNav from "../components/StudentNav";
import { makeT } from "../i18n";
const t = makeT("StudentHomework");
const tA = makeT("TeacherAssignments");

const SEP = "\n---\n";

/* ===========================
   Helpery
   =========================== */

function fmtDateSafe(v) {
  if (!v) return null;
  try {
    const d =
      v instanceof Date
        ? v
        : typeof v === "number"
        ? new Date(v)
        : typeof v === "string"
        ? new Date(v)
        : null;
    if (!d || isNaN(d.getTime())) return String(v);
    return d.toLocaleString();
  } catch {
    return String(v);
  }
}

function isPast(iso) {
  if (!iso) return false;
  try {
    return new Date(iso).getTime() < Date.now();
  } catch {
    return false;
  }
}

/* ===========================
   Renderery matematyki
   =========================== */

function parseTeXInput(raw) {
  const s = String(raw || "").trim();
  if (
    (s.startsWith("\\[") && s.endsWith("\\]")) ||
    (s.startsWith("$$") && s.endsWith("$$"))
  ) {
    return {
      tex: s
        .replace(/^\s*\\\[/, "")
        .replace(/\\\]\s*$/, "")
        .replace(/^\s*\$\$/, "")
        .replace(/\$\$\s*$/, "")
        .trim(),
      display: true,
    };
  }
  if (
    (s.startsWith("\\(") && s.endsWith("\\)")) ||
    (s.startsWith("$") && s.endsWith("$"))
  ) {
    return {
      tex: s
        .replace(/^\s*\\\(/, "")
        .replace(/\\\)\s*$/, "")
        .replace(/^\s*\$/, "")
        .replace(/\$\s*$/, "")
        .trim(),
      display: false,
    };
  }
  return { tex: s, display: true };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  }[c]));
}

/** ASCIIMATH → MathML, MARKDOWN_TEX → KaTeX (HTML+MathML) */
function renderMathBlock(text, fmt) {
  const txt = String(text || "");
  if (!txt.trim()) return t("none");

  if ((fmt || "").toUpperCase() === "ASCIIMATH") {
    try {
      return ascii2mathml(txt, { standalone: false });
    } catch (err) {
      // Fallback: show escaped raw text when AsciiMath parsing fails
      return `<pre style="white-space:pre-wrap;margin:0">${escapeHtml(txt)}</pre>`;
    }
  }
  try {
    const { tex, display } = parseTeXInput(txt);
    return katex.renderToString(tex, {
      throwOnError: false,
      displayMode: display,
      output: "htmlAndMathml",
      strict: "warn",
      trust: false,
    });
  } catch (err) {
    // Fallback: show escaped raw text when TeX rendering fails
    return `<pre style="white-space:pre-wrap;margin:0">${escapeHtml(txt)}</pre>`;
  }
}

// Podgląd odpowiedzi ucznia (AsciiMath), bezpieczny
function previewForFactory(answers) {
  return function previewFor(i) {
    const text = answers[i] || "";
    if (!text.trim()) return t("none");
    try {
      return renderMathBlock(text, "ASCIIMATH");
    } catch (err) {
      return `<div style="color:#b91c1c">${t(
        "previewError"
      )}${escapeHtml(err?.message || String(err))}</div>`;
    }
  };
}

/* ===========================
   Mini-ściągawka AsciiMath
   =========================== */
function AsciiCheatSheet() {
  return (
    <div
      className="mt-2 inline-block max-w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-[12px] leading-tight"
      aria-label="Ściągawka AsciiMath"
    >
      <b>AsciiMath – skrót:</b>
      <div className="mt-1 grid grid-cols-[repeat(2,minmax(260px,1fr))] gap-x-10 gap-y-1">
        <div className="flex min-w-0 items-center gap-1">
          • Potęga: <code>x^2</code>
        </div>
        <div className="flex min-w-0 items-center gap-1">
          • Indeks: <code>x_1</code>
        </div>
        <div className="flex min-w-0 items-center gap-1">
          • Pierwiastek: <code>sqrt(x)</code>, n-ty:{" "}
          <code>root(3)(x)</code>
        </div>
        <div className="flex min-w-0 items-center gap-1">
          • Ułamek: <code>(a)/(b)</code>
        </div>
        <div className="flex min-w-0 items-center gap-1">
          • Mnożenie: <code>a*b</code>
        </div>
        <div className="flex min-w-0 items-center gap-1">
          • Funkcje: <code>sin x</code>, <code>cos(x)</code>,{" "}
          <code>ln(x)</code>
        </div>
        <div className="flex min-w-0 items-center gap-1">
          • Suma: <code>sum_(i=1)^n i</code>
        </div>
        <div className="flex min-w-0 items-center gap-1">
          • Całka: <code>int_0^1 f(x) dx</code>
        </div>
        <div className="flex min-w-0 items-center gap-1">
          • Greckie: <code>pi</code>, <code>theta</code>
        </div>
        <div className="flex min-w-0 items-center gap-1">
          • Relacje: <code>&lt;=</code>, <code>&gt;=</code>,{" "}
          <code>!=</code>
        </div>
        <div className="flex min-w-0 items-center gap-1">
          • Nawiasy: <code>( )</code>, <code>[ ]</code>,{" "}
          <code>{"{}"}</code>
        </div>
      </div>
    </div>
  );
}

/* ===========================
   Komponent główny (uczeń)
   =========================== */
export default function StudentHomework({ auth }) {
  const [assignments, setAssignments] = useState([]);
  const [subsByA, setSubsByA] = useState({});
  const [active, setActive] = useState(null);
  const [previewOnly, setPreviewOnly] = useState(false);

  // odpowiedzi ucznia (AsciiMath)
  const [answers, setAnswers] = useState([""]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function loadAll() {
    try {
      const [aList, sList] = await Promise.all([
        apiGet(
          `/api/assignments/assigned?studentId=${auth.userId}`,
          auth.token
        ),
        apiGet(`/api/submissions?studentId=${auth.userId}`, auth.token),
      ]);
      setAssignments(aList || []);

      // Wybierz NAJnowsze zgłoszenie per zadanie (priorytet DRAFT > SUBMITTED > GRADED)
      const map = {};
      const rank = (st) =>
        st === "DRAFT"
          ? 3
          : st === "SUBMITTED"
          ? 2
          : st === "GRADED"
          ? 1
          : 0;
      for (const s of sList || []) {
        const key = String(s.assignmentId);
        const curr = map[key];
        if (!curr) {
          map[key] = s;
          continue;
        }
        const rNew = rank(s.status);
        const rOld = rank(curr.status);
        if (
          rNew > rOld ||
          (rNew === rOld &&
            Number(s.id || 0) > Number(curr.id || 0))
        ) {
          map[key] = s;
        }
      }

      // >>> NOWOŚĆ: auto-SUBMITTED dla nie rozpoczętych zadań po terminie
      for (const a of aList || []) {
        const key = String(a.id);
        const due = a.studentDueAt;
        if (!map[key] && due && isPast(due)) {
          map[key] = {
            id: `virtual-${a.id}-${auth.userId}`,
            assignmentId: a.id,
            studentId: auth.userId,
            status: "SUBMITTED",
            textAnswer: "",
            _virtual: true,
          };
        }
      }

      setSubsByA(map);

      // reset/aktualizacja aktywnej pracy
      if (active && map[String(active)]?.status === "GRADED") {
        setActive(null);
        setPreviewOnly(false);
        setAnswers([""]);
      } else if (active && map[String(active)]) {
        const sub = map[String(active)];
        const parts = String(sub?.textAnswer || "").split(SEP);
        setAnswers(parts.length ? parts : [""]);
      }
    } catch (e) {
      setMsg(t("fetchError") + (e.message || e));
    }
  }

  useEffect(() => {
    loadAll();
    const timer = setInterval(loadAll, 10000);
    return () => clearInterval(timer);
    // eslint-disable-next-line
  }, []);

  // ── Lista przykładów od nauczyciela
  const teacherSamples = useMemo(() => {
    const a = active
      ? assignments.find((x) => x.id === active)
      : null;
    const raw = String(a?.problemContent || "");
    return raw.split(SEP).map((s) => s.trim()).filter(Boolean);
  }, [assignments, active]);

  const activeAssignment = active
    ? assignments.find((a) => a.id === active)
    : null;
  const teacherFmt = (
    activeAssignment?.problemFormat || "ASCIIMATH"
  ).toUpperCase();
  const currentSub = active ? subsByA[String(active)] : null;

  // dopasuj liczbę pól odpowiedzi do liczby przykładów (min. 1)
  useEffect(() => {
    const n = Math.max(1, teacherSamples.length || 1);
    setAnswers((prev) => {
      const copy = [...prev];
      while (copy.length < n) copy.push("");
      if (copy.length > n) copy.length = n;
      return copy;
    });
  }, [teacherSamples.length]);

  const afterDue =
    !!activeAssignment?.studentDueAt &&
    isPast(activeAssignment.studentDueAt);
  const locked =
    afterDue ||
    (!currentSub && previewOnly) ||
    (!!currentSub &&
      (currentSub.status === "SUBMITTED" ||
        currentSub.status === "GRADED"));

  function openAssignment(a, { readonlyIfNotStarted = true } = {}) {
    setActive(a.id);
    const sub = subsByA[String(a.id)];
    if (sub) {
      setPreviewOnly(false);
      const parts = String(sub.textAnswer || "").split(SEP);
      setAnswers(parts.length ? parts : [""]);
    } else {
      setPreviewOnly(!!readonlyIfNotStarted);
      setAnswers([""]);
    }
  }

  async function startWork(assignmentId) {
    setMsg("");
    try {
      const s = await apiPost(
        `/api/submissions/start`,
        { assignmentId, studentId: auth.userId, textAnswer: "" },
        auth.token
      );
      setSubsByA((prev) => ({
        ...prev,
        [String(assignmentId)]: s,
      }));
      setActive(assignmentId);
      setPreviewOnly(false);
      setAnswers([""]);
      if (s.status === "SUBMITTED") {
        setMsg(t("autoSubmittedDue"));
      }
    } catch (e) {
      setMsg(t("startFailed") + (e.message || e));
    }
  }

  async function submitForReview() {
    if (!active) return;
    const sub = subsByA[String(active)];
    if (!sub) return;
    if (sub.status === "SUBMITTED" || sub.status === "GRADED") {
      setMsg(t("submitSuccess"));
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const payload = (answers || []).join(SEP);
      const upd = await apiPut(
        `/api/submissions/${sub.id}`,
        { textAnswer: payload, status: "SUBMITTED" },
        auth.token
      );
      setSubsByA((prev) => ({ ...prev, [String(active)]: upd }));
      setMsg(t("submitSuccess"));
    } catch (e) {
      setMsg(t("submitError") + (e.message || e));
    } finally {
      setSaving(false);
    }
  }

  const previewFor = useMemo(
    () => previewForFactory(answers),
    [answers]
  );

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
                <h1 className="text-3xl font-black tracking-tight text-slate-900">
                  {t("title")}
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  {t("heroDesc")}
                </p>
              </div>
              <div className="flex justify-start gap-2 md:justify-end">
                <span className="rounded-full bg-sky-600/10 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
                  {t("panelBadge")}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Dwie kolumny */}
        <div className="mt-6 grid gap-4 md:grid-cols-[380px_1fr]">
          {/* LEWA – lista zadań */}
          <section className="rounded-2xl bg-white/90 p-3 shadow-sm ring-1 ring-slate-200">
            <b className="block px-1">{t("myAssignments")}</b>
            <div className="mt-2 max-h-[70vh] overflow-auto rounded-xl border border-slate-200">
              {assignments.filter((a) => {
                const sub = subsByA[String(a.id)];
                return !(sub && sub.status === "GRADED");
              }).length === 0 ? (
                <div className="p-3 text-sm text-slate-600">
                  {t("noAssignments")}
                </div>
              ) : (
                assignments
                  .filter((a) => {
                    const sub = subsByA[String(a.id)];
                    return !(sub && sub.status === "GRADED");
                  })
                  .map((a) => {
                    const sub = subsByA[String(a.id)];
                    const isActive = active === a.id;
                    const past = isPast(a.studentDueAt);
                    return (
                      <div
                        key={a.id}
                        className={[
                          "border-b border-slate-100 px-3 py-2 transition",
                          isActive
                            ? "bg-slate-50 ring-sky-400 ring-offset-0"
                            : "",
                        ].join(" ")}
                      >
                        <div className="font-semibold">
                          {a.title}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-600">
                          {t("teacherLabel")}:{" "}
                          <b>
                            {a.teacherName || t("teacherLabel")}
                          </b>
                          {a.studentDueAt && (
                            <>
                              {" "}
                              • {t("dueLabel")}:{" "}
                              {fmtDateSafe(a.studentDueAt)}
                            </>
                          )}
                          {past && (
                            <span className="ml-1 rounded-full bg-rose-100 px-2 py-[2px] text-rose-700">
                              {t("overdueBadge")}
                            </span>
                          )}
                        </div>
                        {a.description && (
                          <div className="mt-1 text-[13px] text-slate-800">
                            <span className="text-slate-600">
                              {t("descriptionLabel")}
                            </span>{" "}
                            {a.description}
                          </div>
                        )}

                        {sub ? (
                          <div className="mt-1 text-sm">
                            {t("statusLabel")}:{" "}
                            <b>{sub.status || "DRAFT"}</b>
                            {sub.status === "SUBMITTED" && (
                              <div className="mt-1 text-xs text-slate-500">
                                {t("submitSuccess")}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-1 text-sm text-slate-600">
                            {!past
                              ? t("notStarted")
                              : t("pastOnlyPreview")}
                          </div>
                        )}

                        <div className="mt-2 flex flex-wrap gap-2">
                          {!sub && (
                            <>
                              <button
                                onClick={() => startWork(a.id)}
                                disabled={past}
                                className={`rounded-xl border px-3 py-1 text-sm font-semibold active:scale-[0.99] ${
                                  past
                                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                                    : "border-slate-900 bg-slate-900 text-slate-50 hover:opacity-95"
                                }`}
                              >
                                {t("startBtn")}
                              </button>
                              <button
                                onClick={() =>
                                  openAssignment(a, {
                                    readonlyIfNotStarted: true,
                                  })
                                }
                                className="rounded-xl border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-800 hover:bg-slate-50 active:scale-[0.99]"
                              >
                                {t("openPreviewBtn")}
                              </button>
                            </>
                          )}
                          {sub && sub.status !== "GRADED" && (
                            <button
                              onClick={() => openAssignment(a)}
                              className="rounded-xl border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-800 hover:bg-slate-50 active:scale-[0.99]"
                            >
                              {t("openBtn")}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </section>

          {/* PRAWA – praca nad zadaniem */}
          <section className="rounded-2xl bg-white/90 p-3 shadow-sm ring-1 ring-slate-200">
            <b className="block px-1">{t("workingTitle")}</b>

            {!activeAssignment ? (
              <div className="mt-2 px-1 text-sm text-slate-600">
                {t("noActiveNotice")}
              </div>
            ) : (
              <>
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="font-semibold">
                    {t("solvingPrefix")} {activeAssignment.title}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-600">
                    {t("teacherLabel")}:{" "}
                    <b>
                      {activeAssignment.teacherName ||
                        t("teacherLabel")}
                    </b>
                    {activeAssignment.studentDueAt && (
                      <>
                        {" "}
                        • {t("dueLabel")}:{" "}
                        {fmtDateSafe(activeAssignment.studentDueAt)}
                      </>
                    )}
                    {afterDue && (
                      <span className="ml-1 rounded-full bg-rose-100 px-2 py-[2px] text-rose-700">
                        {t("overdueBadge")}
                      </span>
                    )}
                  </div>
                  {activeAssignment.description && (
                    <div className="mt-1 text-[13px]">
                      <span className="text-slate-600">
                        Opis:
                      </span>{" "}
                      {activeAssignment.description}
                    </div>
                  )}
                </div>

                {/* ► PRZYKŁAD → ODPOWIEDŹ → PODGLĄD (min. 1 blok) */}
                <div className="mt-3 flex flex-col gap-3">
                  {(teacherSamples.length
                    ? teacherSamples
                    : [""]
                  ).map((teacherExpr, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-200 p-3"
                    >
                      <div className="mb-1 font-semibold">
                        {teacherExpr?.trim()
                          ? t("exampleLabel", i + 1)
                          : `${t(
                              "teacherContentTitle"
                            )} — ${t("none")}`}
                      </div>

                      {!!teacherExpr?.trim() && (
                        <div
                          className="rounded-lg border border-slate-200 bg-white p-3"
                          dangerouslySetInnerHTML={{
                            __html: renderMathBlock(
                              teacherExpr,
                              teacherFmt
                            ),
                          }}
                        />
                      )}

                      <div className="mt-3 font-semibold">
                        {teacherSamples.length > 1
                          ? `${t(
                              "yourAnswerLabel"
                            )} — ${t("exampleLabel", i + 1)}`
                          : t("yourAnswerLabel")}
                      </div>
                      <textarea
                        value={answers[i] || ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAnswers((prev) => {
                            const copy = [...prev];
                            copy[i] = v;
                            return copy;
                          });
                        }}
                        rows={6}
                        placeholder={
                          locked && afterDue && (!currentSub || previewOnly)
                            ? t("deadlinePassedCannotSubmit")
                            : teacherExpr?.trim()
                            ? t("answerPlaceholderExample")
                            : t("answerPlaceholderNoExample")
                        }
                        disabled={locked}
                        className={[
                          "mt-1 w-full rounded-xl border px-3 py-2 text-[15px]",
                          locked
                            ? "border-slate-200 bg-slate-50 opacity-80"
                            : "border-slate-300 bg-white",
                        ].join(" ")}
                      />

                      <div className="mt-2">
                        <div className="mb-1 text-xs text-slate-600">
                          {t("previewLabel")}
                        </div>
                        <div
                          className="min-h-12 rounded-xl border border-slate-200 bg-white p-3"
                          dangerouslySetInnerHTML={{
                            __html: previewFor(i),
                          }}
                        />
                      </div>
                    </div>
                  ))}

                  <AsciiCheatSheet />

                  <div className="mt-1 flex flex-wrap gap-2">
                    <button
                      onClick={submitForReview}
                      disabled={saving || locked}
                      title={
                        !currentSub && previewOnly
                          ? t("startBtn")
                          : undefined
                      }
                      className={[
                        "rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-[0.99]",
                        "border border-slate-900 bg-slate-900 text-white",
                        saving || locked
                          ? "opacity-70 cursor-not-allowed"
                          : "hover:opacity-95",
                      ].join(" ")}
                    >
                      {t("sendForReviewBtn")}
                    </button>
                    {previewOnly && (
                      <div
                        className="text-xs text-amber-400 flex items-center"
                        role="status"
                        aria-live="polite"
                      >
                        {t("deadlinePassedCannotSubmit")}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {msg && (
              <div
                className={[
                  "mt-3 rounded-xl px-3 py-2 text-sm ring-1",
                  msg.startsWith(t("errorPrefix"))
                    ? "bg-rose-50 text-rose-800 ring-rose-200"
                    : "bg-emerald-50 text-emerald-800 ring-emerald-200",
                ].join(" ")}
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
