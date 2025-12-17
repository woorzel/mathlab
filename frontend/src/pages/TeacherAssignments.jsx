// src/pages/TeacherAssignments.jsx
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "../api";
import ascii2mathml from "ascii2mathml";
import katex from "katex";
import "katex/dist/katex.min.css";
import TeacherNav from "../components/TeacherNav.jsx";

const SEP = "\n---\n";
const DF_KEY = "prefs-defaultFormat"; // zapis z TeacherSettings: "ASCIIMATH" | "TEX"

import { makeT } from "../i18n";
const t = makeT('TeacherAssignments');

/** Zwraca format używany w tym komponencie: "ASCIIMATH" | "MARKDOWN_TEX" */
function getDefaultProbFmt() {
  try {
    const stored = localStorage.getItem(DF_KEY);
    // TeacherSettings zapisuje "ASCIIMATH" lub "TEX"
    if (stored === "ASCIIMATH") return "ASCIIMATH";
    if (stored === "TEX") return "MARKDOWN_TEX";
    // domyślnie ASCIIMATH
    return "ASCIIMATH";
  } catch {
    return "ASCIIMATH";
  }
}

/* ========== Math helpers ========== */
function parseTeXInput(raw) {
  const s = String(raw || "").trim();
  if ((s.startsWith("\\[") && s.endsWith("\\]")) || (s.startsWith("$$") && s.endsWith("$$"))) {
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
  if ((s.startsWith("\\(") && s.endsWith("\\)")) || (s.startsWith("$") && s.endsWith("$"))) {
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
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function renderMathBlock(text, fmt) {
  const txt = String(text || "");
  if (!txt.trim()) return `<em>${t("none")}</em>`;
  if (fmt === "ASCIIMATH") {
    try {
      return ascii2mathml(txt, { standalone: false });
    } catch {
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
  } catch {
    return `<pre style="white-space:pre-wrap;margin:0">${escapeHtml(txt)}</pre>`;
  }
}

/* ========== Ściągawka (statyczne klasy) ========== */
function CheatSheetBox({ fmt }) {
  const isAscii = fmt === "ASCIIMATH";
  const box = [
    "text-xs leading-snug rounded-xl px-3 py-2 bg-white/90 shadow-sm ring-1 backdrop-blur-[1px]",
    isAscii ? "ring-emerald-100" : "ring-indigo-100",
  ].join(" ");
  const grid = "grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 mt-1";
  const item = "flex items-center gap-1 min-w-0";
  return (
    <div className={box} aria-label={isAscii ? t("cheatsheetAsciiAria") : t("cheatsheetTexAria")}>
      <b className="text-slate-800">{isAscii ? t("asciiShort") : t("texShort")}</b>
      <div className={grid}>
        {isAscii ? (
          <>
            <div className={item}>• {t("pow")}<code>x^2</code></div>
            <div className={item}>• {t("sub")}<code>x_1</code></div>
            <div className={item}>• {t("sqrt")}<code>sqrt(x)</code>, <code>root(3)(x)</code></div>
            <div className={item}>• {t("frac")}<code>(a)/(b)</code></div>
            <div className={item}>• {t("mul")}<code>a*b</code></div>
            <div className={item}>• {t("funcs")}<code>sin x</code>, <code>cos(x)</code>, <code>ln(x)</code></div>
            <div className={item}>• {t("sum")}<code>sum_(i=1)^n i</code></div>
            <div className={item}>• {t("integral")}<code>int_0^1 f(x) dx</code></div>
            <div className={item}>• {t("greeks")}<code>pi</code>, <code>theta</code></div>
            <div className={item}>• {t("rel")}<code>&lt;=</code>, <code>&gt;=</code>, <code>!=</code></div>
            <div className={item}>• {t("braces")}<code>( )</code>, <code>[ ]</code>, <code>{"{}"}</code></div>
          </>
        ) : (
          <>
            <div className={item}>• Inline: <code>$ x^2 $</code></div>
            <div className={item}>• Block: <code>{String.raw`$$ \frac{a}{b} $$`}</code></div>
            <div className={item}>• {t("frac")}<code>{String.raw`\frac{a}{b}`}</code></div>
            <div className={item}>• {t("sqrt")}<code>{String.raw`\sqrt{x}`}</code>, <code>{String.raw`\sqrt[3]{x}`}</code></div>
            <div className={item}>• {t("pow")}<code>{String.raw`x^{2}`}</code></div>
            <div className={item}>• {t("sub")}<code>{String.raw`x_{1}`}</code></div>
            <div className={item}>• {t("funcs")}<code>{String.raw`\sin x`}</code>, <code>{String.raw`\cos(x)`}</code>, <code>{String.raw`\ln(x)`}</code></div>
            <div className={item}>• {t("sum")}<code>{String.raw`\sum_{i=1}^{n} i`}</code></div>
            <div className={item}>• {t("integral")}<code>{String.raw`\int_0^1 f(x)\,dx`}</code></div>
            <div className={item}>• {t("greeks")}<code>{String.raw`\pi`}</code>, <code>{String.raw`\theta`}</code></div>
            <div className={item}>• {t("rel")}<code>{String.raw`\leq`}</code>, <code>{String.raw`\geq`}</code>, <code>{String.raw`\neq`}</code></div>
            <div className={item}>• {t("braces")}<code>{String.raw`\left( ... \right)`}</code></div>
          </>
        )}
      </div>
    </div>
  );
}

/* ========== Główny komponent ========== */
export default function TeacherAssignments({ auth }) {
  const [assignments, setAssignments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // preferowany format dla NOWEGO zadania - leniwą inicjalizacją z localStorage
  const [probFmt, setProbFmt] = useState(() => getDefaultProbFmt());

  async function refresh() {
    try {
      const list = await apiGet(`/api/assignments?teacherId=${auth.userId}`, auth.token);
      const onlyMine = (list || []).filter((a) => String(a.teacherId) === String(auth.userId));
      setAssignments(onlyMine);
    } catch {
      setAssignments([]);
    }
  }

  // 1) wczytaj listę zadań
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refresh();
      } catch {
        if (alive) setAssignments([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [auth?.userId, auth?.token]);

  // NEW (bez terminu)
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [samples, setSamples] = useState([""]);
  const setSample = (idx, val) => setSamples((p) => p.map((s, i) => (i === idx ? val : s)));
  const addSample = () => setSamples((p) => [...p, ""]);
  const removeSample = (idx) => setSamples((p) => (p.length === 1 ? [""] : p.filter((_, i) => i !== idx)));
  const previewNew = useMemo(
    () => (samples || []).map((s) => renderMathBlock(s || "", probFmt)),
    [samples, probFmt]
  );

  async function create() {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      if (!title.trim()) {
        setMsg(t("needTitle"));
        return;
      }
      const a = await apiPost(
        "/api/assignments",
        { teacherId: auth.userId, title, description: desc || null },
        auth.token
      );

      const joined = (samples || []).map((s) => s ?? "").join(SEP).trim();
      if (joined) {
        await apiPost(
          "/api/problems",
          { assignmentId: a.id, authorId: auth.userId, content: joined, format: probFmt },
          auth.token
        );
      }

      await refresh();

      // reset i ponowne ustawienie formatu wg preferencji
      setTitle("");
      setDesc("");
      setSamples([""]);
      setProbFmt(getDefaultProbFmt());

  setMsg(t('addedAssignment', a.title));
    } catch (e) {
      setMsg(t("errorPrefix") + " " + (e.message || e));
    } finally {
      setBusy(false);
    }
  }

  // EDIT (bez terminu)
  const [editingId, setEditingId] = useState(null);
  const [eTitle, setETitle] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eProbFmt, setEProbFmt] = useState("MARKDOWN_TEX");
  const [eSamples, setESamples] = useState([""]);
  const setESample = (idx, val) => setESamples((p) => p.map((s, i) => (i === idx ? val : s)));
  const addESample = () => setESamples((p) => [...p, ""]);
  const removeESample = (idx) => setESamples((p) => (p.length === 1 ? [""] : p.filter((_, i) => i !== idx)));
  const previewEdit = useMemo(
    () => (eSamples || []).map((s) => renderMathBlock(s || "", eProbFmt)),
    [eSamples, eProbFmt]
  );

  function startEdit(a) {
    setEditingId(a.id);
    setETitle(a.title ?? "");
    setEDesc(a.description ?? "");
    // WAŻNE: bierz format z preferencji, nie z rekordu zadania
    setEProbFmt(getDefaultProbFmt());
    const parts = String(a.problemContent || "").split(SEP);
    setESamples(parts.length ? parts : [""]);
  }

  // Jeśli weszliśmy w tryb edycji, a user zmienił preferencję wcześniej – jeszcze raz ją zastosuj
  useEffect(() => {
    if (editingId != null) setEProbFmt(getDefaultProbFmt());
  }, [editingId]);

  async function saveEdit() {
    setMsg("");
    try {
      await apiPut(
        `/api/assignments/${editingId}`,
        {
          title: eTitle,
          description: eDesc,
          problemContent: (eSamples || []).map((s) => s ?? "").join(SEP),
          problemFormat: eProbFmt,
        },
        auth.token
      );
      setEditingId(null);
      await refresh();
      setMsg(t("updatedAssignment"));
    } catch (e) {
      setMsg(t("errorPrefix") + " " + (e.message || e));
    }
  }

  async function removeAssignment(id) {
    if (!window.confirm(t("removeConfirm"))) return;
    setMsg("");
    try {
      await apiDelete(`/api/assignments/${id}`, auth.token);
      await refresh();
      setMsg(t("deleted"));
    } catch (e) {
      setMsg(t("errorPrefix") + " " + (e.message || e));
    }
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
        <TeacherNav />

        {/* HERO */}
        <header className="mt-6 rounded-2xl bg-white/80 backdrop-blur-sm shadow-sm ring-1 ring-slate-200">
          <div className="relative overflow-hidden rounded-2xl">
            <div className="absolute inset-x-0 -top-10 h-24 bg-gradient-to-r from-sky-200/30 via-indigo-200/30 to-cyan-200/30 blur-2xl" />
            <div className="relative grid gap-2 p-6 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900">{t("title")}</h1>
                <p className="mt-1 text-sm text-slate-600">{t("heroDesc")}</p>
              </div>
              <div className="flex justify-start gap-2 md:justify-end">
                <span className="rounded-full bg-sky-600/10 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
                  {t("teacherPanel")}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* NOWE ZADANIE */}
        <section className="mt-6 overflow-hidden rounded-2xl bg-slate-50 shadow-md ring-1 ring-slate-200">
          <div className="relative border-b border-slate-200">
            <div className="h-1 w-full bg-gradient-to-r from-sky-400 via-indigo-400 to-cyan-400" />
            <div className="relative p-6 bg-gradient-to-r from-slate-50 via-sky-50 to-indigo-50">
              <h2 className="text-lg font-semibold text-slate-900">{t("newAssignment")}</h2>
              <p className="mt-1 text-sm text-slate-600">{t("fillFields")}</p>
            </div>
          </div>

          <div className="grid gap-6 p-6">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-slate-700">{t("labelTitle")}</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("exampleTitlePlaceholder")}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-slate-700">{t("descOptional")}</label>
              <textarea
                rows={3}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder={t("descPlaceholder")}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              />
            </div>

            {/* Matematyka */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-900">{t("mathOptional")}</div>
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-sky-100">
                  {probFmt === "MARKDOWN_TEX" ? t("texMarkdown") : t("asciimath")}
                </span>
              </div>

              <div className="flex flex-wrap gap-6 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    checked={probFmt === "MARKDOWN_TEX"}
                    onChange={() => setProbFmt("MARKDOWN_TEX")}
                    className="accent-sky-600"
                  />
                  {t("texMarkdown")}
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    checked={probFmt === "ASCIIMATH"}
                    onChange={() => setProbFmt("ASCIIMATH")}
                    className="accent-emerald-600"
                  />
                  {t("asciimath")}
                </label>
              </div>

              <div className="space-y-3">
                {samples.map((s, i) => (
                  <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
                      <textarea
                      rows={2}
                      placeholder={`${t("exampleLabel")} ${i + 1}`}
                      value={s}
                      onChange={(e) => setSample(i, e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                    />
                    <button
                      onClick={() => removeSample(i)}
                      className="h-fit rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100/60 active:scale-[0.98]"
                    >
                      {t("remove")}
                    </button>
                  </div>
                ))}

                <CheatSheetBox fmt={probFmt} />

                <button
                  onClick={addSample}
                  className="mt-1 w-full rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:brightness-105 active:scale-[0.98] sm:w-auto"
                >
                  {t("addExample")}
                </button>
              </div>
            </div>

            {/* Podgląd */}
            <div>
              <div className="mb-1 text-xs font-medium text-slate-700">{t("preview")}</div>
              <div className="flex flex-col gap-3">
                {previewNew.length > 0 ? (
                  previewNew.map((html, i) => (
                    <div key={i} className="min-h-12 rounded-xl border border-slate-200 bg-white/95 p-4 ring-1 ring-slate-200">
                      <div className="mb-1 text-xs text-slate-500">{`${t("exampleLabel")} ${i + 1}`}</div>
                      <div className="[&_.katex-html]:text-slate-900" dangerouslySetInnerHTML={{ __html: html }} />
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white/95 p-4 text-sm text-slate-500 ring-1 ring-slate-200">
                    <em>{t("none")}</em>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={create}
                disabled={busy}
                className="rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 px-5 py-2 font-semibold text-white shadow-md transition hover:brightness-105 active:scale-[0.99] disabled:opacity-70"
              >
                {busy ? t("creating") : t("createAssignment")}
              </button>
            </div>
          </div>
        </section>

        {/* LISTA ZADAŃ */}
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">{t("myAssignments")}</h2>

          {assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-10 text-slate-600 shadow-sm ring-1 ring-slate-200">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" className="opacity-60">
                <path d="M7 3h10a2 2 0 0 1 2 2v12.2a2 2 0 0 1-2.4 1.96L12 18.5l-4.6.66A2 2 0 0 1 5 17.2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.3" />
                <path d="M8 7h8M8 10h8M8 13h5" stroke="currentColor" strokeWidth="1.3" />
              </svg>
              <div className="text-sm">{t("noAssignments")}</div>
            </div>
          ) : (
            <div className="grid gap-4">
              {assignments.map((a) => (
                <div key={a.id} className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md">
                  <div className="grid items-start gap-4 md:grid-cols-[1fr_220px]">
                    {/* kolumna 1 */}
                    {editingId === a.id ? (
                      <div>
                        <label className="text-xs font-medium text-slate-700">{t("editTitle")}</label>
                        <input
                          value={eTitle}
                          onChange={(e) => setETitle(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                        />
                        <label className="mt-3 block text-xs font-medium text-slate-700">{t("editDesc")}</label>
                        <textarea
                          value={eDesc}
                          onChange={(e) => setEDesc(e.target.value)}
                          rows={4}
                          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                        />

                        <div className="mt-4 font-semibold text-slate-900">{t("examplesList")}</div>
                        <div className="my-2 flex gap-6 text-sm">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="radio"
                              checked={eProbFmt === "MARKDOWN_TEX"}
                              onChange={() => setEProbFmt("MARKDOWN_TEX")}
                              className="accent-sky-600"
                            />
                              {t("texMarkdown")}
                          </label>
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="radio"
                              checked={eProbFmt === "ASCIIMATH"}
                              onChange={() => setEProbFmt("ASCIIMATH")}
                              className="accent-emerald-600"
                            />
                              {t("asciimath")}
                          </label>
                        </div>

                        {eSamples.map((s, i) => (
                          <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
                            <textarea
                              rows={2}
                              value={s}
                              onChange={(e) => setESample(i, e.target.value)}
                              placeholder={`${t("exampleLabel")} ${i + 1}`}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                            />
                            <button
                              onClick={() => removeESample(i)}
                              className="h-fit rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100/60"
                            >
                              {t("remove")}
                            </button>
                          </div>
                        ))}

                        <CheatSheetBox fmt={eProbFmt} />

                        <button
                          onClick={addESample}
                          className="mt-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:brightness-105 active:scale-[0.98]"
                        >
                          {t("addExample")}
                        </button>

                        <div className="mt-3 text-xs font-medium text-slate-700">{t("preview")}</div>
                        <div className="flex flex-col gap-2">
                          {previewEdit.length > 0 ? (
                            previewEdit.map((html, i) => (
                              <div key={i} className="rounded-xl border border-slate-200 bg-white/95 p-3 ring-1 ring-slate-200">
                                <div className="mb-1 text-xs text-slate-500">{`${t("exampleLabel")} ${i + 1}`}</div>
                                <div className="[&_.katex-html]:text-slate-900" dangerouslySetInnerHTML={{ __html: html }} />
                              </div>
                            ))
                          ) : (
                            <div className="rounded-xl border border-slate-200 bg-white/95 p-3 ring-1 ring-slate-200">
                              <em>{t("none")}</em>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-base font-semibold leading-tight text-slate-900">{a.title}</div>
                        {a.description && <div className="mt-1 text-slate-600">{a.description}</div>}
                      </div>
                    )}

                    {/* kolumna 2 – akcje */}
                    <div className="flex gap-2">
                      {editingId === a.id ? (
                        <>
                          <button
                            onClick={saveEdit}
                            className="rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 px-3 py-2 font-semibold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99]"
                          >
                            {t("save")}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-xl border border-slate-300 px-3 py-2 transition hover:bg-slate-100/60"
                          >
                            {t("cancel")}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(a)}
                            className="rounded-xl border border-slate-300 px-3 py-2 transition hover:bg-slate-100/60"
                          >
                            {t("edit")}
                          </button>
                          <button
                            onClick={() => removeAssignment(a.id)}
                            className="rounded-xl border border-rose-300 px-3 py-2 font-semibold text-rose-600 transition hover:bg-rose-50"
                          >
                            {t("remove")}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {msg && (
          <div
              className={`mt-6 rounded-xl px-4 py-3 text-sm shadow-sm ring-1 ${
                msg.startsWith(t("errorPrefix")) ? "bg-rose-50 text-rose-800 ring-rose-200" : "bg-emerald-50 text-emerald-800 ring-emerald-200"
              }`}
            >
              {msg}
            </div>
        )}
      </div>
    </div>
  );
}
