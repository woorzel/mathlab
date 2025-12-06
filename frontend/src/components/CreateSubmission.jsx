import { useState } from "react";
import { apiPost } from "../api";

export default function CreateSubmission({ auth, onCreated }) {
  const [assignmentId, setAssignmentId] = useState("");
  const [textAnswer, setTextAnswer] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function submit(e) {
    e.preventDefault(); setErr(""); setOk("");
    try {
      if (!assignmentId) throw new Error("Podaj identyfikator zadania (assignmentId).");
      const body = { assignmentId: Number(assignmentId), studentId: auth.userId, textAnswer };
      const json = await apiPost("/api/submissions", body, auth.token);
      setOk(`Utworzono zgłoszenie #${json.id}.`);
      setTextAnswer(""); setAssignmentId("");
      onCreated?.(json);
    } catch (ex) { setErr(String(ex)); }
  }

  return (
    <form onSubmit={submit} style={{ display:"grid", gap:8, border:"1px solid #eee", borderRadius:12, padding:12 }}>
      <b>Nowe zgłoszenie (Twoja odpowiedź)</b>
      <input value={assignmentId} onChange={e=>setAssignmentId(e.target.value)} placeholder="ID zadania od nauczyciela" />
      <textarea value={textAnswer} onChange={e=>setTextAnswer(e.target.value)} placeholder="Krótka odpowiedź" rows={3} />
      <button>Wyślij zgłoszenie</button>
      {ok && <div style={{ color:"#16a34a" }}>{ok}</div>}
      {err && <div style={{ color:"#b91c1c" }}>{err}</div>}
    </form>
  );
}
