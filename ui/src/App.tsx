import { useEffect, useMemo, useState } from "react";
import { fetchSummary, fetchReports, hasClientId, type Summary, type Report } from "./api";
import { TopBar } from "./components/TopBar";
import { StatCard, type RiskKey } from "./components/Cards";
import { RiskPie } from "./components/RiskPie";
import { RiskBar } from "./components/RiskBar";
import { ReportsTable } from "./components/ReportsTable";

export default function App() {
  const [sum, setSum] = useState<Summary | null>(null);
  const [items, setItems] = useState<Report[]>([]);
  const [filter, setFilter] = useState<RiskKey>("All");

  useEffect(() => {
    // Reports are stored per-installer now — without a ?uid=... on this page's own URL
    // there is no safe data to show (see CLIENT_UID/hasClientId in api.ts), so this
    // never even calls the backend in that case rather than showing someone else's data
    // or silently polling an endpoint that will only ever return empty.
    if (!hasClientId()) return;
    const load = async () => {
      try {
        const [s, r] = await Promise.all([fetchSummary(), fetchReports()]);
        setSum(s);
        setItems(r);
      } catch (_) {}
    };
    load();
    const h = setInterval(load, 2500);
    return () => clearInterval(h);
  }, []);

  const data = sum
    ? [
        { name: "Low", value: sum.by_risk.Low },
        { name: "Medium", value: sum.by_risk.Medium },
        { name: "High", value: sum.by_risk.High },
      ]
    : [];

  // Click "High" (the card, the pie slice, or the bar) to filter the table to just
  // High-risk emails; click it again (or "Total Scanned") to clear the filter.
  const toggle = (k: Exclude<RiskKey, "All">) => setFilter((f) => (f === k ? "All" : k));

  const filtered = useMemo(
    () => (filter === "All" ? items : items.filter((i) => i.risk === filter)),
    [items, filter]
  );

  // Opened directly (no ?uid=...) rather than from the extension's "Full report" button —
  // there's no installer to scope this to, so show that plainly instead of an empty
  // dashboard that looks broken or, worse, one that fell back to showing everyone's data.
  if (!hasClientId()) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <TopBar />
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 40,
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 420 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
              No report to show
            </div>
            <div style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.5 }}>
              Open this from PhishGuard's "Full report" button in the extension popup —
              that link includes the id that connects it to your own scanned emails.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopBar />
      <div
        style={{
          padding: 20,
          display: "grid",
          gridTemplateColumns: "repeat(12, minmax(0,1fr))",
          gap: 16,
        }}
      >
        <div style={{ gridColumn: "span 3" }}>
          <StatCard
            title="Total Scanned"
            value={sum?.total ?? 0}
            riskKey="All"
            active={filter === "All"}
            onClick={() => setFilter("All")}
          />
        </div>
        <div style={{ gridColumn: "span 3" }}>
          <StatCard
            title="Low Risk"
            value={sum?.by_risk.Low ?? 0}
            riskKey="Low"
            active={filter === "Low"}
            onClick={() => toggle("Low")}
          />
        </div>
        <div style={{ gridColumn: "span 3" }}>
          <StatCard
            title="Medium Risk"
            value={sum?.by_risk.Medium ?? 0}
            riskKey="Medium"
            active={filter === "Medium"}
            onClick={() => toggle("Medium")}
          />
        </div>
        <div style={{ gridColumn: "span 3" }}>
          <StatCard
            title="High Risk"
            value={sum?.by_risk.High ?? 0}
            riskKey="High"
            active={filter === "High"}
            onClick={() => toggle("High")}
          />
        </div>
        <div style={{ gridColumn: "span 6" }}>
          <RiskPie data={data} active={filter} onSliceClick={(name) => toggle(name as Exclude<RiskKey, "All">)} />
        </div>
        <div style={{ gridColumn: "span 6" }}>
          <RiskBar data={data} active={filter} onBarClick={(name) => toggle(name as Exclude<RiskKey, "All">)} />
        </div>
        <div style={{ gridColumn: "span 12" }}>
          <ReportsTable items={filtered} filter={filter} onClearFilter={() => setFilter("All")} />
        </div>
      </div>
    </div>
  );
}
