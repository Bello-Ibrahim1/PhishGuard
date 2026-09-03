export const API_BASE = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) || "http://127.0.0.1:8000";

export type Summary = { total: number; by_risk: { Low: number; Medium: number; High: number } };
export type Report = {
  email_subject?: string;
  sender?: string;
  risk: "Low" | "Medium" | "High";
  reasons?: string[];
  timestamp?: string;
  /** Deep link straight to the real email in Gmail — only set when the extension could
   *  derive a real Gmail API message id (see gmail_link in panel.js's /ingest/report call).
   *  Undefined for Outlook/Yahoo reports, or Gmail rows Google didn't expose an id for. */
  gmailLink?: string;
  /** Which inbox this was scanned from — "Gmail" | "Outlook" | "Yahoo Mail" | "Unknown"
   *  (older reports ingested before this field existed have none). */
  source?: string;
};

/** Dashboard data comes from the same place as the extension: /ingest/report → REPORTS */
export async function fetchSummary(): Promise<Summary> {
  const r = await fetch(`${API_BASE}/reports/summary`);
  if (!r.ok) throw new Error(`summary failed ${r.status}`);
  const j = await r.json();
  return {
    total: j.total ?? 0,
    by_risk: {
      Low: j.low ?? 0,
      Medium: j.medium ?? 0,
      High: j.high ?? 0,
    },
  };
}

// 20000 comfortably covers a full inbox scan (the backend itself now keeps up to
// 50000 reports — see REPORTS in sentinel/main.py — this was previously capped at
// 500 here on top of the backend's old 1000-item cap, silently truncating anything
// scanned past the first 500-1000 emails).
const RECENT_LIMIT = 20000;

/** Recent reports from extension scans (same list as /reports/summary) */
export async function fetchReports(): Promise<Report[]> {
  const r = await fetch(`${API_BASE}/reports/recent?limit=${RECENT_LIMIT}`);
  if (!r.ok) throw new Error(`reports failed ${r.status}`);
  const list = await r.json();
  if (!Array.isArray(list)) return [];
  return list.map((item: Record<string, unknown>) => ({
    timestamp: typeof item.time === "string" ? item.time : undefined,
    risk: (item.risk as Report["risk"]) || "Low",
    sender: typeof item.sender === "string" ? item.sender : undefined,
    email_subject: typeof item.subject === "string" ? item.subject : undefined,
    reasons: Array.isArray(item.reasons) ? (item.reasons as string[]) : undefined,
    gmailLink: typeof item.gmail_link === "string" ? item.gmail_link : undefined,
    source: typeof item.source === "string" ? item.source : undefined,
  }));
}
