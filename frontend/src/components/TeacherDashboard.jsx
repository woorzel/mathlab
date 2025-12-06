import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "../api";
import ascii2mathml from "ascii2mathml";
import katex from "katex";
import "katex/dist/katex.min.css";

// inicjał imienia + nazwisko (fallback: e-mail)
function shortName(u) {
  const name = (u?.name || "").trim();
  if (!name) return u?.email || "bez nazwy";
  const [first, ...rest] = name.split(/\s+/);
  const initial = first ? first[0].toUpperCase() + "." : "";
  const last = rest.join(" ");
  return (last ? `${initial} ${last}` : `${initial} ${first}`).trim();
}

export default function TeacherDashboard({ auth }) {
  // --- uczniowie (wysyłka) ---
  const [q, setQ] = useState("");
  const [students, setStudents] = useState([]);
  const [picked, setPicked] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await apiGet(`/api/users?role=STUDENT&q=${encodeURIComponent(q)}`, auth.token);
        if (alive) setStudents(list || []);
      } catch {
        if (alive) setStudents([]);
      }
    })();
    return () => { alive = false; };
  }, [q, auth]);

  function togglePick(u) {
    setPicked(prev => prev.some(p => p.id === u.id) ? prev.filter(p => p.id !== u.id) : [...prev, u]);
  }

  // --- zadania / lista / wybór wysyłki ---
  const [assignments, setAssignments] = useState([]);
  const [selAssignmentId, setSelAssignmentId] = useState("");

  async function refreshAssignments(selectIdIfEmpty = true) {
    const list = await apiGet("/api/assignments", auth.token);
    setAssignments(list || []);
    if (selectIdIfEmpty && (!selAssignmentId || !list?.some(a => String(a.id) === String(selAssignmentId)))) {
      setSelAssignmentId(list?.length ? String(list[0].id) : "");
    }
  }
  useEffect(() => { refreshAssignments(true).catch(() => setAssignments([])); }, []); // eslint-disable-line

  // --- NOWE ZADANIE ---
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");

  const [initialProblem, setInitialProblem] = useState("");
  const [initialFormat, setInitialFormat] = useState("MARKDOWN_TEX");

  const initialPreviewHtml = useMemo(() => {
    try {
      if (!initialProblem.trim()) return "<em>Brak</em>";
      if (initialFormat === "ASCIIMATH") return ascii2mathml(initialProblem, { standalone: false });
      try { return katex.renderToString(initialProblem, { throwOnError: false, displayMode: true }); }
      catch { return `<pre style="white-space:pre-wrap">${initialProblem}</pre>`; }
    } catch (err) {
      return `<div style="color:#b91c1c">Błąd podglądu: ${err?.message || err}</div>`;
    }
  }, [initialProblem, initialFormat]);

  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");

  async function createAssignment() {
    if (creating) return;
    setCreating(true);
    setMsg("");
    try {
      if (!title.trim()) { setMsg("Podaj tytuł zadania."); return; }

      const a = await apiPost("/api/assignments", {
        teacherId: auth.userId,
        title,
        description: desc || null,
        dueAt: due ? new Date(due).toISOString() : null
      }, auth.token);

      if (initialProblem.trim()) {
        await apiPost("/api/problems", {
          assignmentId: a.id,
          authorId: auth.userId,
          content: initialProblem,
          format: initialFormat
        }, auth.token);
      }

      await refreshAssignments(true);
      setSelAssignmentId(String(a.id));
      setTitle(""); setDesc(""); setDue(""); setInitialProblem("");
      setInitialFormat("MARKDOWN_TEX");
      setMsg(`Dodano zadanie „${a.title}”.${initialProblem ? " Dodano też obliczenia." : ""}`);
    } catch (e) {
      setMsg("Błąd: " + (e.message || e));
    } finally {
      setCreating(false);
    }
  }

  // --- EDYCJA ISTNIEJĄCEGO ZADANIA ---
  const [editingId, setEditingId] = useState(null);
  const [eTitle, setETitle] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eDue, setEDue] = useState("");
  const [eProbFormat, setEProbFormat] = useState("MARKDOWN_TEX");
  const [eProbText, setEProbText] = useState("");

  function startEdit(a) {
    setEditingId(a.id);
    setETitle(a.title ?? "");
    setEDesc(a.description ?? "");
    setEDue(a.dueAt ? new Date(a.dueAt).toISOString().slice(0,16) : "");
    setEProbFormat(a.problemFormat || "MARKDOWN_TEX");
    setEProbText(a.problemContent || "");
  }

  const editPreviewHtml = useMemo(() => {
    try {
      if (!eProbText.trim()) return "<em>Brak</em>";
      if (eProbFormat === "ASCIIMATH") return ascii2mathml(eProbText, { standalone: false });
      try { return katex.renderToString(eProbText, { throwOnError: false, displayMode: true }); }
      catch { return `<pre style="white-space:pre-wrap">${eProbText}</pre>`; }
    } catch (err) {
      return `<div style="color:#b91c1c">Błąd podglądu: ${err?.message || err}</div>`;
    }
  }, [eProbText, eProbFormat]);

  async function saveEdit() {
    setMsg("");
    try {
      await apiPut(`/api/assignments/${editingId}`, {
        title: eTitle,
        description: eDesc,
        dueAt: eDue ? new Date(eDue).toISOString() : null,
        problemContent: eProbText,
        problemFormat: eProbFormat
      }, auth.token);
      setEditingId(null);
      await refreshAssignments(false);
      setMsg("Zadanie zaktualizowane.");
    } catch (e) {
      setMsg("Błąd: " + (e.message || e));
    }
  }

  async function removeAssignment(id) {
    const a = assignments.find(x => x.id === id);
    const label = a?.title || "to zadanie";
    if (!window.confirm(`Na pewno usunąć „${label}”? Zostaną usunięte też zgłoszenia i obliczenia.`)) return;
    setMsg("");
    try {
      await apiDelete(`/api/assignments/${id}`, auth.token);
      await refreshAssignments(true);
      if (String(selAssignmentId) === String(id)) setSelAssignmentId("");
      setMsg(`Usunięto „${label}”.`);
    } catch (e) {
      setMsg("Błąd: " + (e.message || e));
    }
  }

  // --- wysyłka zadania do wybranych uczniów ---
  const [assigning, setAssigning] = useState(false);

  function nameById(id) {
    const u = picked.find(p => p.id === id);
    return u ? shortName(u) : `ID ${id}`;
    // gdyby backend zwracał pełne osoby – można to rozwinąć
  }

  async function assignToPicked() {
    if (assigning) return;
    setAssigning(true);
    setMsg("");
    try {
      const id = Number(selAssignmentId);
      if (!id) { setMsg("Wybierz zadanie do wysyłki."); return; }
      if (picked.length === 0) { setMsg("Wybierz przynajmniej jednego ucznia."); return; }

      const res = await apiPost(`/api/assignments/${id}/students`, {
        studentIds: picked.map(p => p.id)
      }, auth.token);

      const a = assignments.find(x => x.id === id);
      const titleSafe = a?.title || "zadanie";

      const added = (res.dodani || []).map(nameById).join(", ");
      const dups  = (res.duplikaty || []).map(nameById).join(", ");
      const miss  = (res.brak || []).map(nameById).join(", ");

      setMsg(
        `Przydzielono „${titleSafe}”.` +
        (added ? ` Dodani: [${added}]` : "") +
        (dups  ? `, duplikaty: [${dups}]` : "") +
        (miss  ? `, brak: [${miss}]` : "")
      );
    } catch (e) {
      setMsg("Błąd: " + (e.message || e));
    } finally {
      setAssigning(false);
    }
  }

  // ------------------ PANEL OCENIANIA ------------------
  const [gradeAid, setGradeAid] = useState("");
  const [subs, setSubs] = useState([]);
  const [selSubId, setSelSubId] = useState("");
  const [selSub, setSelSub] = useState(null);
  const [gradeScore, setGradeScore] = useState("");
  const [gradeNote, setGradeNote] = useState("");
  const [gradeStatus] = useState("GRADED");
  const [formulas, setFormulas] = useState([]);
  const [problemPreview, setProblemPreview] = useState(null);

  async function loadSubs(aid) {
    try {
      const list = await apiGet(`/api/submissions?assignmentId=${aid}`, auth.token);
      setSubs(list || []);
      setSelSubId(list?.[0]?.id ? String(list[0].id) : "");
    } catch {
      setSubs([]); setSelSubId("");
    }
  }

  useEffect(() => { if (gradeAid) loadSubs(gradeAid); }, [gradeAid]); // eslint-disable-line

  useEffect(() => {
    const s = subs.find(x => String(x.id) === String(selSubId));
    setSelSub(s || null);
    setGradeScore(s?.score ?? "");
    setGradeNote(s?.reviewNote ?? "");

    if (s?.id) {
      apiGet(`/api/formulas?submissionId=${s.id}`, auth.token)
        .then(setFormulas).catch(() => setFormulas([]));
    } else setFormulas([]);

    if (s?.assignmentId) {
      apiGet(`/api/assignments/${s.assignmentId}/problems`, auth.token)
        .then(arr => setProblemPreview(arr?.[0] || null))
        .catch(() => setProblemPreview(null));
    } else setProblemPreview(null);
  }, [selSubId, subs, auth]);

  async function saveGrade(statusOverride) {
    if (!selSub?.id) return;
    const body = {
      score: gradeScore === "" ? null : Number(gradeScore),
      reviewNote: gradeNote ?? null,
      status: statusOverride || gradeStatus
    };
    try {
      const updated = await apiPut(`/api/submissions/${selSub.id}/grade`, body, auth.token);
      setSubs(prev => prev.map(x => x.id === updated.id ? updated : x));
      setMsg("Ocena zapisana.");
    } catch (e) {
      setMsg("Błąd: " + (e.message || e));
    }
  }
  // -----------------------------------------------------

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 380px", gap: 16, alignItems: "start" }}>
        {/* LEWA – uczniowie */}
        <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <b>Uczniowie</b>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Szukaj (imię/e-mail)"
            style={{ width: "100%", marginTop: 8, padding: 8, borderRadius: 10, border: "1px solid #ddd" }}
          />
          <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>Kliknij, aby dodać/zdjąć z listy wysyłki:</div>
          <div style={{ marginTop: 8, maxHeight: 260, overflow: "auto", border: "1px solid #f0f0f0", borderRadius: 10 }}>
            {students.length === 0 ? (
              <div style={{ padding: 8, color: "#666" }}>Brak wyników.</div>
            ) : students.map((u) => {
                const onList = picked.some((p) => p.id === u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => togglePick(u)}
                    style={{
                      padding: "8px 10px",
                      cursor: "pointer",
                      background: onList ? "#eef9ff" : "transparent",
                      borderBottom: "1px solid #f3f3f3",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{u.name || u.email}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>{u.email}</div>
                  </div>
                );
              })}
          </div>

          <div style={{ marginTop: 12 }}>
            <b>Wybrani:</b>
            <div style={{ marginTop: 6, fontSize: 14 }}>
              {picked.length === 0
                ? <span style={{ color: "#666" }}>Brak wybranych uczniów.</span>
                : picked.map((p) => (
                    <span key={p.id} style={{ marginRight: 6, background: "#efefef", padding: "2px 6px", borderRadius: 8 }}>
                      {shortName(p)}
                    </span>
                  ))}
            </div>
          </div>
        </section>

        {/* ŚRODEK – tworzenie + lista z edycją */}
        <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <b>Nowe zadanie</b>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tytuł"
            style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 12, border: "1px solid #ddd", fontSize: 16 }}
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Opis (opcjonalnie)"
            rows={3}
            style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 12, border: "1px solid #ddd", fontSize: 15 }}
          />
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            placeholder="Termin (opcjonalnie)"
            style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 12, border: "1px solid #ddd", fontSize: 15 }}
          />

          <div style={{ marginTop: 12, fontWeight: 600 }}>Obliczenia (opcjonalnie)</div>
          <div style={{ display:"flex", gap:16, alignItems:"center", margin:"6px 0" }}>
            <label><input type="radio" checked={initialFormat==="MARKDOWN_TEX"} onChange={()=>setInitialFormat("MARKDOWN_TEX")} /> TeX / Markdown</label>
            <label><input type="radio" checked={initialFormat==="ASCIIMATH"} onChange={()=>setInitialFormat("ASCIIMATH")} /> AsciiMath</label>
          </div>
          <textarea
            value={initialProblem}
            onChange={(e) => setInitialProblem(e.target.value)}
            placeholder={"Wpisz obliczenia (TeX/Markdown lub AsciiMath)"}
            rows={6}
            style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 12, border: "1px solid #ddd", fontSize: 15 }}
          />
          <div style={{ marginTop:8 }}>
            <div style={{ fontSize:12, color:"#666", marginBottom:4 }}>Podgląd</div>
            <div
              style={{ border:"1px solid #eee", borderRadius:10, padding:10, minHeight:48 }}
              dangerouslySetInnerHTML={{ __html: initialPreviewHtml }}
            />
          </div>

          <button
            type="button"
            onClick={createAssignment}
            disabled={creating}
            style={{
              marginTop: 10, padding: "10px 16px", borderRadius: 12,
              border: "1px solid #333", background: creating ? "#555" : "#111",
              opacity: creating ? 0.7 : 1, color: "#fff", cursor: creating ? "not-allowed" : "pointer"
            }}
          >
            {creating ? "Tworzę..." : "Utwórz zadanie"}
          </button>

          <div style={{ marginTop: 18 }}>
            <b>Moje zadania (edytuj / usuń)</b>
            <div style={{ marginTop: 8, border: "1px solid #f0f0f0", borderRadius: 10 }}>
              {assignments.length === 0 ? (
                <div style={{ padding: 10, color: "#666" }}>(brak zadań)</div>
              ) : assignments.map(a => (
                <div
                  key={a.id}
                  style={{
                    display:"grid",
                    gridTemplateColumns:"2fr 240px 220px",
                    gap:12, padding:"12px 12px",
                    borderBottom:"1px solid #f5f5f5",
                    alignItems:"start"
                  }}
                >
                  {editingId === a.id ? (
                    <div>
                      <label style={{ fontSize:12, color:"#666" }}>Tytuł</label>
                      <input
                        value={eTitle}
                        onChange={e=>setETitle(e.target.value)}
                        placeholder="Tytuł"
                        style={{ width:"100%", padding:10, borderRadius:12, border:"1px solid #ddd", fontSize:16 }}
                      />
                      <label style={{ display:"block", marginTop:8, fontSize:12, color:"#666" }}>Opis</label>
                      <textarea
                        value={eDesc}
                        onChange={e=>setEDesc(e.target.value)}
                        placeholder="Opis"
                        rows={5}
                        style={{ width:"100%", padding:10, borderRadius:12, border:"1px solid #ddd", fontSize:15 }}
                      />
                      <div style={{ marginTop:10, fontWeight:600 }}>Obliczenia</div>
                      <div style={{ display:"flex", gap:16, alignItems:"center", margin:"6px 0" }}>
                        <label><input type="radio" checked={eProbFormat==="MARKDOWN_TEX"} onChange={()=>setEProbFormat("MARKDOWN_TEX")} /> TeX / Markdown</label>
                        <label><input type="radio" checked={eProbFormat==="ASCIIMATH"} onChange={()=>setEProbFormat("ASCIIMATH")} /> AsciiMath</label>
                      </div>
                      <textarea
                        value={eProbText}
                        onChange={(e)=>setEProbText(e.target.value)}
                        rows={6}
                        placeholder="Wpisz obliczenia"
                        style={{ width:"100%", padding:10, borderRadius:12, border:"1px solid #ddd", fontSize:15 }}
                      />
                      <div style={{ marginTop:8 }}>
                        <div style={{ fontSize:12, color:"#666", marginBottom:4 }}>Podgląd</div>
                        <div
                          style={{ border:"1px solid #eee", borderRadius:10, padding:10, minHeight:48 }}
                          dangerouslySetInnerHTML={{ __html: editPreviewHtml }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight:600, fontSize:16 }}>{a.title}</div>
                      {a.description && <div style={{ fontSize:14, color:"#555", marginTop:4 }}>{a.description}</div>}
                    </div>
                  )}

                  {editingId === a.id ? (
                    <div>
                      <label style={{ fontSize:12, color:"#666" }}>Termin</label>
                      <input
                        type="datetime-local"
                        value={eDue}
                        onChange={e=>setEDue(e.target.value)}
                        style={{ width:"100%", padding:10, borderRadius:12, border:"1px solid #ddd", fontSize:15 }}
                      />
                    </div>
                  ) : (
                    <div style={{ fontSize:13, color:"#666", paddingTop:6 }}>
                      Termin: {a.dueAt ? new Date(a.dueAt).toLocaleString() : "—"}
                    </div>
                  )}

                  <div style={{ display:"flex", gap:8, paddingTop:6 }}>
                    {editingId === a.id ? (
                      <>
                        <button onClick={saveEdit} style={{ padding:"8px 12px", borderRadius:10, border:"1px solid #0a0", color:"#0a0" }}>
                          Zapisz
                        </button>
                        <button onClick={() => setEditingId(null)} style={{ padding:"8px 12px", borderRadius:10, border:"1px solid #aaa" }}>
                          Anuluj
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(a)} style={{ padding:"8px 12px", borderRadius:10, border:"1px solid #333" }}>
                          Edytuj
                        </button>
                        <button onClick={() => removeAssignment(a.id)} style={{ padding:"8px 12px", borderRadius:10, border:"1px solid #e11d48", color:"#e11d48" }}>
                          Usuń
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRAWA – wysyłka */}
        <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <b>Wyślij zadanie</b>
          <label style={{ display:"block", marginTop: 8, fontSize: 12, color:"#666" }}>Zadanie:</label>
          <select
            value={selAssignmentId}
            onChange={(e) => setSelAssignmentId(e.target.value)}
            style={{ width:"100%", padding: 10, borderRadius: 12, border: "1px solid #ddd", fontSize: 15 }}
          >
            {assignments.length === 0 && <option value="">(brak zadań)</option>}
            {assignments.map(a => (
              <option key={a.id} value={a.id}>{a.title}</option>
            ))}
          </select>

          <div style={{ marginTop: 12, fontSize: 12, color:"#666" }}>
            Uczniowie do wysyłki: {picked.length ? picked.map(p => shortName(p)).join(", ") : "Brak wybranych uczniów."}
          </div>

          <button
            type="button"
            onClick={assignToPicked}
            disabled={assigning}
            style={{
              marginTop: 10, padding: "10px 16px", borderRadius: 12,
              border: "1px solid #333", background: assigning ? "#555" : "#111",
              opacity: assigning ? 0.7 : 1, color:"#fff", cursor: assigning ? "not-allowed" : "pointer"
            }}
          >
            {assigning ? "Przydzielam..." : "Przydziel zadanie"}
          </button>

          {msg && <div style={{ marginTop: 12, color: msg.startsWith("Błąd") ? "#b91c1c" : "#166534" }}>{msg}</div>}
        </section>
      </div>

      {/* PANEL OCENIANIA */}
      <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, marginTop: 16 }}>
        <b>Oceń zgłoszenia</b>

        <label style={{ display:"block", marginTop: 8, fontSize: 12, color:"#666" }}>Zadanie:</label>
        <select
          value={gradeAid}
          onChange={e => setGradeAid(e.target.value)}
          style={{ width:"100%", padding:10, borderRadius:12, border:"1px solid #ddd", fontSize:15 }}
        >
          <option value="">(wybierz zadanie)</option>
          {assignments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select>

        {subs.length > 0 ? (
          <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:12, marginTop:12 }}>
            {/* lista zgłoszeń */}
            <div style={{ border:"1px solid #f0f0f0", borderRadius:10, maxHeight:300, overflow:"auto" }}>
              {subs
                .sort((a,b) => (a.status==="SUBMITTED"?-1:0) - (b.status==="SUBMITTED"?-1:0))
                .map(s => (
                <div key={s.id}
                     onClick={() => setSelSubId(String(s.id))}
                     style={{
                       padding:"10px", borderBottom:"1px solid #f5f5f5", cursor:"pointer",
                       background: String(selSubId)===String(s.id) ? "#f6faff" : "transparent"
                     }}>
                  <div style={{ fontWeight:600 }}>Zgłoszenie • uczeń {s.studentId}</div>
                  <div style={{ fontSize:12, color:"#555" }}>
                    Status: <b>{s.status || "—"}</b>{s.score!=null ? ` • Ocena: ${s.score}` : ""}
                  </div>
                </div>
              ))}
            </div>

            {/* szczegóły / formularz oceny */}
            <div style={{ border:"1px solid #f0f0f0", borderRadius:10, padding:12 }}>
              {selSub ? (
                <>
                  <div style={{ fontSize:12, color:"#666" }}>Zgłoszenie • uczeń {selSub.studentId}</div>

                  {problemPreview && (
                    <div style={{ marginTop:8 }}>
                      <div style={{ fontWeight:600 }}>Polecenie zadania:</div>
                      <pre style={{ whiteSpace:"pre-wrap", background:"#fafafa", padding:8, borderRadius:8, border:"1px solid #eee" }}>
{problemPreview.content}
                      </pre>
                    </div>
                  )}

                  <div style={{ marginTop:8 }}>
                    <div style={{ fontWeight:600 }}>Odpowiedź tekstowa ucznia:</div>
                    <pre style={{ whiteSpace:"pre-wrap", background:"#fafafa", padding:8, borderRadius:8, border:"1px solid #eee" }}>
{selSub.textAnswer || "(brak)"}
                    </pre>
                  </div>

                  <div style={{ marginTop:8 }}>
                    <div style={{ fontWeight:600 }}>Zapisane obliczenia (jeśli były):</div>
                    {formulas.length === 0 ? (
                      <div style={{ color:"#666" }}>(brak)</div>
                    ) : (
                      <ul style={{ margin:"6px 0 0 18px" }}>
                        {formulas.map(f => <li key={f.id}><code>{f.content}</code> {f.format ? `• ${f.format}` : ""}</li>)}
                      </ul>
                    )}
                  </div>

                  <div style={{ display:"grid", gridTemplateColumns:"120px 1fr", gap:12, marginTop:12 }}>
                    <div>
                      <label style={{ fontSize:12, color:"#666" }}>Ocena</label>
                      <input
                        type="number"
                        value={gradeScore}
                        onChange={e => setGradeScore(e.target.value)}
                        style={{ width:"100%", padding:8, borderRadius:10, border:"1px solid #ddd" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize:12, color:"#666" }}>Notatka dla ucznia (opcjonalnie)</label>
                      <textarea
                        rows={3}
                        value={gradeNote}
                        onChange={e => setGradeNote(e.target.value)}
                        style={{ width:"100%", padding:8, borderRadius:10, border:"1px solid #ddd" }}
                      />
                    </div>
                  </div>

                  <div style={{ display:"flex", gap:8, marginTop:10 }}>
                    <button
                      onClick={() => saveGrade("GRADED")}
                      style={{ padding:"8px 12px", borderRadius:10, border:"1px solid #0a0", color:"#0a0" }}>
                      Zatwierdź ocenę
                    </button>
                    <button
                      onClick={() => saveGrade("DRAFT")}
                      style={{ padding:"8px 12px", borderRadius:10, border:"1px solid #c2410c", color:"#c2410c" }}>
                      Cofnij do DRAFT
                    </button>
                    <button
                      onClick={() => saveGrade("SUBMITTED")}
                      style={{ padding:"8px 12px", borderRadius:10, border:"1px solid #0ea5e9", color:"#0ea5e9" }}>
                      Oznacz jako SUBMITTED
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ color:"#666" }}>(wybierz zgłoszenie z listy po lewej)</div>
              )}
            </div>
          </div>
        ) : (
          gradeAid && <div style={{ marginTop:8, color:"#666" }}>(brak zgłoszeń dla wybranego zadania)</div>
        )}
      </section>
    </>
  );
}
