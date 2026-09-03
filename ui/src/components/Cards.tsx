export type RiskKey = "All" | "Low" | "Medium" | "High";

const RISK_COLOR: Record<Exclude<RiskKey, "All">, string> = {
  Low: "var(--pg-safe)",
  Medium: "var(--pg-warn)",
  High: "var(--pg-danger)",
};
const RISK_BG: Record<Exclude<RiskKey, "All">, string> = {
  Low: "var(--pg-safe-bg)",
  Medium: "var(--pg-warn-bg)",
  High: "var(--pg-danger-bg)",
};

/**
 * Clicking a card filters the table below to that risk level (click again, or
 * click "Total Scanned", to clear it) — same interaction the extension panel
 * itself doesn't have, but it's the natural "click the 18 to see the 18"
 * behavior for a dashboard with a real table underneath it.
 */
export function StatCard({
  title,
  value,
  riskKey,
  active,
  onClick,
}: {
  title: string;
  value: number;
  riskKey: RiskKey;
  active: boolean;
  onClick: () => void;
}) {
  const color = riskKey === "All" ? "var(--pg-accent-1)" : RISK_COLOR[riskKey];
  const activeBg = riskKey === "All" ? "rgba(99,102,241,.12)" : RISK_BG[riskKey];
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        background: active ? activeBg : "var(--pg-wash-1)",
        border: "1px solid " + (active ? color : "var(--pg-border-soft)"),
        borderRadius: 16,
        padding: 16,
        transition: "background .15s, border-color .15s",
        font: "inherit",
        color: "inherit",
      }}
    >
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: "var(--pg-text-sub)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {title}
        {riskKey !== "All" && (
          <span style={{ fontSize: 9.5, opacity: 0.65, fontWeight: 700 }}>
            {active ? "SHOWING" : "CLICK TO FILTER"}
          </span>
        )}
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
    </button>
  );
}
