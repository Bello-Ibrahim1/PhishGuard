import { useEffect, useState } from "react";

// ---- change this to your API if needed ----
const API = "http://127.0.0.1:8000";

// ---------------- App ----------------
export default function App() {
  return (
    <div style={page}>
      <h1 style={h1}>PhishGuard — Try a Message</h1>
      <TryMessageCard />
      <div style={{ height: 16 }} />
      <h2 style={h2}>PhishGuard — Live Dashboard</h2>
      <Kpis />
      <RiskBars />
      <RecentTable />
    </div>
  );
}

// ---------------- Try Message form ----------------
function TryMessageCard() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function scoreNow() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${API}/email/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      if (!res.ok) throw new Error(`Server ${res.status}`);
      setResult(await res.json());
    } catch (e: any) {
      setError(e.message || "Failed to score");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={card}>
      <label style={label}>
        Subject
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g., INVOICE OVERDUE"
          style={input}
        />
      </label>

      <label style={label}>
        Body
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="e.g., Please pay now at http://short.co/pay"
          rows={6}
          style={textarea}
        />
      </label>

      <button onClick={scoreNow} disabled={loading} style={btn}>
        {loading ? "Scoring..." : "Score now"}
      </button>

      {error && <div style={{ color: "#ef4444" }}>Error: {error}</div>}

      {result && (
        <div style={resultBox}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
            <Badge risk={result.risk} />
            <div>Score: <b>{result.score}</b></div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <b>Reasons:</b>
            <ul>
              {result.reasons?.map((r: string, i: number) => <li key={i}>{r}</li>)}
            </ul>
          </div>
          <div>
            <b>IoCs:</b>
            <div style={{ fontSize: 14, opacity: 0.9 }}>
              URLs: {result.iocs?.urls?.join(", ") || "—"}<br />
              Domains: {result.iocs?.domains?.join(", ") || "—"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- KPI Cards ----------------
function Kpis() {
  const [sum, setSum] = useState<any>({ total: 0, low: 0, medium: 0, high: 0 });

  useEffect(() => {
    let timer: any;
    const tick = async () => {
      try {
        const r = await fetch(`${API}/reports/summary`);
        if (r.ok) setSum(await r.json());
      } catch {}
      timer = setTimeout(tick, 1000);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

  const cardOne = (label: string, value: number, color: string) => (
    <div style={kpiCard}>
      <div style={{ fontSize: 12, opacity: 0.8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6, color }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
      {cardOne("Total Scanned", sum.total, "#93c5fd")}
      {cardOne("Medium Risk", sum.medium, "#eab308")}
      {cardOne("High Risk", sum.high, "#ef4444")}
    </div>
  );
}

// ---------------- Risk Bars ----------------
function RiskBars() {
  const [sum, setSum] = useState<any>({ total: 0, low: 0, medium: 0, high: 0 });

  useEffect(() => {
    let timer: any;
    const tick = async () => {
      try {
        const r = await fetch(`${API}/reports/summary`);
        if (r.ok) setSum(await r.json());
      } catch {}
      timer = setTimeout(tick, 1200);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

  const total = Math.max(1, sum.total);
  const pct = (n: number) => Math.round((n / total) * 100);

  const row = (label: string, n: number, color: string) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.9 }}>
        <span>{label}</span><span>{n}</span>
      </div>
      <div style={barOuter}>
        <div style={{ ...barInner, width: `${pct(n)}%`, background: color }} />
      </div>
    </div>
  );

  return (
    <div style={card}>
      {row("Low", sum.low, "#22c55e")}
      {row("Medium", sum.medium, "#eab308")}
      {row("High", sum.high, "#ef4444")}
    </div>
  );
}

// ---------------- Recent Table ----------------
function RecentTable() {
  const [rows, setRows] = useState<any[]>([]);
  const [ts, setTs] = useState(0);

  useEffect(() => {
    let timer: any;
    const tick = async () => {
      try {
        const r = await fetch(`${API}/reports/recent?limit=50`);
        if (r.ok) {
          const data = await r.json();
          setRows(data);
          setTs(Date.now());
        }
      } catch {}
      timer = setTimeout(tick, 1200);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

  const RiskChip = ({ r }: { r: string }) => {
    const c = r === "High" ? "#ef4444" : r === "Medium" ? "#eab308" : "#22c55e";
    return (
      <span style={{ background: c, color: "#0b1220", padding: "2px 8px", borderRadius: 999, fontWeight: 700 }}>
        {r}
      </span>
    );
  };

  return (
    <div style={card}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Recent Reports</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", opacity: 0.8 }}>
              <th style={th}>Time</th>
              <th style={th}>Risk</th>
              <th style={th}>Sender</th>
              <th style={th}>Subject</th>
              <th style={th}>Reasons</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: "1px solid #1f2937" }}>
                <td style={td}>{r.time || "—"}</td>
                <td style={td}><RiskChip r={r.risk} /></td>
                <td style={td}>{r.sender || "—"}</td>
                <td style={td}>{r.subject || "—"}</td>
                <td style={td}>{(r.reasons || []).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ opacity: 0.5, fontSize: 12, marginTop: 6 }}>
        Updated: {new Date(ts).toLocaleTimeString()}
      </div>
    </div>
  );
}

// ---------------- Small UI bits ----------------
function Badge({ risk }: { risk: string }) {
  const color = risk === "High" ? "#ef4444" : risk === "Medium" ? "#eab308" : "#22c55e";
  return (
    <span style={{ padding: "4px 10px", borderRadius: 999, background: color, color: "#0b1220", fontWeight: 800 }}>
      {risk}
    </span>
  );
}

// ---------------- Styles (matching your tokens) ----------------
const page: React.CSSProperties = { minHeight: "100vh", background: "#0f172a", color: "white", padding: 24, fontFamily: "ui-sans-serif, system-ui, -apple-system" };
const card: React.CSSProperties = { background: "#111827", padding: 16, borderRadius: 12, border: "1px solid #1f2937", maxWidth: 1100 };
const resultBox: React.CSSProperties = { marginTop: 8, padding: 12, border: "1px solid #374151", borderRadius: 10, background: "#0b1220" };
const input: React.CSSProperties = { width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #334155", background: "#0b1220", color: "white", marginTop: 6 };
const textarea = input;
const btn: React.CSSProperties = { background: "#3b82f6", color: "white", padding: "10px 16px", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 600, marginTop: 4 };
const label: React.CSSProperties = { display: "block", marginBottom: 8, fontSize: 14 };
const h1: React.CSSProperties = { fontSize: 24, marginBottom: 12 };
const h2: React.CSSProperties = { fontSize: 20, margin: "16px 0 12px" };
const kpiCard = { flex: 1, background: "#111827", padding: 16, borderRadius: 12, border: "1px solid #1f2937" } as React.CSSProperties;
const barOuter = { height: 10, background: "#0b1220", borderRadius: 6, border: "1px solid #1f2937" } as React.CSSProperties;
const barInner = { height: "100%", borderRadius: 6 } as React.CSSProperties;
const th: React.CSSProperties = { padding: "8px" };
const td: React.CSSProperties = { padding: "8px" };