// PhishGuard stores every timestamp as a UTC ISO string (e.g. "2026-01-29T18:32:00.000Z" —
// see panel.js's resolveReceivedAt()). `Intl.DateTimeFormat` with no explicit timeZone reads
// the browser's CURRENT timezone at render time, so this is always correct for wherever you
// are right now: change your system timezone (or open the dashboard from a different one
// while traveling) and the next render just picks it up automatically — no GPS/location
// permission needed, since the OS's timezone setting is already the accurate signal for
// "what time is it here," not raw coordinates.
//
// Lives in its own file (not exported from ReportsTable.tsx) because the printable/CSV
// export in export.ts needs the exact same formatting, and a component file mixing
// component + plain-function exports breaks Vite's fast-refresh boundary.
export const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  hour12: false,
});

export function formatLocalTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return timeFormatter.format(d).replace(",", "");
}


// ---------- Plain "YYYY-MM-DD" <-> local Date, for the date-range filter ----------
// Deliberately NOT `new Date(s)` / `d.toISOString().slice(0, 10)` — those parse/format in
// UTC, which silently shifts the date by a day for anyone west of UTC (e.g. picking "Apr 1"
// in the calendar could round-trip back out as "Mar 31"). Building/reading the Y/M/D
// components directly keeps this a local calendar day, matching how every other date on this
// page is already interpreted (see LOCAL_TZ above, and the date-range filter it feeds).
export function parseYMD(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

export function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
