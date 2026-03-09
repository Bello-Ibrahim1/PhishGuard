export const API_BASE = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) || "http://127.0.0.1:8000";

export type Summary = { total: number; by_risk: { Low: number; Medium: number; High: number } };
export type Report = {
  email_subject?: string;
  sender?: string;
  risk: "Low" | "Medium" | "High";
  reasons?: string[];
  timestamp?: string;
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

/** Recent reports from extension scans (same list as /reports/summary) */
export async function fetchReports(): Promise<Report[]> {
  const r = await fetch(`${API_BASE}/reports/recent?limit=500`);
  if (!r.ok) throw new Error(`reports failed ${r.status}`);
  const list = await r.json();
  if (!Array.isArray(list)) return [];
  return list.map((item: Record<string, unknown>) => ({
    timestamp: typeof item.time === "string" ? item.time : undefined,
    risk: (item.risk as Report["risk"]) || "Low",
    sender: typeof item.sender === "string" ? item.sender : undefined,
    email_subject: typeof item.subject === "string" ? item.subject : undefined,
    reasons: Array.isArray(item.reasons) ? (item.reasons as string[]) : undefined,
  }));
}
