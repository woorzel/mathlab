// src/pages/TeacherGrading.jsx
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPut, apiPost } from "../api";
import TeacherNav from "../components/TeacherNav.jsx";
import { makeT } from "../i18n";
const t = makeT("TeacherGrading");
import ascii2mathml from "ascii2mathml";
import katex from "katex";
import "katex/dist/katex.min.css";

const SEP = "\n---\n";

/* ---------- Pomocnicze ---------- */
function displayName(u) {
  const n = (u?.name || "").trim();
  return n || u?.email || t("studentDefault", u?.id ?? "?");
}
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
const isPast = (iso) =>
  !!iso &&
  !isNaN(new Date(iso).getTime()) &&
  new Date(iso).getTime() < Date.now();

/* Zdejmuje delimitery LaTeX i wykrywa tryb inline/display */
function parseTeXInput(raw) {
  const s = String(raw || "").trim();
  if (
    (s.startsWith("\\[") && s.endsWith("\\]")) ||
    (s.startsWith("$$") && s.endsWith("$"))
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
/** Wspólny renderer (ASCIIMATH → MathML, MARKDOWN_TEX → KaTeX) */
function renderMathBlock(text, fmt) {
  const txt = String(text || "");
  if (!txt.trim()) return `<em>${t("none")}</em>`;
  if ((fmt || "").toUpperCase() === "ASCIIMATH") {
    try {
      return ascii2mathml(txt, { standalone: false });
    } catch {
      return `<pre style="white-space:pre-wrap;margin:0">${escapeHtml(
        txt
      )}</pre>`;
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
    return `<pre style="white-space:pre-wrap;margin:0">${escapeHtml(
      txt
    )}</pre>`;
  }
}
/** Podgląd odpowiedzi ucznia – zawsze AsciiMath */
function renderAsciiMath(text) {
  try {
    return ascii2mathml(String(text || ""), { standalone: false });
  } catch {
    return `<pre style="white-space:pre-wrap;margin:0">${escapeHtml(
      text || ""
    )}</pre>`;
  }
}
function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ---------- Komponent ---------- */
export default function TeacherGrading({ auth }) {
  const [tab, setTab] = useState("pending"); // pending | archive
  const [assignments, setAssignments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [studentMap, setStudentMap] = useState({});
  const [groupMembers, setGroupMembers] = useState({}); // {groupId: Set(studentIds)}

  const [selGroupId, setSelGroupId] = useState("");

  const [queue, setQueue] = useState([]); // SUBMITTED
  const [archive, setArchive] = useState([]); // GRADED
  const [current, setCurrent] = useState(null);

  const [scoreInput, setScoreInput] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");

  const [dueByAStudent, setDueByAStudent] = useState({}); // { [aid]: { [sid]: dueISO } }
  const currentDue =
    current &&
    (dueByAStudent[String(current.assignmentId)] || {})[
      String(current.studentId)
    ];
  const [newDue, setNewDue] = useState("");

  /* ----- Ładowanie danych ----- */
  useEffect(() => {
    (async () => {
      try {
        const list = await apiGet(
          `/api/assignments?teacherId=${auth.userId}`,
          auth.token
        );
        setAssignments(list || []);
      } catch {
        setAssignments([]);
      }
    })();
  }, [auth]);

  useEffect(() => {
    (async () => {
      try {
        const gs = await apiGet(
          `/api/groups?teacherId=${auth.userId}`,
          auth.token
        );
        setGroups(gs || []);

        const allStudents = {};
        const gm = {};
        for (const g of gs || []) {
          const members = await apiGet(
            `/api/groups/${g.id}/students`,
            auth.token
          );
          const setIds = new Set();
          (members || []).forEach((u) => {
            allStudents[String(u.id)] = u;
            setIds.add(Number(u.id));
          });
          gm[String(g.id)] = setIds;
        }
        setStudentMap(allStudents);
        setGroupMembers(gm);
      } catch {
        setGroups([]);
        setStudentMap({});
        setGroupMembers({});
      }
    })();
  }, [auth]);

  useEffect(() => {
    (async () => {
      try {
        const m = {};
        await Promise.all(
          (assignments || []).map(async (a) => {
            const assignees = await apiGet(
              `/api/assignments/${a.id}/assignees`,
              auth.token
            );
            const inner = {};
            (assignees || []).forEach((x) => {
              inner[String(x.id)] = x.dueAt || null;
            });
            m[String(a.id)] = inner;
          })
        );
        setDueByAStudent(m);
      } catch {
        setDueByAStudent({});
      }
    })();
  }, [assignments, auth]);

  const pairKey = (aid, sid) => `${aid}:${sid}`;
  const inChosenGroup = (sid) => {
    if (!selGroupId) return true;
    const setIds = groupMembers[String(selGroupId)] || new Set();
    return setIds.has(Number(sid));
  };

  async function loadSubmissions() {
    try {
      const ids = (assignments || []).map((a) => a.id);
      const chunks = await Promise.all(
        ids.map((id) =>
          apiGet(`/api/submissions?assignmentId=${id}`, auth.token)
        )
      );
      const flat = chunks.flat().filter(Boolean);

      let filtered = flat;
      if (selGroupId) {
        filtered = filtered.filter((s) => inChosenGroup(s.studentId));
      }

      const byPair = new Map();
      for (const s of filtered) {
        const k = pairKey(s.assignmentId, s.studentId);
        if (!byPair.has(k)) byPair.set(k, []);
        byPair.get(k).push(s);
      }
      for (const arr of byPair.values()) {
        arr.sort((a, b) => Number(a.id) - Number(b.id));
      }

      // wirtualne SUBMITTED dla uczniów z terminem po czasie i bez submission
      Object.entries(dueByAStudent || {}).forEach(([aid, inner]) => {
        Object.entries(inner || {}).forEach(([sid, due]) => {
          if (!due || !isPast(due)) return;
          if (!inChosenGroup(sid)) return;
          const key = pairKey(aid, sid);
          if (byPair.has(key)) return; // już jest submission
          const virtual = {
            id: `virtual-${aid}-${sid}`,
            assignmentId: Number(aid),
            studentId: Number(sid),
            status: "SUBMITTED",
            textAnswer: "",
            _virtual: true,
            createdAt: due,
            updatedAt: due,
          };
            byPair.set(key, [virtual]);
        });
      });

      const nextQueue = [];
      const nextArchive = [];
      for (const arr of byPair.values()) {
        const latest = arr[arr.length - 1];
        if (!latest) continue;
        if (latest.status === "SUBMITTED") nextQueue.push(latest);
        else if (latest.status === "GRADED") nextArchive.push(latest);
      }

      nextQueue.sort((a, b) => Number(b.id) - Number(a.id));
      nextArchive.sort((a, b) => Number(b.id) - Number(a.id));

      setQueue(nextQueue);
      setArchive(nextArchive);

      if (current) {
        const stillHere = [...nextQueue, ...nextArchive].some(
          (s) => s.id === current.id
        );
        if (!stillHere) {
          setCurrent(null);
          setScoreInput("");
          setNote("");
        }
      }
    } catch (e) {
      setQueue([]);
      setArchive([]);
      setMsg(t("errorFetchSubmissions") + (e.message || e));
    }
  }

  useEffect(() => {
    if (assignments.length) loadSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments, selGroupId, groupMembers, dueByAStudent]);

  useEffect(() => {
    const tmr = setInterval(loadSubmissions, 10000);
    return () => clearInterval(tmr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments, selGroupId, groupMembers, dueByAStudent]);

  useEffect(() => {
    setNewDue(toLocalInput(currentDue));
  }, [currentDue, current?.id]);

  useEffect(() => {
    if (!current) return;
    const ids = (tab === "pending" ? queue : archive).map((s) => s.id);
    if (!ids.includes(current.id)) {
      setCurrent(null);
      setScoreInput("");
      setNote("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, queue, archive, current?.id]);

  const list = tab === "pending" ? queue : archive;

  const currentAssignment = useMemo(() => {
    if (!current) return null;
    return (
      assignments.find(
        (a) => Number(a.id) === Number(current.assignmentId)
      ) || null
    );
  }, [assignments, current]);

  const currentStudent = useMemo(() => {
    if (!current) return null;
    return studentMap[String(current.studentId)] || {
      id: current.studentId,
    };
  }, [studentMap, current]);

  const teacherFormat = (
    currentAssignment?.problemFormat || "ASCIIMATH"
  ).toUpperCase();

  const teacherParts = useMemo(() => {
    const raw = String(currentAssignment?.problemContent || "");
    const parts = raw.split(SEP).map((s) => s.trim()).filter(Boolean);
    return parts.length ? parts : [];
  }, [currentAssignment]);

  const answerParts = useMemo(() => {
    const raw = String(current?.textAnswer || "");
    const parts = raw.split(SEP);
    if (!teacherParts.length) return parts.length ? parts : [raw];
    const out = [...parts];
    while (out.length < teacherParts.length) out.push("");
    if (out.length > teacherParts.length) out.length = teacherParts.length;
    return out;
  }, [current, teacherParts.length]);

  function isForbidden(err) {
    const raw = (
      JSON.stringify(err) +
      " " +
      String(err?.message || "")
    ).toUpperCase();
    return (
      err?.status === 403 ||
      /FORBIDDEN|(^|[^0-9])403([^0-9]|$)/.test(raw)
    );
  }
  function isDeadline(err) {
    const raw = (
      JSON.stringify(err) +
      " " +
      String(err?.message || "")
    ).toUpperCase();
    return /DEADLINE_PASSED|DEADLINE/.test(raw);
  }
  function isNotImplemented(err) {
    const code = err?.status;
    const msg = String(err?.message || "");
    return (
      code === 404 ||
      code === 405 ||
      code === 501 ||
      /not\s*implemented|route|endpoint/i.test(msg)
    );
  }

  async function ensureSubmission(s) {
    if (!s?._virtual) return s;
    try {
      const created = await apiPost(
        `/api/submissions/start`,
        {
          assignmentId: s.assignmentId,
          studentId: s.studentId,
          textAnswer: "",
        },
        auth.token
      );
      const real = { ...created, _overdueDraft: true };
      setQueue((prev) =>
        prev.map((x) => (x.id === s.id ? real : x))
      );
      setCurrent(real);
      return real;
    } catch (e) {
      if (isForbidden(e) || isDeadline(e)) return null;
      throw e;
    }
  }

  async function gradeWithFallback(base, body) {
    const desired = String(body?.status || "").toUpperCase();
    if (desired !== "GRADED") {
      throw new Error("gradeWithFallback supports only GRADED");
    }
    if (base?.status !== "SUBMITTED") {
      const upd = await apiPut(
        `/api/submissions/${base.id}`,
        { status: "SUBMITTED" },
        auth.token
      );
      return await apiPut(
        `/api/submissions/${upd?.id ?? base.id}/grade`,
        body,
        auth.token
      );
    }
    return await apiPut(
      `/api/submissions/${base.id}/grade`,
      body,
      auth.token
    );
  }

  async function doGrade() {
    if (!current) return;
    setMsg("");
    try {
      const base = await ensureSubmission(current);

      const teacherOverride = isPast(currentDue);
      const bodyCommon = {
        score: scoreInput || null,
        reviewNote: note || null,
        status: "GRADED",
        teacherId: auth.userId,
        ...(teacherOverride ? { teacherOverride: true } : {}),
      };

      if (base) {
        const upd = await gradeWithFallback(base, bodyCommon);

        if (tab === "pending") {
          setQueue((prev) =>
            prev.filter((s) => s.id !== (base.id || current.id))
          );
          setArchive((prev) => [upd, ...prev]);
          setTab("archive");
        } else {
          setArchive((prev) =>
            prev.map((s) =>
              s.id === (base.id || current.id) ? upd : s
            )
          );
        }

        setCurrent(upd);
        setMsg(t("saved"));
        try {
          await loadSubmissions();
        } catch {}
        return;
      }

      if (teacherOverride) {
        try {
          const upd = await apiPost(
            `/api/submissions/grade-missing`,
            {
              assignmentId: current.assignmentId,
              studentId: current.studentId,
              score: scoreInput || "1",
              reviewNote: note || "Brak pracy w terminie.",
              teacherOverride: true,
              teacherId: auth.userId,
            },
            auth.token
          );
          setQueue((prev) =>
            prev.filter((s) => s.id !== current.id)
          );
          setArchive((prev) => [upd, ...prev]);
          setCurrent(upd);
          setTab("archive");
          setMsg(t("savedMissingAfterDeadline"));
          return;
        } catch (e2) {
          if (isNotImplemented(e2)) {
            setMsg(t("backendMissingGradeMissing"));
            return;
          }
          throw e2;
        }
      }

      setMsg(t("cannotSaveNoSubmission"));
    } catch (e) {
      setMsg(t("errorSave") + (e?.message || e));
    }
  }

  // „Pozwól na poprawę”
  async function allowRetake() {
    if (!current) return;
    setMsg("");
    try {
      const currentLocal = toLocalInput(currentDue || "");
      if (newDue && newDue !== currentLocal) {
        const iso = newDue ? new Date(newDue).toISOString() : null;
        await apiPut(
          `/api/assignments/${current.assignmentId}/students/${current.studentId}/due`,
          { dueAt: iso },
          auth.token
        );
        setDueByAStudent((prev) => {
          const copy = { ...prev };
          const inner = { ...(copy[String(current.assignmentId)] || {}) };
          inner[String(current.studentId)] = iso;
          copy[String(current.assignmentId)] = inner;
          return copy;
        });
      }

      if (current._virtual) {
        // cofamy „brak pracy” – uczeń znów widzi zadanie jako nie rozpoczęte
        setQueue((prev) => prev.filter((s) => s.id !== current.id));
        setCurrent(null);
        setMsg(t("retake"));
        try {
          await loadSubmissions();
        } catch {}
        return;
      }

      const upd = await apiPut(
        `/api/submissions/${current.id}`,
        { status: "DRAFT" },
        auth.token
      );

      setQueue((prev) => prev.filter((s) => s.id !== current.id));
      setArchive((prev) => prev.filter((s) => s.id !== current.id));

      setCurrent(upd);
      setMsg(t("retake"));

      try {
        await loadSubmissions();
      } catch {}
    } catch (e) {
      setMsg(t("retakeError") + (e.message || e));
    }
  }

  /* ---------- UI ---------- */
  return (
    <div className="relative min-h-[100svh] overflow-x-hidden">
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
                <h1 className="text-3xl font-black tracking-tight text-slate-900">
                  {t("title")}
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  {t("heroDesc")}
                </p>
              </div>
              <div className="flex justify-start gap-2 md:justify-end">
                <span className="rounded-full bg-sky-600/10 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
                  {t("teacherPanelBadge")}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* FILTRY + ZAKŁADKI */}
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex gap-2">
            <button
              onClick={() => setTab("pending")}
              className={`rounded-xl px-3 py-1.5 text-sm ring-1 transition ${
                tab === "pending"
                  ? "bg-slate-900 text-white ring-slate-900"
                  : "bg-white text-slate-900 ring-slate-300 hover:bg-slate-50"
              }`}
            >
              {t("toReview")} ({queue.length})
            </button>
            <button
              onClick={() => setTab("archive")}
              className={`rounded-xl px-3 py-1.5 text-sm ring-1 transition ${
                tab === "archive"
                  ? "bg-slate-900 text-white ring-slate-900"
                  : "bg-white text-slate-900 ring-slate-300 hover:bg-slate-50"
              }`}
            >
              {t("archive")} ({archive.length})
            </button>
          </div>

          <div className="ml-0 flex flex-wrap items-center gap-2 md:ml-auto">
            <span className="text-xs text-slate-600">
              {t("studentLabel")}
            </span>
            <select
              value={selGroupId}
              onChange={(e) => setSelGroupId(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            >
              <option value="">{t("allGroups")}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* DWA PANELE */}
        <div className="mt-4 grid gap-4 md:grid-cols-[380px_1fr]">
          {/* LEWA LISTA */}
          <section className="overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-200">
            {list.length === 0 ? (
              <div className="p-3 text-sm text-slate-600">
                {tab === "pending"
                  ? t("emptyPending")
                  : t("emptyArchive")}
              </div>
            ) : (
              list.map((s) => {
                const a = assignments.find(
                  (x) => Number(x.id) === Number(s.assignmentId)
                );
                const u =
                  studentMap[String(s.studentId)] || {
                    id: s.studentId,
                  };
                const isActive = current?.id === s.id;
                const due =
                  (dueByAStudent[String(s.assignmentId)] || {})[
                    String(s.studentId)
                  ];
                const missingBadge =
                  (!s.textAnswer || !String(s.textAnswer).trim()) &&
                  isPast(due)
                    ? ` — ${t("overdueBadge")}`
                    : "";
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setCurrent(s);
                      // >>> po terminie + brak odpowiedzi => domyślnie 1 i zlokalizowana notatka
                      if (
                        isPast(due) &&
                        (!s.textAnswer || !String(s.textAnswer).trim())
                      ) {
                        setScoreInput("1");
                        setNote(t("missingAfterDeadlineNote"));
                      } else {
                        setScoreInput(s.score ?? "");
                        setNote(s.reviewNote ?? "");
                      }
                      setMsg("");
                    }}
                    className={`block w-full border-b border-slate-100 px-3 py-2 text-left transition ${
                      isActive
                        ? "bg-sky-50/70"
                        : "bg-white hover:bg-slate-50"
                    } ${
                      isActive ? "border-l-2 border-l-sky-500" : ""
                    }`}
                  >
                    <div className="font-semibold text-slate-900">
                      {a?.title ||
                        `Zadanie #${s.assignmentId}`}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-600">
                      {t("studentLabel")}{" "}
                      <b>{displayName(u)}</b> • {t("statusLabel")}{" "}
                      {s.status || "-"}
                      {missingBadge}
                    </div>
                    {due && (
                      <div className="mt-0.5 text-xs text-slate-600">
                        {t("dueLabel")} {fmtDateSafe(due)}
                        {isPast(due) && (
                          <span className="ml-1 rounded-full bg-rose-100 px-2 py-[2px] text-rose-700">
                            {t("overdueBadge")}
                          </span>
                        )}
                      </div>
                    )}
                    {a?.description && (
                      <div className="mt-1 text-xs text-slate-700">
                        {t("descriptionShort")}{" "}
                        {a.description}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </section>

          {/* PRAWY PANEL */}
          <section className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            {!current ? (
              <div className="text-sm text-slate-600">
                {t("chooseWork")}
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="font-semibold text-slate-900">
                    {t("gradingHeading")}{" "}
                    {currentAssignment?.title ||
                      `Zadanie #${current.assignmentId}`}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-600">
                    {t("studentLabel")}{" "}
                    <b>{displayName(currentStudent)}</b> •{" "}
                    {t("statusLabel")} {current.status || "-"}
                    {current._virtual && " — brak pracy"}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-600">
                    {t("dueLabel")}{" "}
                    {currentDue
                      ? fmtDateSafe(currentDue)
                      : "—"}
                    {isPast(currentDue) && (
                      <span className="ml-1 rounded-full bg-rose-100 px-2 py-[2px] text-rose-700">
                        {t("overdueBadge")}
                      </span>
                    )}
                  </div>
                </div>

                {(currentAssignment?.description ?? "").trim() && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <div className="mb-1 text-xs text-slate-600">
                      {t("assignmentDescriptionHeading")}
                    </div>
                    <div className="text-sm text-slate-800 whitespace-pre-wrap">
                      {currentAssignment.description}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex flex-col gap-3">
                  {(teacherParts.length ? teacherParts : [""]).map(
                    (part, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <div className="mb-2 font-semibold text-slate-900">
                          {t("exampleLabel", idx + 1)}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <div className="mb-1 flex items-center gap-2">
                              <span>📘</span>
                              <div className="text-xs text-slate-600">
                                {t(
                                  "teacherContentLabel",
                                  teacherFormat ===
                                  "ASCIIMATH"
                                    ? "AsciiMath"
                                    : "TeX"
                                )}
                              </div>
                            </div>
                            <div
                              className="rounded-lg border border-slate-200 bg-white p-3 [&_.katex-html]:text-slate-900"
                              dangerouslySetInnerHTML={{
                                __html: renderMathBlock(
                                  part,
                                  teacherFormat
                                ),
                              }}
                            />
                          </div>

                          <div>
                            <div className="mb-1 flex items-center gap-2">
                              <span>✍️</span>
                              <div className="text-xs text-slate-600">
                                {t("studentAnswerPreview")}
                              </div>
                            </div>
                            <div
                              className="rounded-lg border border-slate-200 bg-white p-3 [&_.katex-html]:text-slate-900"
                              dangerouslySetInnerHTML={{
                                __html: renderAsciiMath(
                                  answerParts[idx] ?? ""
                                ),
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>

                <div className="mt-3">
                  <div className="mb-1 text-xs text-slate-600">
                    {t("scoreLabel")}
                  </div>
                  <input
                    value={scoreInput}
                    onChange={(e) =>
                      setScoreInput(e.target.value)
                    }
                    placeholder={
                      (() => {
                        const a = assignments.find(
                          (x) => Number(x.id) === Number(current.assignmentId)
                        );
                        const due = a?.studentDueAt || a?.dueAt || null;
                        const late = !!due && !isNaN(new Date(due).getTime()) && new Date(due).getTime() < Date.now();
                        return late ? (t("scoreLatePlaceholder") || t("scorePlaceholder")) : t("scorePlaceholder");
                      })()
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                </div>

                <div className="mt-2">
                  <div className="mb-1 text-xs text-slate-600">
                    {t("commentLabel")}
                  </div>
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={(() => {
                      // Show late missing note ONLY when after due and there is no student answer text
                      const a = assignments.find((x) => Number(x.id) === Number(current.assignmentId));
                      const due = a?.studentDueAt || a?.dueAt || null;
                      const late = !!due && !isNaN(new Date(due).getTime()) && new Date(due).getTime() < Date.now();
                      const emptyAnswer = !String(current?.textAnswer || "").trim();
                      if (late && emptyAnswer) return t("missingAfterDeadlineNote");
                      return ""; // no placeholder to avoid misleading teacher
                    })()}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                </div>

                {tab === "pending" && (
                  <div className="mt-3">
                    <div className="mb-1 text-xs text-slate-600">
                      {t("setNewDueLabel")}
                    </div>
                    <input
                      type="datetime-local"
                      value={newDue}
                      onChange={(e) =>
                        setNewDue(e.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                    />
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {tab === "pending" &&
                    current.status === "SUBMITTED" && (
                      <>
                        <button
                          onClick={doGrade}
                          className="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99]"
                        >
                          {t("confirmGradeBtn")}
                        </button>
                        <button
                          onClick={allowRetake}
                          className="rounded-xl border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 active:scale-[0.99]"
                        >
                          {t("allowRetakeBtn")}
                        </button>
                      </>
                    )}
                  {tab === "archive" &&
                    current.status === "GRADED" && (
                      <button
                        onClick={async () => {
                          try {
                            const upd = await apiPut(
                              `/api/submissions/${current.id}`,
                              { status: "SUBMITTED" },
                              auth.token
                            );
                            setArchive((prev) =>
                              prev.filter(
                                (s) => s.id !== current.id
                              )
                            );
                            setQueue((prev) => [
                              upd,
                              ...prev,
                            ]);
                            setCurrent(upd);
                            setTab("pending");
                            setMsg(
                              t("reopenForReview") ||
                                "Otwarto do ponownej oceny"
                            );
                          } catch (e) {
                            setMsg(
                              t("errorPrefix") +
                                (e.message || e)
                            );
                          }
                        }}
                        className="rounded-xl border border-sky-400 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-50 active:scale-[0.99]"
                      >
                        {t("reopenBtn") === "reopenBtn"
                          ? "Otwórz do ponownej oceny"
                          : t("reopenBtn")}
                      </button>
                    )}
                </div>

                {msg && (
                  <div
                    className={`mt-3 rounded-xl px-3 py-2 text-sm ring-1 ${
                      msg.startsWith(t("errorPrefix"))
                        ? "bg-rose-50 text-rose-800 ring-rose-200"
                        : "bg-emerald-50 text-emerald-800 ring-emerald-200"
                    }`}
                  >
                    {msg}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
