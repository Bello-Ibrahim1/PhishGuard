import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

// Same risk colors as the extension panel's .pg-pill.low/.medium/.high (overlay.css) —
// referencing the CSS variables themselves (not copies of their current hex values) means
// a "High" slice stays the same red as a "High" pill there, AND both stay in sync with the
// light/dark theme swap in tokens.css automatically, with no re-render needed.
const COLORS: Record<string, string> = { Low: "var(--pg-safe)", Medium: "var(--pg-warn)", High: "var(--pg-danger)" };

export function RiskPie({
  data,
  onSliceClick,
  active,
}: {
  data: { name: string; value: number }[];
  onSliceClick?: (name: string) => void;
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
      <h3 style={{ margin: 0, marginBottom: 8, fontSize: 14, fontWeight: 700 }}>Risk Breakdown</h3>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer debounce={200} minWidth={0} minHeight={0}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={90}
              // recharts' default label color is a flat #808080 gray (its Pie/Text
              // component default, unrelated to each slice's own color) — legible-ish on
              // some backgrounds but low-contrast and not theme-aware, which is what made
              // the percentage labels here read as unreadable dark text. Pointing it at the
              // theme's own text color fixes both: real contrast in either theme, and it
              // moves automatically if the OS theme changes.
              label={{ fill: "var(--pg-text-sub)", fontSize: 11, fontWeight: 600 }}
              isAnimationActive={false}
              onClick={(entry: any) => onSliceClick?.(entry.name)}
              style={{ cursor: onSliceClick ? "pointer" : "default" }}
            >
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={COLORS[d.name] || "#888"}
                  opacity={!active || active === "All" || active === d.name ? 1 : 0.3}
                />
              ))}
            </Pie>
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
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
