// PhishGuard — background service worker
//
// Handles the "Full inbox (Gmail API)" scan. This exists because
// extractVisibleEmails()/collectAllInbox() in adapters/gmail.js only ever
// see what Gmail has actually rendered into the DOM (scroll-and-scrape,
// capped at 1000 and unreliable well before that on a real, tens-of-
// thousands-of-messages inbox). The Gmail API gives direct, complete access
// to the whole mailbox instead — no DOM, no scrolling, no cap.
//
// chrome.identity is only available to extension pages / service workers,
// not content scripts, which is why this lives here rather than in
// panel.js: panel.js sends a runtime message to kick this off, and this
// file streams results back to that tab as they're fetched.
//
// Gmail API quota (per user per project): 6,000 units/minute.
// messages.get costs 20 units => max ~300 messages/minute (~5/sec). This
// file paces itself to that rate with a small concurrency window, and
// backs off on 429s. For a ~17,000-message inbox that's roughly 55-60
// minutes end to end — real, but not instant, and there's no way around
// that pace without Google raising the per-user quota.

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const STATE_KEY = 'pg_gmail_api_scan_state';
const PACE_MS = 200;       // ~5 requests/sec => ~300/min, under the 6000-unit/min (20/call) cap
const CONCURRENCY = 3;     // small in-flight window; still paced by PACE_MS below
const LIST_PAGE_SIZE = 500;

// Real Gmail label ("PhishGuard/Quarantine") applied via users.messages.modify — a genuine,
// server-side tag findable/filterable in Gmail itself, not just a hide in the current tab.
// Deliberately never removes the INBOX label here (no auto-archive) — the message stays
// visible in the real inbox too, just tagged. The label's id is looked up once and cached
// in chrome.storage.local so repeated quarantines don't re-fetch/re-create it every time.
const QUARANTINE_LABEL_NAME = 'PhishGuard/Quarantine';
const LABEL_ID_KEY = 'pg_quarantine_label_id';

let activeScan = null; // { tabId, cancelled }

// Live-testing found the failure mode here isn't usually an *error* from
// chrome.identity.getAuthToken — it's the interactive sign-in popup opening
// somewhere the user doesn't notice (a separate OS window, sometimes behind
// the main one), so the callback just never fires. Without a timeout, that
// leaves `activeScan` set forever: every later click gets "a scan is
// already running" and the button looks permanently broken until the whole
// extension is reloaded. A hard timeout here means a missed/ignored popup
// self-clears instead of wedging the button for good.
const AUTH_TIMEOUT_MS = 90000;
function getAuthToken(interactive) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = interactive ? setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Google sign-in popup timed out after 90s — check for a sign-in window that may have opened behind your browser (or check you\'re signed into Chrome itself, not just Gmail), then try again.'));
    }, AUTH_TIMEOUT_MS) : null;
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message || 'No token returned'));
      } else {
        resolve(token);
      }
    });
  });
}

function invalidateToken(token) {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

async function apiFetch(url, token, retriesLeft = 5) {
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (res.status === 401) {
    // Token expired/revoked mid-scan — drop it and let the caller re-auth.
    await invalidateToken(token);
    throw Object.assign(new Error('Auth token expired'), { code: 'AUTH_EXPIRED' });
  }
  if (res.status === 429 || res.status === 403) {
    if (retriesLeft <= 0) throw new Error('Gmail API rate limit exceeded, giving up');
    const wait = (6 - retriesLeft) * 1500; // simple backoff: 1.5s, 3s, 4.5s, 6s, 7.5s
    await new Promise(r => setTimeout(r, wait));
    return apiFetch(url, token, retriesLeft - 1);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gmail API error ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function getOrCreateQuarantineLabelId(token) {
  const cached = await chrome.storage.local.get(LABEL_ID_KEY);
  if (cached[LABEL_ID_KEY]) return cached[LABEL_ID_KEY];
  const list = await apiFetch(`${GMAIL_API}/labels`, token);
  let id = (list.labels || []).find(l => l.name === QUARANTINE_LABEL_NAME)?.id;
  if (!id) {
    const created = await fetch(`${GMAIL_API}/labels`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: QUARANTINE_LABEL_NAME,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      }),
    });
    if (!created.ok) {
      const body = await created.text().catch(() => '');
      throw new Error(`Couldn't create Gmail label: ${created.status} ${body.slice(0, 200)}`);
    }
    id = (await created.json()).id;
  }
  await chrome.storage.local.set({ [LABEL_ID_KEY]: id });
  return id;
}

