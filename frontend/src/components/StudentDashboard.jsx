import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, apiDelete, apiPut } from "../api";
import ascii2mathml from "ascii2mathml";
import katex from "katex";
import "katex/dist/katex.min.css";

function renderProblemHtml(content, format) {
  if (!content) return "<i>Brak</i>";
  try {
    if (format === "ASCIIMATH") {
      return content
        .split(/\r?\n/)
        .map((line) =>
          line.trim()
            ? ascii2mathml(line.trim(), { display: true })
            : "<div style='height:.5rem'></div>"
        )
        .join("");
    }
    return katex.renderToString(content, {
      throwOnError: false,
      displayMode: true,
      strict: "ignore",
    });
  } catch {
    return `<pre style="white-space:pre-wrap;margin:0">${escapeHtml(content)}</pre>`;
  }
}

function renderStudentWorkHtml(text, mode) {
  if (!text?.trim())
    return "<span style='color:#666'>Podgląd pojawi się po wpisaniu treści…</span>";
  try {
    if (mode === "ASCIIMATH") {
      return text
        .split(/\r?\n/)
        .map((line) =>
          line.trim()
            ? ascii2mathml(line.trim(), { display: true })
            : "<div style='height:.5rem'></div>"
        )
        .join("");
    }
    return katex.renderToString(text, {
      throwOnError: false,
      displayMode: true,
      strict: "ignore",
    });
  } catch (e) {
    return `<div style="color:#b91c1c">Nie udało się wyrenderować: ${escapeHtml(
      String(e.message || e)
    )}</div>`;
  }
}

