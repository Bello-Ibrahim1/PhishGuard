import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell } from "recharts";

// References the CSS variables themselves (see tokens.css) rather than copying their
// current hex values, so bar colors stay in sync with the light/dark theme swap.
const COLORS: Record<string, string> = { Low: "var(--pg-safe)", Medium: "var(--pg-warn)", High: "var(--pg-danger)" };

export function RiskBar({
  data,
  onBarClick,
  active,
}: {
  data: { name: string; value: number }[];
  onBarClick?: (name: string) => void;
  active?: string;
}) {
  return (
    <div
      style={{
        background: "var(--pg-card)",
        border: "1px solid var(--pg-border-soft)",
        borderRadius: 16,
        padding: 16,
      }}
    >
      <h3 style={{ margin: 0, marginBottom: 8, fontSize: 14, fontWeight: 700 }}>Risk Counts</h3>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer debounce={200} minWidth={0} minHeight={0}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--pg-wash-3)" />
            {/* Was hardcoded to a fixed gray (#8b96ab) that only reads correctly against a
                dark panel — on the light theme's near-white cards it dropped below ~2.5:1
                contrast, the same "can't see the axis text" problem as the pie chart's
                default label color. var(--pg-text-sub) tracks the active theme instead. */}
            <XAxis dataKey="name" stroke="var(--pg-text-sub)" tick={{ fill: "var(--pg-text-sub)", fontSize: 12 }} />
            <YAxis allowDecimals={false} stroke="var(--pg-text-sub)" tick={{ fill: "var(--pg-text-sub)", fontSize: 12 }} />
            <Tooltip
              // contentStyle only colors the tooltip's outer wrapper div — recharts'
              // DefaultTooltipContent then renders each row's *value* with its own inline
              // style that defaults to a hardcoded color: entry.color || '#000' (flat
              // black), which wins over the inherited wrapper color regardless of theme.
              // That's the actual "numbers are unreadable on hover" bug — itemStyle below
              // overrides that default explicitly instead of relying on inheritance.
              contentStyle={{
                background: "var(--pg-panel-solid)",
                border: "1px solid var(--pg-border)",
                borderRadius: 10,
                color: "var(--pg-text)",
              }}
              itemStyle={{ color: "var(--pg-text)" }}
              labelStyle={{ color: "var(--pg-text-sub)" }}
              cursor={{ fill: "var(--pg-wash-1)" }}
            />
            <Bar
              dataKey="value"
              radius={[6, 6, 0, 0]}
              isAnimationActive={false}
              onClick={(entry: any) => onBarClick?.(entry.name)}
              style={{ cursor: onBarClick ? "pointer" : "default" }}
            >
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={COLORS[d.name] || "#888"}
                  opacity={!active || active === "All" || active === d.name ? 1 : 0.3}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
