import { useState } from "react";
import { apiPost } from "../api";

export default function CreateProblem({ auth, assignmentId, onCreated }) {
  const [contentMd, setContentMd] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function submit(e) {
    e.preventDefault(); setErr(""); setOk("");
    try {
      if (!assignmentId) throw new Error("Wybierz zadanie powyżej.");
      const body = { assignmentId: Number(assignmentId), authorId: auth.userId, contentMd };
      const json = await apiPost("/api/problems", body, auth.token);
      setOk(`Dodano problem #${json.id}.`);
      setContentMd("");
      onCreated?.(json);
    } catch (ex) { setErr(String(ex)); }
  }

  return (
    <form onSubmit={submit} style={{ display:"grid", gap:8, border:"1px solid #eee", borderRadius:12, padding:12 }}>
      <b>Nowy problem dla zadania #{assignmentId || "—"}</b>
      <textarea value={contentMd} onChange={e=>setContentMd(e.target.value)} placeholder="Treść w Markdown/TeX" rows={4} />
      <button>Dodaj problem</button>
      {ok && <div style={{ color:"#16a34a" }}>{ok}</div>}
      {err && <div style={{ color:"#b91c1c" }}>{err}</div>}
    </form>
  );
}
