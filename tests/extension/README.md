# Extension tests

Offline tests for the extension's site adapters (`extension/adapters/*.js`) and shared
panel logic (`extension/panel.js`), run against jsdom fixtures rather than a live browser.

Run everything with:
```
cd tests/extension && npm install && npm test
```
(`npm test` runs `test_adapters.js`, `test_panel.js`, and `test_quarantine_realtime.js` in
sequence.) Each file can also be run individually with `node <file>.js` from the project root.

## test_adapters.js

Checks that each site adapter correctly extracts sender/subject/snippet from representative
DOM markup, and that `getContainer()` returns something sensible for the real-time
`MutationObserver` to watch.

- **Gmail**: real, long-stable Gmail class names — high-confidence, unchanged.
- **Outlook Web** and **Yahoo Mail**: the primary fixtures now reflect markup captured live
  from real throwaway accounts (Outlook: avatar `role="img"` aria-label for sender, text
  before a dated `title`-timestamp element for subject; Yahoo: per-row `email-sender-*` /
  `email-subject-*` / `email-snippet-*` ids, with a screen-reader-only "snippet" trap span
  that has to be excluded). The *original* best-effort guesses (period-delimited aria-label
  splitting for Outlook, `data-test-id="sender-name"` etc. for Yahoo) are kept as separate
  "fallback" test blocks, since the adapters still fall back to that logic if a site's markup
  changes again. Both adapters are still marked `experimental: true` in code — one throwaway
  account each is real-world evidence, not exhaustive coverage (untested: threaded
  conversations, non-English locales, attachments-only rows).

## test_panel.js

Mocks the `chrome.*` extension APIs and `fetch` to verify the panel's rendering and
interaction logic: launcher, open/close, scan-and-render, risk-pill styling, the High-risk
badge count, card expand/collapse, and the resizable-panel drag/cycle/reset behavior. The
panel is now built (but left `hidden`) as soon as the launcher exists, rather than lazily on
first open, so real-time protection always has a results container to render into — the test
for this checks `panel.hidden === true`, not that the panel element is absent from the DOM.

## test_quarantine_realtime.js

Covers the newer real-time-protection and quarantine features against a mock inbox of real
DOM elements (not just plain objects): initial auto-scan of existing rows, auto-quarantine of
a High-risk row, the quarantine bar's visibility/count, the badge count (High-risk count
alone — see note below), the "Removed from inbox" tag, the on-demand "Deep scan" button and
its rendered result, restore-from-card and restore-all, the `MutationObserver` picking up a
row added after the initial scan (past the ~600ms debounce), and pause/resume of real-time
protection (no scoring while paused; catch-up scoring once resumed).

This suite caught two real bugs before release, both fixed and covered by the tests that
found them:
- The launcher badge was double-counting quarantined emails — it added `quarantined.size` on
  top of a High-risk count that already included every High-risk card, quarantined or not.
- `restoreEmail` looked up the quarantine tag with
  `` document.querySelector(`[data-id="${CSS.escape(id)}"]`) ``, but `CSS.escape` doesn't exist
  in this jsdom version (and isn't guaranteed in every real environment either). Fixed by
  having the code that builds the tag hand its DOM reference directly to the quarantine
  tracking map, so restore never needs to re-query for it.

## jsdom caveats

- jsdom doesn't implement `innerText` (no layout engine) — all three test files polyfill it
  as `textContent.trim()` purely for testing. Real browsers, where this extension actually
  runs, support `innerText` natively.
- `CSS.escape` is **not** available in this jsdom version — don't rely on it in code that
  needs to work here (see above). It's assumed but not guaranteed elsewhere either.
- `MutationObserver` **is** supported here and is exercised directly (not mocked) in
  `test_quarantine_realtime.js`.
