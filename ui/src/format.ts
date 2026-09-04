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