async function modifyMessageLabels(msgId, token, { add, remove }) {
  const res = await fetch(`${GMAIL_API}/messages/${msgId}/modify`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ addLabelIds: add || [], removeLabelIds: remove || [] }),
  });
  if (res.status === 401) {
    await invalidateToken(token);
    throw Object.assign(new Error('Auth token expired'), { code: 'AUTH_EXPIRED' });
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gmail API error ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function parseSender(fromHeader) {
  if (!fromHeader) return '';
  const m = fromHeader.match(/<([^>]+)>/);
  return m ? m[1] : fromHeader.trim();
}

function headerVal(headers, name) {
  const h = (headers || []).find(h => h.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

async function saveState(state) {
  await chrome.storage.local.set({ [STATE_KEY]: state });
}
async function loadState() {
  const r = await chrome.storage.local.get(STATE_KEY);
  return r[STATE_KEY] || null;
}
async function clearState() {
  await chrome.storage.local.remove(STATE_KEY);
}

function tellTab(tabId, msg) {
  chrome.tabs.sendMessage(tabId, msg).catch(() => {});
}

async function runScan(tabId, scanToken) {
  let token;
  try {
    token = await getAuthToken(true);
  } catch (e) {
    tellTab(tabId, { cmd: 'gmail_api_error', message: 'Google sign-in failed: ' + e.message });
    activeScan = null;
    return;
  }

  let state = await loadState();
  const isResume = !!(state && state.pendingIds && state.pendingIds.length);
  if (!state || !isResume) {
    state = { pageToken: null, pendingIds: [], doneCount: 0, total: null, seen: {} };
  }

  try {
    // Phase 1: page through messages.list to build up the full id list
    // (5 units/call — cheap relative to messages.get, so this part is fast).
    while (!activeScan?.cancelled) {
      if (state.pendingIds.length > 4000) break; // keep a healthy buffer, refill later
      const url = `${GMAIL_API}/messages?maxResults=${LIST_PAGE_SIZE}&labelIds=INBOX` +
        (state.pageToken ? `&pageToken=${state.pageToken}` : '');
      const page = await apiFetch(url, token);
      if (state.total == null && page.resultSizeEstimate != null) {
        state.total = page.resultSizeEstimate;
        tellTab(tabId, { cmd: 'gmail_api_total', total: state.total });
      }
      (page.messages || []).forEach(m => {
        if (!state.seen[m.id]) { state.seen[m.id] = true; state.pendingIds.push(m.id); }
      });
      state.pageToken = page.nextPageToken || null;
      await saveState(state);
      if (!state.pageToken) break;
    }

    // Phase 2: fetch metadata for each pending id, paced, streaming results back.
    while (state.pendingIds.length && !activeScan?.cancelled) {
      const batch = state.pendingIds.slice(0, CONCURRENCY);
      const results = await Promise.allSettled(batch.map(id =>
        apiFetch(`${GMAIL_API}/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`, token)
      ));
      results.forEach((r, idx) => {
        const id = batch[idx];
        state.pendingIds.shift(); // remove regardless of outcome — don't get stuck retrying one bad id forever
        state.doneCount++;
        if (r.status === 'fulfilled') {
          const msg = r.value;
          const headers = msg.payload?.headers || [];
          const email = {
            id: msg.id,
            gmailId: msg.id,
            subject: headerVal(headers, 'Subject') || '(no subject)',
            sender: parseSender(headerVal(headers, 'From')),
            snippet: msg.snippet || '',
            // internalDate is the real received time (epoch ms, as a string) — always present
            // on a message resource regardless of `format`, so this costs nothing extra.
            receivedAt: msg.internalDate || null,
          };
          tellTab(tabId, { cmd: 'gmail_api_email', email });
        }
        // fetch failures for a single message are skipped silently — logged via progress only
      });
      await saveState(state);
      tellTab(tabId, { cmd: 'gmail_api_progress', done: state.doneCount, total: state.total, remaining: state.pendingIds.length });
      await new Promise(r => setTimeout(r, PACE_MS));

      // Refill the id buffer if we're draining it and more pages exist.
      if (state.pendingIds.length < 200 && state.pageToken && !activeScan?.cancelled) {
        const url = `${GMAIL_API}/messages?maxResults=${LIST_PAGE_SIZE}&labelIds=INBOX&pageToken=${state.pageToken}`;
        const page = await apiFetch(url, token);
        (page.messages || []).forEach(m => {
          if (!state.seen[m.id]) { state.seen[m.id] = true; state.pendingIds.push(m.id); }
        });
        state.pageToken = page.nextPageToken || null;
        await saveState(state);
      }
    }

    if (activeScan?.cancelled) {
      tellTab(tabId, { cmd: 'gmail_api_cancelled' });
    } else {
      await clearState();
      tellTab(tabId, { cmd: 'gmail_api_done', total: state.doneCount });
    }
  } catch (e) {
    if (e.code === 'AUTH_EXPIRED') {
      tellTab(tabId, { cmd: 'gmail_api_error', message: 'Google sign-in expired mid-scan — click the button again to resume from where it left off.' });
    } else {
      tellTab(tabId, { cmd: 'gmail_api_error', message: e.message });
    }
  } finally {
    activeScan = null;
  }
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.cmd === 'gmail_api_scan_start') {
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ ok: false, error: 'No tab context' }); return; }
    // A stale activeScan (older than the auth timeout + a safety margin, with no
    // sign it's mid-fetch) shouldn't permanently block new attempts — self-heal
    // instead of making the user reload the extension every time this happens.
    if (activeScan && (Date.now() - activeScan.startedAt) > (AUTH_TIMEOUT_MS + 30000)) {
      activeScan = null;
    }
    if (activeScan) { sendResponse({ ok: false, error: 'A scan is already running' }); return; }
    activeScan = { tabId, cancelled: false, startedAt: Date.now() };
    runScan(tabId, activeScan);
    sendResponse({ ok: true });
    return;
  }
  if (req.cmd === 'gmail_api_scan_cancel') {
    if (activeScan) activeScan.cancelled = true;
    sendResponse({ ok: true });
    return;
  }
  if (req.cmd === 'gmail_api_scan_reset') {
    clearState().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (req.cmd === 'gmail_label_quarantine' || req.cmd === 'gmail_label_restore') {
    (async () => {
      try {
        // Non-interactive by default: labeling can be triggered by real-time protection
        // while the user is just casually browsing, so this must never pop an unexpected
        // Google sign-in window mid-scroll. Until the broader "manage your mail" scope has
        // been granted once (e.g. by running an API scan, or by req.interactive below), this
        // fails fast and the caller falls back to hide-only quarantine, surfacing a "Grant
        // Gmail access" retry button the user can click on purpose — that click is what sets
        // req.interactive so the consent popup only ever appears after a deliberate action.
        const token = await getAuthToken(!!req.interactive);
        const labelId = await getOrCreateQuarantineLabelId(token);
        if (req.cmd === 'gmail_label_quarantine') {
          await modifyMessageLabels(req.msgId, token, { add: [labelId] });
        } else {
          await modifyMessageLabels(req.msgId, token, { remove: [labelId] });
        }
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }
});
