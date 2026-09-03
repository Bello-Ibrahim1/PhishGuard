import { useEffect, useMemo, useState } from "react";
import { fetchSummary, fetchReports, type Summary, type Report } from "./api";
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
