import { useState } from "react";
import { apiPost } from "../api";

export default function AssignStudents({ auth, assignmentId }) {
  const [ids, setIds] = useState("");
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setOk(""); setErr("");
    try {
      if (!assignmentId) throw new Error("Najpierw wybierz zadanie.");
      const studentIds = ids
        .split(/[,\s;]+/)       // liczby rozdzielone przecinkiem/spacją/średnikiem
        .map(s => Number(s))
        .filter(n => Number.isFinite(n) && n > 0);

      if (studentIds.length === 0) throw new Error("Podaj co najmniej jedno ID ucznia.");

      await apiPost(`/api/assignments/${assignmentId}/students`, { studentIds }, auth.token);
      setOk(`Przydzielono zadanie #${assignmentId} uczniom: ${studentIds.join(", ")}.`);
      setIds("");
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  return (
    <form onSubmit={submit} style={{ display:"grid", gap:8, border:"1px solid #eee", borderRadius:12, padding:12 }}>
      <b>Przydziel zadanie uczniom</b>
      <input
        value={ids}
        onChange={e=>setIds(e.target.value)}
        placeholder="Identyfikatory uczniów, np.: 2, 5, 7"
      />
      <small style={{color:"#666"}}>
        Tip: na razie wprowadzamy ID ucznia ręcznie (np. z bazy / rejestracji). Później można dodać wybór po e-mailu.
      </small>
      <button>Przydziel</button>
      {ok && <div style={{ color:"#16a34a" }}>{ok}</div>}
      {err && <div style={{ color:"#b91c1c" }}>{err}</div>}
    </form>
  );
}
