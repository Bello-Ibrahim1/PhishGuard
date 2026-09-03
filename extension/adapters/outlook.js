// PhishGuard adapter — Outlook on the web (outlook.office.com / outlook.live.com)
// Live-verified 2026-09-02 against a real outlook.live.com throwaway account (via a
// Chromium-based automated browser), replacing an earlier, untested version.
//
// What live testing found: Outlook Web's row aria-label is NOT the clean
// "Sender. Subject. Snippet." format this adapter originally assumed — real labels look
// like "Unread idowu.bello@myyahoo.com Your account has been suspended - action required
// 12:28 AM Dear customer, ..." where periods show up inside email addresses and mid-sentence,
// so naively splitting on "." shredded the sender/subject/snippet. Outlook Web's CSS classes
// are also auto-generated Fluent UI hashes with no semantic meaning (e.g. "TtcXM"), so this
// now reads structural/ARIA hooks instead, confirmed against real rows:
//   - sender:  the row's avatar element (role="img") carries the sender identity as its aria-label
//   - subject: the text element immediately before the timestamp element (the timestamp
//              element is identified by a dated `title`, e.g. title="Wed 9/2/2026 12:28 AM")
//   - snippet: the first sufficiently long <span> in the row that isn't the sender or subject
// This was checked against one throwaway account with a handful of emails (external mail and
// Microsoft's own system notifications) — real, but not exhaustive coverage (untested:
// threaded/grouped conversations, non-English locales, attachments-only rows). A fallback to
// the original aria-label-splitting heuristic is kept in case Microsoft's markup changes in a
// way that breaks the structural hooks above, so the adapter degrades rather than going blank.
(function () {
  function parseAriaLabelFallback(label, fallbackSubject) {
    const parts = (label || '').split('.').map(s => s.trim()).filter(Boolean);
    const sender = parts[0] || '';
    const subject = parts[1] || fallbackSubject || '';
    const snippet = parts.slice(2).join('. ') || '';
    return { sender, subject, snippet };
  }

  function findRows() {
    // Primary: rows in the message list carry role="option" with a rich aria-label.
    let rows = Array.from(document.querySelectorAll('[role="option"][aria-label]'));
    // Filter out obviously non-message options (e.g. folder list items) by requiring
    // the aria-label to contain at least two sentence-like segments.
    rows = rows.filter(r => (r.getAttribute('aria-label') || '').split('.').length >= 2);
    return rows;
  }

  function extractRow(row) {
    const avatar = row.querySelector('[role="img"][aria-label]');
    const sender = avatar ? (avatar.getAttribute('aria-label') || '') : '';

    const titled = Array.from(row.querySelectorAll('[title]'));
    const timeEl = titled.find(el => /\d{4}/.test(el.getAttribute('title') || '') || /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/.test(el.getAttribute('title') || ''));
    let subject = '';
    if (timeEl && timeEl.previousElementSibling && timeEl.previousElementSibling.innerText) {
      subject = timeEl.previousElementSibling.innerText.trim();
    }
    // Same dated `title` used to locate timeEl above (e.g. "Wed 9/2/2026 12:28 AM") also
    // gives us the real received time, more precise than the short text it displays.
    const receivedAtRaw = timeEl ? timeEl.getAttribute('title') : null;

    if (sender && subject) {
      let snippet = '';
      const spans = Array.from(row.querySelectorAll('span'));
      for (const s of spans) {
        const t = (s.innerText || '').trim();
        if (t.length > 30 && t !== subject && t !== sender) { snippet = t; break; }
      }
      return { sender, subject, snippet, receivedAtRaw };
    }

    // Structural hooks didn't pan out (Microsoft changed the DOM again) — fall back to
    // the aria-label heuristic rather than returning nothing.
    const label = row.getAttribute('aria-label') || '';
    const subjectEl = row.querySelector('[class*="subject" i]');
    return { ...parseAriaLabelFallback(label, subjectEl ? subjectEl.innerText : ''), receivedAtRaw };
  }

  function extractVisibleEmails() {
    const out = [];
    findRows().forEach((row, idx) => {
      try {
        const { sender, subject, snippet, receivedAtRaw } = extractRow(row);
        const id = row.id || row.getAttribute('data-convid') || `owa-${idx}-${(subject || '').slice(0, 20)}`;
        if (subject || sender || snippet) out.push({ id, subject, sender, snippet, el: row, receivedAtRaw });
      } catch (e) {}
    });
    return out;
  }

  async function collectAllInbox(limit = 1000, onProgress = () => {}) {
    const seen = new Map();
    let stagnant = 0;
    const scroller = document.querySelector('[role="listbox"]') || document.scrollingElement || document.body;
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
    // Same fix as the Yahoo adapter: live testing showed first.parentElement often wraps
    // only that ONE row (Outlook Web nests each row several levels deep before reaching the
    // real virtualized list), so a MutationObserver on it never sees new messages arrive as
    // siblings elsewhere in the tree. Climb until we reach an ancestor that contains every
    // row currently found (and has more than one child, so it isn't just another solo
    // wrapper) — that ancestor will also contain future sibling rows.
    const rows = findRows();
    if (!rows.length) return document.querySelector('[role="listbox"]') || document.body;
    let el = rows[0].parentElement;
    while (el && el.parentElement && !(el.children.length > 1 && rows.every(r => el.contains(r)))) {
      el = el.parentElement;
    }
    return el || document.querySelector('[role="listbox"]') || document.body;
  }

  window.PhishGuardAdapter = { siteName: 'Outlook', extractVisibleEmails, collectAllInbox, getContainer, experimental: true };
})();
