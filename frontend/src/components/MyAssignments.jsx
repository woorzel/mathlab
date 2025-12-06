import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../api";

export default function MyAssignments({ auth, onStarted }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!auth) return;
    setLoading(true);
    setErr("");
    apiGet(`/api/assignments/assigned?studentId=${auth.userId}`, auth.token)
      .then(data => setList(Array.isArray(data) ? data : []))
      .catch(e => {
        setErr(e?.message || String(e));
        setList([]);
      })
      .finally(() => setLoading(false));
  }, [auth]);

  async function start(a) {
    try {
      const sub = await apiPost(
        "/api/submissions",
        { assignmentId: a.id, studentId: auth.userId, textAnswer: "" },
        auth.token
      );
      onStarted?.(sub);
    } catch (e) {
      alert("Nie udało się rozpocząć: " + (e.message || e));
    }
  }

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
      <b>Moje zadania</b>

      {loading && <div style={{ marginTop: 8 }}>Wczytywanie…</div>}
      {err && <div style={{ color: "#b91c1c", marginTop: 8 }}>Błąd: {err}</div>}

      {!loading && list.length === 0 && (
        <div style={{ color: "#666", marginTop: 8 }}>Brak przydzielonych zadań.</div>
      )}

      {!loading && list.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
            marginTop: 8,
          }}
        >
          {list.map((a) => (
            <div key={a.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 600 }}>#{a.id} — {a.title}</div>
              {a.description && <div style={{ color: "#444", marginTop: 6 }}>{a.description}</div>}
              <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                Termin: {a.dueAt ? new Date(a.dueAt).toLocaleString() : "—"}
              </div>
              <button
                onClick={() => start(a)}
                style={{ marginTop: 8, padding: "6px 10px", borderRadius: 10, border: "1px solid #ccc", cursor: "pointer" }}
              >
                Rozpocznij
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