function escapeHtml(s) {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export default function StudentDashboard({
  auth,
  submissions,
  submissionId,
  onPickSubmission,
  onStarted,
}) {
  const [assigned, setAssigned] = useState([]);
  const [info, setInfo] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const current = useMemo(
    () => submissions.find((s) => String(s.id) === String(submissionId)),
    [submissions, submissionId]
  );
  const currentAssignmentId = current?.assignmentId ?? null;

  const [problem, setProblem] = useState(null);
  const [loadingProblem, setLoadingProblem] = useState(false);

  const [work, setWork] = useState("");
  const [previewMode, setPreviewMode] = useState("ASCIIMATH");

  const editorRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await apiGet(
          `/api/assignments/assigned?studentId=${auth.userId}`,
          auth.token
        );
        setAssigned(list || []);
      } catch {
        setAssigned([]);
      }
    })();
  }, [auth]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setProblem(null);
      setWork("");
      if (current?.textAnswer) setWork(current.textAnswer);

      if (!currentAssignmentId) return;
      setLoadingProblem(true);
      try {
        const ps = await apiGet(
          `/api/assignments/${currentAssignmentId}/problems`,
          auth.token
        );
        const first = ps?.[0];
        if (alive && first) {
          setProblem({ content: first.content, format: first.format });
          setPreviewMode(first.format === "MARKDOWN_TEX" ? "MARKDOWN_TEX" : "ASCIIMATH");
        }
      } catch {
        if (alive) setProblem(null);
      } finally {
        if (alive) setLoadingProblem(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [currentAssignmentId, current, auth]);

  async function startAssignment(a) {
    try {
      const sub = await apiPost(
        "/api/submissions/start",
        { assignmentId: a.id, studentId: auth.userId, textAnswer: null },
        auth.token
      );
      onStarted?.(sub);
      onPickSubmission?.(String(sub.id));
      setInfo(`Utworzono/znaleziono zgłoszenie dla zadania „${a.title}”.`);
      setTimeout(() => {
        editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (e) {
      alert("Nie udało się rozpocząć: " + (e.message || e));
    }
  }

  async function saveWork() {
    if (!submissionId) return alert("Wybierz zgłoszenie z listy.");
    setSaving(true);
    try {
      await apiPut(`/api/submissions/${submissionId}`, { textAnswer: work, status: "DRAFT" }, auth.token);
      setInfo("Szkic zapisany.");
    } catch (e) {
      alert("Nie udało się zapisać: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function submitForReview() {
    if (!submissionId) return alert("Wybierz zgłoszenie z listy.");
    if (!confirm("Wyślać rozwiązanie do nauczyciela? Po wysłaniu edycja zostanie zablokowana.")) return;
    setSubmitting(true);
    try {
      // zapis + status SUBMITTED (od tej chwili edycja zablokowana)
      await apiPut(
        `/api/submissions/${submissionId}`,
        { textAnswer: work, status: "SUBMITTED" },
        auth.token
      );
      setInfo("Wysłano do sprawdzenia. Edycja zablokowana – nauczyciel może ją odblokować.");
    } catch (e) {
      alert("Nie udało się wysłać: " + (e.message || e));
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteCurrent() {
    if (!submissionId) return;
    if (!confirm(`Usunąć bieżące zgłoszenie? Zostaną skasowane też zapisane obliczenia.`)) return;
    try {
      await apiDelete(
        `/api/submissions/${submissionId}?studentId=${auth.userId}`,
        auth.token
      );
      const list = await apiGet(
        `/api/submissions?studentId=${auth.userId}`,
        auth.token
      );
      const next = list?.[0]?.id ? String(list[0].id) : "";
      onPickSubmission(next);
      setInfo("Zgłoszenie usunięte.");
    } catch (e) {
      alert("Nie udało się usunąć zgłoszenia: " + (e.message || e));
    }
  }

  const problemHtml = useMemo(
    () => renderProblemHtml(problem?.content || "", problem?.format || "ASCIIMATH"),
    [problem]
  );
  const previewHtml = useMemo(() => renderStudentWorkHtml(work, previewMode), [work, previewMode]);

  const status = (current?.status || "").toUpperCase();
  const isSubmitted = status === "SUBMITTED";
  const isGraded = status === "GRADED";
  const isEditable = !(isSubmitted || isGraded); // EDYCJA TYLKO W DRAFT

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          margin: "8px 0 16px",
        }}
      >
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <b>Jak zacząć?</b>
          <ol style={{ margin: "6px 0 0 18px" }}>
            <li>Wybierz przydzielone zadanie i kliknij <b>Rozpocznij</b>.</li>
            <li>W <b>Moje zgłoszenia</b> wybierz świeżo utworzone zgłoszenie.</li>
            <li>Wpisz odpowiedź i zapisz szkic. Gdy skończysz — <b>Wyślij do sprawdzenia</b>.</li>
          </ol>
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <b>Moje zgłoszenia</b>
          <div style={{ marginTop: 8 }}>
            <select
              value={submissionId || ""}
              onChange={(e) => onPickSubmission(e.target.value)}
              style={{ minWidth: 260 }}
            >
              {submissions.length === 0 && <option value="">(brak Twoich zgłoszeń)</option>}
              {submissions.map((s) => (
                <option key={s.id} value={s.id}>
                  {`Zgłoszenie do: Zadanie ${s.assignmentId}`}
                </option>
              ))}
            </select>
            <button onClick={deleteCurrent} disabled={!submissionId} style={{ marginLeft: 8 }}>
              Usuń zgłoszenie
            </button>
          </div>

          {current && (
            <div style={{ marginTop: 8, fontSize: 13, color: "#444" }}>
              Status:{" "}
              <b>
                {current.status || "—"}
                {isGraded && current.score != null ? ` • Ocena: ${current.score}` : ""}
              </b>
              {isSubmitted && (
                <div style={{ marginTop: 4, color: "#6b7280", fontSize: 12 }}>
                  Edycja zablokowana po wysłaniu. Nauczyciel może zezwolić na poprawę.
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Polecenie zadania:</div>
            <div
              style={{
                minHeight: 40,
                padding: "8px 10px",
                border: "1px solid #eee",
                borderRadius: 8,
                background: "#fafafa",
              }}
            >
              {loadingProblem ? (
                <span style={{ color: "#666" }}>Ładowanie…</span>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: problemHtml }} />
              )}
            </div>
          </div>

          <div ref={editorRef} style={{ marginTop: 14, opacity: isEditable ? 1 : 0.75 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 600 }}>Odpowiedź</div>
              <label style={{ fontSize: 12, color: "#555" }}>
                <input
                  type="radio"
                  name="fmt"
                  checked={previewMode === "ASCIIMATH"}
                  onChange={() => setPreviewMode("ASCIIMATH")}
                  disabled={!isEditable}
                />{" "}
                AsciiMath
              </label>
              <label style={{ fontSize: 12, color: "#555" }}>
                <input
                  type="radio"
                  name="fmt"
                  checked={previewMode === "MARKDOWN_TEX"}
                  onChange={() => setPreviewMode("MARKDOWN_TEX")}
                  disabled={!isEditable}
                />{" "}
                TeX / LaTeX
              </label>
            </div>

            <textarea
              value={work}
              onChange={(e) => setWork(e.target.value)}
              placeholder={
                previewMode === "ASCIIMATH"
                  ? "Np. 2/5 + 1/2 = ?   (AsciiMath)"
                  : "Np. \\frac{2}{5} + \\frac{1}{2} = \\; ?   (TeX/LaTeX)"
              }
              rows={6}
              disabled={!isEditable}
              style={{
                width: "100%",
                marginTop: 6,
                padding: 10,
                borderRadius: 10,
                border: "1px solid #ddd",
                background: isEditable ? "#fff" : "#f9fafb",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              }}
            />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={saveWork}
                disabled={!submissionId || saving || !isEditable}
                style={{
                  marginTop: 8,
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #333",
                  background: saving ? "#555" : "#111",
                  color: "#fff",
                  opacity: saving ? 0.7 : 1,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Zapisuję…" : "Zapisz szkic"}
              </button>

              <button
                onClick={submitForReview}
                disabled={!submissionId || submitting || !isEditable}
                style={{
                  marginTop: 8,
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #0a0",
                  color: "#0a0",
                  background: "#f0fff4",
                }}
              >
                {submitting ? "Wysyłam…" : "Wyślij do sprawdzenia"}
              </button>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Podgląd</div>
              <div
                style={{
                  minHeight: 40,
                  padding: "8px 10px",
                  border: "1px solid #eee",
                  borderRadius: 8,
                  background: "#fafafa",
                }}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <b>Twoje przydzielone zadania</b>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
            gap: 12,
            marginTop: 8,
          }}
        >
          {assigned.length === 0 ? (
            <div style={{ color: "#666" }}>Brak przydzielonych zadań.</div>
          ) : (
            assigned.map((a) => (
              <div key={a.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 600 }}>{a.title}</div>
                {a.description && <div style={{ color: "#444", marginTop: 6 }}>{a.description}</div>}
                <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                  Termin: {a.dueAt ? new Date(a.dueAt).toLocaleString() : "—"}
                </div>
                <button onClick={() => startAssignment(a)} style={{ marginTop: 8 }}>
                  Rozpocznij
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {info && (
        <div
          style={{
            color: "#166534",
            background: "#ecfdf5",
            border: "1px solid #059669",
            borderRadius: 8,
            padding: "6px 10px",
            marginBottom: 12,
          }}
        >
          {info}
        </div>
      )}
    </div>
  );
}
