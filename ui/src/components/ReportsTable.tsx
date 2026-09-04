import { useEffect, useState } from "react";
import type { Report, Summary } from "../api";
import { downloadReportsCSV, openPrintableReport } from "../export";
import { LOCAL_TZ, formatLocalTime } from "../format";

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

const PAGE = 200;

export function ReportsTable({
  items,
  filter,
  onClearFilter,
  summary,
}: {
  items: Report[];
  filter: string;
  onClearFilter: () => void;
  summary: Summary | null;
}) {
  const [visible, setVisible] = useState(PAGE);
  // "All" plus every source seen in the reports so far — scanning Gmail and Outlook (or
  // Yahoo) previously landed every result in one indistinguishable pile with nothing
  // showing which mailbox a row came from. Fixed set of the three supported adapters
  // rather than deriving it from `items`, so the filter's own options don't shift around
  // as the risk filter above it narrows what's currently shown.
  const SOURCES = ["All", "Gmail", "Outlook", "Yahoo Mail"];
  const [sourceFilter, setSourceFilter] = useState("All");
  // Date range filter (inclusive, both ends optional) — for an IT professional pulling up
  // "everything from Feb to April 2023", say. Plain "YYYY-MM-DD" strings straight out of the
  // native <input type="date">; interpreted as *local* calendar days (see byDate below), same
  // as every other timestamp on this page (formatLocalTime/LOCAL_TZ).
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  // Reset paging whenever a filter changes (or a fresh poll swaps the underlying set) so
  // switching filters doesn't leave you scrolled past the end.
  useEffect(() => {
    setVisible(PAGE);
  }, [filter, sourceFilter, dateFrom, dateTo]);

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
  // Only meaningful for emails PhishGuard has actually scanned — a row with no timestamp at
  // all (shouldn't normally happen, but cheaper to guard than assume) is excluded rather than
  // guessed into a range. Coverage is otherwise limited by what's been scanned: the DOM-based
  // "Scan visible"/"Scan all" only ever sees what Gmail has rendered on screen, so reaching
  // back to an old date range in practice means having run a Full inbox (Gmail API) scan first
  // — that's the only path that walks the whole mailbox instead of whatever's currently open.
  const byDate = bySource.filter((r) => {
    if (!dateFrom && !dateTo) return true;
    if (!r.timestamp) return false;
    const t = new Date(r.timestamp).getTime();
    if (isNaN(t)) return false;
    if (dateFrom && t < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
    if (dateTo && t > new Date(`${dateTo}T23:59:59.999`).getTime()) return false;
    return true;
  });
  const shown = byDate.slice(0, visible);

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
            {filter === "All" ? "Recent Reports" : `${filter} Risk Reports`} ({byDate.length})
          </h3>
          <div style={{ fontSize: 11, color: "var(--pg-text-faint)", marginTop: 2 }}>
            Times shown in your local timezone ({LOCAL_TZ})
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
          <button
            onClick={() => downloadReportsCSV(byDate)}
            title="Download the rows currently shown below as a CSV file"
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
            Export CSV
          </button>
          <button
            onClick={() => {
              const scope =
                (filter === "All" ? "all scanned emails" : `${filter} risk emails`) +
                (sourceFilter === "All" ? "" : ` — ${sourceFilter} only`) +
                (dateFrom || dateTo ? ` — ${dateFrom || "the beginning"} to ${dateTo || "now"}` : "");
              const opened = openPrintableReport(byDate, summary, scope);
              if (!opened) window.alert("Your browser blocked the report tab — allow pop-ups for this site and try again.");
            }}
            title="Open a clean, printable version of the rows currently shown below (Save as PDF from the print dialog)"
            style={{
              background: "var(--pg-accent-grad)",
              border: "1px solid transparent",
              borderRadius: 8,
              color: "#fff",
              fontSize: 11.5,
              fontWeight: 700,
              padding: "5px 10px",
              cursor: "pointer",
            }}
          >
            Print / Save PDF
          </button>
        </div>
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 12,
          padding: "8px 10px",
          background: "var(--pg-wash-2)",
          border: "1px solid var(--pg-border-soft)",
          borderRadius: 10,
        }}
      >
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--pg-text-sub)" }}>Date range:</span>
        <input
          type="date"
          value={dateFrom}
          max={dateTo || undefined}
          onChange={(e) => setDateFrom(e.target.value)}
          style={{
            background: "var(--pg-card)",
            border: "1px solid var(--pg-border-soft)",
            borderRadius: 8,
            color: "var(--pg-text)",
            fontSize: 12,
            padding: "4px 8px",
          }}
        />
        <span style={{ fontSize: 11.5, color: "var(--pg-text-faint)" }}>to</span>
        <input
          type="date"
          value={dateTo}
          min={dateFrom || undefined}
          onChange={(e) => setDateTo(e.target.value)}
          style={{
            background: "var(--pg-card)",
            border: "1px solid var(--pg-border-soft)",
            borderRadius: 8,
            color: "var(--pg-text)",
            fontSize: 12,
            padding: "4px 8px",
          }}
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--pg-text-sub)",
              fontSize: 11.5,
              fontWeight: 600,
              cursor: "pointer",
              padding: "4px 6px",
            }}
          >
            Clear ✕
          </button>
        )}
        <span style={{ fontSize: 11, color: "var(--pg-text-faint)", marginLeft: "auto" }}>
          Only covers emails already scanned — run "Full inbox (Gmail API)" from the extension first for full historical coverage.
        </span>
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
        {visible < byDate.length && (
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
              Load {Math.min(PAGE, byDate.length - visible)} more ({byDate.length - visible} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
