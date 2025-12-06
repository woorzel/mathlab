import { useEffect, useState } from "react";
import { apiGet } from "../api";

export default function StatsPanel({ auth }) {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const s = await apiGet("/api/stats/overview", auth.token);
        setStats(s);
      } catch (e) {
        setErr(String(e));
      }
    })();
  }, [auth]);

  if (err) return <div style={{ color:"#b91c1c" }}>Błąd statystyk: {err}</div>;
  if (!stats) return <div>Ładowanie statystyk…</div>;

  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12 }}>
      <div style={karta}><b>Zadania</b><div style={duze}>{stats.assignments}</div></div>
      <div style={karta}><b>Zgłoszenia</b><div style={duze}>{stats.submissions}</div></div>
      <div style={karta}><b>Formuły</b><div style={duze}>{stats.formulas}</div></div>
    </div>
  );
}

const karta = { border:"1px solid #eee", borderRadius:12, padding:12 };
const duze  = { fontSize:28 };
