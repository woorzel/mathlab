import { useState } from "react";
import { apiPost } from "../api";

export default function CreateAssignment({ auth, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  function toIsoZ(localStr) {
    if (!localStr) return null;
    const d = new Date(localStr);
    return d.toISOString();
  }

  async function submit(e) {
    e.preventDefault(); setErr(""); setOk("");
    try {
      const body = {
        teacherId: auth.userId,
        title,
        description,
        dueAt: dueLocal ? toIsoZ(dueLocal) : null
      };
      const json = await apiPost("/api/assignments", body, auth.token);
      setOk(`Dodano zadanie #${json.id}.`);
      setTitle(""); setDescription(""); setDueLocal("");
      onCreated?.(json);
    } catch (ex) { setErr(String(ex)); }
  }

  return (
    <form onSubmit={submit} style={{ display:"grid", gap:8, border:"1px solid #eee", borderRadius:12, padding:12 }}>
      <b>Nowe zadanie</b>
      <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Tytuł" required />
      <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Opis (opcjonalnie)" />
      <label>
        Termin (opcjonalnie):
        <input type="datetime-local" value={dueLocal} onChange={e=>setDueLocal(e.target.value)} />
      </label>
      <button>Utwórz</button>
      {ok && <div style={{ color:"#16a34a" }}>{ok}</div>}
      {err && <div style={{ color:"#b91c1c" }}>{err}</div>}
    </form>
  );
}
