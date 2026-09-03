// PhishGuard adapter — Yahoo Mail (mail.yahoo.com)
// Live-verified 2026-09-02 against a real throwaway Yahoo Mail account (via a
// Chromium-based automated browser), replacing an earlier, untested version.
//
// What live testing found: the row-level hook was right (data-test-id="message-list-item"
// really is how Yahoo marks each message row), but the guessed field-level hooks
// (data-test-id="sender-name" / "subject" / "message-snippet") do not exist in Yahoo's
// current markup — Yahoo instead gives each field a per-row element id with a stable
// prefix: id="email-sender-00_1", id="email-subject-00_1", id="email-snippet-00_1". One trap:
// there is also a screen-reader-only id="email-subject-snippet-00_1" span (class="sr-only")
// that combines subject+snippet with an ellipsis — matching `[id^="email-subject-"]` naively
// picks that one up first, so it must be excluded explicitly. The original data-test-id
// guesses are kept as a fallback in case Yahoo's markup changes again.
(function () {
  const ROW_SELECTORS = ['[data-test-id="message-list-item"]', 'div[role="row"][data-test-id]', 'li[data-test-id*="message"]'];
  const SENDER_SELECTORS = ['[id^="email-sender-"]', '[data-test-id="sender-name"]', '[data-test-id="senders"]', '[class*="sender" i]'];
  const SUBJECT_SELECTORS = ['[id^="email-subject-"]:not([id*="snippet"])', '[data-test-id="subject"]', '[class*="subject" i]'];
  const SNIPPET_SELECTORS = ['[id^="email-snippet-"]', '[data-test-id="message-snippet"]', '[class*="snippet" i]', '[class*="preview" i]'];

  function firstMatch(root, selectors) {
    for (const sel of selectors) {
      const el = root.querySelector(sel);
      if (el && el.innerText) return el.innerText.trim();
    }
    return '';
  }

  function findRows() {
    for (const sel of ROW_SELECTORS) {
      const rows = document.querySelectorAll(sel);
      if (rows.length) return Array.from(rows);
    }
    return [];
  }

  function extractVisibleEmails() {
    const out = [];
    findRows().forEach((row, idx) => {
      try {
        const sender = firstMatch(row, SENDER_SELECTORS);
        const subject = firstMatch(row, SUBJECT_SELECTORS);
        const snippet = firstMatch(row, SNIPPET_SELECTORS);
        const id = row.getAttribute('data-test-mid') || row.id || `ymail-${idx}`;
        if (subject || sender || snippet) out.push({ id, subject, sender, snippet, el: row });
      } catch (e) {}
    });
    return out;
  }

  async function collectAllInbox(limit = 1000, onProgress = () => {}) {
    const seen = new Map();
    let stagnant = 0;
    const scroller = document.scrollingElement || document.body;
    while (seen.size < limit && stagnant < 6) {
      extractVisibleEmails().forEach(e => seen.set(e.id, e));
      const before = seen.size;
      onProgress(before);
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
      await new Promise(r => setTimeout(r, 900));
      extractVisibleEmails().forEach(e => seen.set(e.id, e));
      const after = seen.size;
      stagnant = (after === before) ? stagnant + 1 : 0;
    }
    onProgress(seen.size);
    return Array.from(seen.values());
  }

  function getContainer() {
    // Live testing found that rows[0].parentElement is often a wrapper around that ONE row
    // alone (e.g. Yahoo wraps each message in its own <li> under a shared <ul>) — watching
    // it with a MutationObserver never sees a new message arrive as a sibling <li>, so
    // real-time protection silently stops noticing new mail after the first scan. Climb
    // until we reach an ancestor that actually contains every row currently on screen (and
    // has more than one child, so it isn't just another solo wrapper), which is guaranteed
    // to also contain future sibling rows.
    const rows = findRows();
    if (!rows.length) return document.body;
    let el = rows[0].parentElement;
    while (el && el.parentElement && !(el.children.length > 1 && rows.every(r => el.contains(r)))) {
      el = el.parentElement;
    }
    return el || document.body;
  }

  window.PhishGuardAdapter = { siteName: 'Yahoo Mail', extractVisibleEmails, collectAllInbox, getContainer, experimental: true };
})();
