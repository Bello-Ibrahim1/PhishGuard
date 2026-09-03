import { useEffect, useState } from "react";
import type { Report } from "../api";

// Same pill colors as the extension panel's .pg-pill.low/.medium/.high (overlay.css).
const PILL_BG: Record<string, string> = {
  Low: "var(--pg-safe-bg)",
  Medium: "var(--pg-warn-bg)",
  High: "var(--pg-danger-bg)",
};
const PILL_COLOR: Record<string, string> = {
  Low: "var(--pg-safe)",
  Medium: "var(--pg-warn)",
  High: "var(--pg-danger)",
};

// PhishGuard stores every timestamp as a UTC ISO string (e.g. "2026-01-29T18:32:00.000Z" —
// see panel.js's resolveReceivedAt()). Previously this table just sliced that string
// ("2026-01-29 18:32:00") and displayed it as-is, which is UTC mislabeled as local time —
// wrong by however many hours your timezone is offset from UTC. `Intl.DateTimeFormat` with
// no explicit timeZone reads the browser's CURRENT timezone at render time instead, so this
// is always correct for wherever you are right now: change your system timezone (or open
// the dashboard from a different one while traveling) and the next render just picks it up
// automatically — no GPS/location permission needed, since the OS's timezone setting is
// already the accurate signal for "what time is it here," not raw coordinates.
const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const timeFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  hour12: false,
});
function formatLocalTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return timeFormatter.format(d).replace(",", "");
}

const PAGE = 200;

export function ReportsTable({
  items,
  filter,
  onClearFilter,
}: {
  items: Report[];
  filter: string;
  onClearFilter: () => void;
}) {
  const [visible, setVisible] = useState(PAGE);
  // "All" plus every source seen in the reports so far — scanning Gmail and Outlook (or
  // Yahoo) previously landed every result in one indistinguishable pile with nothing
  // showing which mailbox a row came from. Fixed set of the three supported adapters
  // rather than deriving it from `items`, so the filter's own options don't shift around
  // as the risk filter above it narrows what's currently shown.
  const SOURCES = ["All", "Gmail", "Outlook", "Yahoo Mail"];
  const [sourceFilter, setSourceFilter] = useState("All");
  // Reset paging whenever a filter changes (or a fresh poll swaps the underlying set) so
  // switching filters doesn't leave you scrolled past the end.
  useEffect(() => {
    setVisible(PAGE);
  }, [filter, sourceFilter]);

  // Sort by the email's actual timestamp (received time when known, scan time as a
  // fallback — see resolveReceivedAt() in panel.js), not by ingestion/API order. Those two
  // orders drift apart in practice — a scan doesn't always walk the inbox in strict
  // newest-to-oldest order, and results from different scans (visible-page vs. full API
  // scan) interleave by whenever they were ingested — so relying on ingestion order made
  // "Recent Reports" look scattered even once each row's own timestamp was correct.
  // Missing timestamps sort last rather than first.
  const ordered = items.slice().sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : -Infinity;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : -Infinity;
    return tb - ta;
  });
  const bySource = sourceFilter === "All" ? ordered : ordered.filter((r) => (r.source || "Unknown") === sourceFilter);
  const shown = bySource.slice(0, visible);

  return (
    <div
      style={{
        background: "var(--pg-card)",
        border: "1px solid var(--pg-border-soft)",
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
            {filter === "All" ? "Recent Reports" : `${filter} Risk Reports`} ({bySource.length})
          </h3>
          <div style={{ fontSize: 11, color: "var(--pg-text-faint)", marginTop: 2 }}>
            Times shown in your local timezone ({LOCAL_TZ})
          </div>
        </div>
        {filter !== "All" && (
          <button
            onClick={onClearFilter}
            style={{
              background: "var(--pg-wash-2)",
              border: "1px solid var(--pg-border-soft)",
              borderRadius: 8,
              color: "var(--pg-text-sub)",
              fontSize: 11.5,
              fontWeight: 600,
              padding: "5px 10px",
              cursor: "pointer",
            }}
          >
            Clear filter ✕
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {SOURCES.map((s) => (
          <button
            key={s}
            onClick={() => setSourceFilter(s)}
            style={{
              background: sourceFilter === s ? "var(--pg-accent-grad)" : "var(--pg-wash-2)",
              border: "1px solid " + (sourceFilter === s ? "transparent" : "var(--pg-border-soft)"),
              borderRadius: 999,
              color: sourceFilter === s ? "#fff" : "var(--pg-text-sub)",
              fontSize: 11.5,
              fontWeight: 700,
              padding: "4px 12px",
              cursor: "pointer",
            }}
          >
            {s}
          </button>
        ))}
      </div>
      <div style={{ overflow: "auto", maxHeight: "60vh" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ position: "sticky", top: 0, background: "var(--pg-card)", zIndex: 1 }}>
            <tr style={{ textAlign: "left", color: "var(--pg-text-sub)", fontSize: 11.5 }}>
              <th style={{ padding: "8px" }}>Time</th>
              <th style={{ padding: "8px" }}>Source</th>
              <th style={{ padding: "8px" }}>Risk</th>
              <th style={{ padding: "8px" }}>Sender</th>
              <th style={{ padding: "8px" }}>Subject</th>
              <th style={{ padding: "8px" }}>Reasons</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, idx) => (
              <tr key={idx} style={{ borderTop: "1px solid var(--pg-border-soft)" }}>
                <td
                  style={{ padding: "8px", whiteSpace: "nowrap", color: "var(--pg-text-faint)" }}
                  title={r.timestamp ? `${r.timestamp} (UTC)` : ""}
                >
                  {formatLocalTime(r.timestamp)}
                </td>
                <td style={{ padding: "8px", color: "var(--pg-text-sub)", fontSize: 12, whiteSpace: "nowrap" }}>
                  {r.source || "Unknown"}
                </td>
                <td style={{ padding: "8px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "3px 9px",
                      borderRadius: 999,
                      fontWeight: 800,
                      fontSize: 10.5,
                      background: PILL_BG[r.risk] || "var(--pg-wash-3)",
                      color: PILL_COLOR[r.risk] || "var(--pg-text)",
                    }}
                  >
                    {r.risk}
                  </span>
                </td>
                <td style={{ padding: "8px" }}>{r.sender || ""}</td>
                <td
                  style={{
                    padding: "8px",
                    maxWidth: 380,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={r.email_subject || ""}
                >
                  {r.gmailLink ? (
                    <a
                      href={r.gmailLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "inherit", textDecoration: "none" }}
                      onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                    >
                      {r.email_subject || ""}
                    </a>
                  ) : (
                    r.email_subject || ""
                  )}
                </td>
                <td style={{ padding: "8px", color: "var(--pg-text-sub)", fontSize: 12 }}>
                  {(r.reasons || []).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible < bySource.length && (
          <div style={{ textAlign: "center", padding: "12px 0 4px" }}>
            <button
              onClick={() => setVisible((v) => v + PAGE)}
              style={{
                background: "var(--pg-wash-2)",
                border: "1px solid var(--pg-border-soft)",
                borderRadius: 10,
                color: "var(--pg-text)",
                fontSize: 12.5,
                fontWeight: 700,
                padding: "8px 16px",
                cursor: "pointer",
              }}
            >
              Load {Math.min(PAGE, bySource.length - visible)} more ({bySource.length - visible} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
