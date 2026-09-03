// PhishGuard adapter — Gmail (mail.google.com)
// High confidence: Gmail's inbox row classes (tr.zA etc.) have been stable for years
// and are the same selectors validated in the original v0.3 extension.
(function () {
  function extractVisibleEmails() {
    const out = [];
    document.querySelectorAll('tr.zA').forEach(row => {
      try {
        const subEl = row.querySelector('.bog') || row.querySelector('.y6 span[id]');
        const subject = subEl ? subEl.innerText : '';
        // Live testing against a real personal inbox (50 real messages) found that the old
        // class-based selector ('.yX.xY .yP') only actually found the sender's real email
        // address on 11 of 50 rows — for the other 39, it silently fell back to the display
        // NAME ("DoorDash") instead of the address ("no-reply@doordash.com"), because Gmail's
        // class names for this element vary/are obfuscated per account and don't reliably
        // match '.yP'. That's not just a missed detail: the backend's brand-impersonation check
        // needs a real domain to compare against, and with no '@' in a bare display name, it
        // concluded the domain "didn't match" — which live-quarantined a completely legitimate
        // DoorDash email from a real inbox. Gmail does reliably annotate the sender span with an
        // `email="..."` attribute regardless of its class name, so querying for that directly is
        // far more robust than depending on class names at all. Old selectors kept as a fallback
        // for the rare row where no `[email]` attribute is present.
        const sndEl = row.querySelector('[email]') || row.querySelector('.yX.xY .yP') || row.querySelector('.yW span');
        const sender = sndEl ? (sndEl.getAttribute('email') || sndEl.innerText) : '';
        const snpEl = row.querySelector('.y2') || row.querySelector('.yW .y2');
        const snippet = snpEl ? snpEl.innerText : '';
        // Live testing against a real, 40+ message inbox found that Gmail doesn't always
        // populate data-legacy-message-id on a row. When it's missing, a fresh
        // Math.random() id on every call meant real-time protection's periodic
        // re-extraction could never recognize an already-scored row as "seen" (its id kept
        // changing), so every DOM mutation anywhere in the inbox silently re-scored and
        // re-rendered EVERY visible email again, duplicating cards without limit. Assigning
        // the fallback id once and caching it on the element itself fixes that: the same DOM
        // node always reports the same id on every subsequent extraction.
        // Gmail annotates the row's date/time cell with a single span[title="<full date>"]
        // (e.g. "Fri, Jul 24, 2026, 11:42 AM") — the only span[title] in the row in live
        // testing, and far more precise than the short relative text it displays ("Jul 24",
        // "3:45 PM"). Used to show when the email was actually received rather than when
        // PhishGuard happened to scan it. Best-effort: if Gmail's markup ever drops this,
        // panel.js just falls back to scan time.
        const dateSpan = row.querySelector('span[title]');
        const receivedAtRaw = dateSpan ? dateSpan.getAttribute('title') : null;
        let id = row.dataset.legacyMessageId;
        if (!id) { id = row.dataset.pgFallbackId || (row.dataset.pgFallbackId = 'gmail-' + Math.random().toString(36).slice(2, 9)); }
        if (subject || sender || snippet) out.push({ id, subject, sender, snippet, el: row, legacyId: row.dataset.legacyMessageId || null, receivedAtRaw });
      } catch (e) {}
    });
    return out;
  }

  async function collectAllInbox(limit = 1000, onProgress = () => {}) {
    const seen = new Map();
    let stagnant = 0;
    const scroller = document.querySelector('.aeF') || document.scrollingElement || document.body;
    while (seen.size < limit && stagnant < 6) {
      extractVisibleEmails().forEach(e => seen.set(e.id + e.subject, e));
      const before = seen.size;
      onProgress(before);
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
      await new Promise(r => setTimeout(r, 900));
      extractVisibleEmails().forEach(e => seen.set(e.id + e.subject, e));
      const after = seen.size;
      stagnant = (after === before) ? stagnant + 1 : 0;
    }
    onProgress(seen.size);
    return Array.from(seen.values());
  }

  function getContainer() {
    const first = document.querySelector('tr.zA');
    return (first && first.closest('table')) || document.querySelector('.aeF') || document.body;
  }

  window.PhishGuardAdapter = { siteName: 'Gmail', extractVisibleEmails, collectAllInbox, getContainer };
})();
