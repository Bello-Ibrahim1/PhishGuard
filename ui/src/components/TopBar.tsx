// Header styled to match the extension panel's header (#phishguard-header in
// overlay.css): same gradient logo mark, same shield glyph, same title/status
// treatment — so the dashboard reads as the same product, not a different app.
export function TopBar() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "16px 20px",
        borderBottom: "1px solid var(--pg-border-soft)",
        background: "linear-gradient(180deg, rgba(99,102,241,.10), transparent)",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: "var(--pg-accent-grad)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 4px 14px -4px rgba(99,102,241,.6)",
        }}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
          <path
            d="M12 2L4 5v6c0 5.2 3.4 9.7 8 11 4.6-1.3 8-5.8 8-11V5l-8-3z"
            fill="#fff"
            fillOpacity=".95"
          />
          <path
            d="M9 12.5l2 2 4-4.5"
            stroke="#4338ca"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-.01em" }}>
          PhishGuard — Full Report
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11.5,
            color: "var(--pg-text-sub)",
            marginTop: 2,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--pg-safe)",
              boxShadow: "0 0 0 3px var(--pg-safe-bg)",
            }}
          />
          Live summary of scanned emails
        </div>
      </div>
    </div>
  );
}
