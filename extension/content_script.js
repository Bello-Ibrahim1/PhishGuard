// ===== helper: safe text =====
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[m])) }
const DEFAULT_API = "http://localhost:8000";
const DEFAULT_DASHBOARD = "http://localhost:5173";
function getApiBase(){ return new Promise(r=>{ chrome.storage.sync.get({apiBase:DEFAULT_API}, o=>r(o.apiBase||DEFAULT_API)); }); }
function getDashboardUrl(){ return new Promise(r=>{ chrome.storage.sync.get({dashboardUrl:DEFAULT_DASHBOARD}, o=>r(o.dashboardUrl||DEFAULT_DASHBOARD)); }); }
function extractVisibleEmails(){const out=[];document.querySelectorAll('tr.zA').forEach(row=>{try{const subEl=row.querySelector('.bog')||row.querySelector('.y6 span[id]');const subject=subEl?subEl.innerText:'';const sndEl=row.querySelector('.yX.xY .yP')||row.querySelector('.yW span');const sender=sndEl?(sndEl.getAttribute('email')||sndEl.innerText):'';const snpEl=row.querySelector('.y2')||row.querySelector('.yW .y2');const snippet=snpEl?snpEl.innerText:'';const id=row.dataset.legacyMessageId||Math.random().toString(36).slice(2,9);if(subject||sender||snippet)out.push({id,subject,sender,snippet});}catch(e){}});return out;}
async function collectAllInbox(limit=1000,onProgress=()=>{}){const seen=new Map();let stagnant=0;const scroller=document.querySelector('.aeF')||document.scrollingElement||document.body;while(seen.size<limit&&stagnant<6){extractVisibleEmails().forEach(e=>seen.set(e.id+e.subject,e));const before=seen.size;onProgress(before);scroller.scrollTo({top:scroller.scrollHeight,behavior:'smooth'});await new Promise(r=>setTimeout(r,900));extractVisibleEmails().forEach(e=>seen.set(e.id+e.subject,e));const after=seen.size;stagnant=(after===before)?stagnant+1:0;}onProgress(seen.size);return Array.from(seen.values());}
let abortScan=null;function ensurePanel(){if(document.getElementById('phishguard-panel'))return;const link=document.createElement('link');link.rel='stylesheet';link.href=chrome.runtime.getURL('overlay.css');document.documentElement.appendChild(link);const panel=document.createElement('div');panel.id='phishguard-panel';panel.innerHTML=`<div id="phishguard-header"><link rel="stylesheet" href="${chrome.runtime.getURL('assets/phishguard-hero.css')}">

<img src="${chrome.runtime.getURL('assets/hero.png')}" alt="PhishGuard Hero" class="pg-hero md"><div class="title">PhishGuard — Inbox Guard</div></div><div id="phishguard-actions"><button class="pg-btn primary" id="pg-scan-visible">Scan visible</button><button class="pg-btn" id="pg-scan-all">Scan whole inbox</button><button class="pg-btn" id="pg-cancel">Cancel</button><button class="pg-btn" id="pg-clear">Clear</button><button class="pg-btn" id="pg-report">View Full Report</button></div><div id="phishguard-results"></div><div id="phishguard-footer"><span id="pg-count">0 emails</span><div class="pg-progress"><div class="pg-bar" id="pg-bar"></div></div></div>`;document.body.appendChild(panel);document.getElementById('pg-scan-visible').onclick=()=>runScan(false);document.getElementById('pg-scan-all').onclick=()=>runScan(true);document.getElementById('pg-cancel').onclick=()=>{if(abortScan)abortScan();};document.getElementById('pg-clear').onclick=()=>{document.getElementById('phishguard-results').innerHTML='';updateBar(0,1);setCount(0);};document.getElementById('pg-report').onclick=()=>{ getDashboardUrl().then(url=>window.open(url,'_blank')); };}
function setCount(n){document.getElementById('pg-count').textContent=`${n} emails`;}
function updateBar(done,total){const pct=total?Math.min(100,Math.round(done*100/total)):0;document.getElementById('pg-bar').style.width=pct+'%';}

// ===== helper: build a card DOM node =====
function buildInboxCard(messageMeta, api) {
  // messageMeta: { sender, subject, snippet/body? } if you have it
  const risk   = api?.risk || "Low";
  const pct    = (typeof api?.threat_pct === "number") ? api.threat_pct
               : Math.round((api?.prob || 0) * 100);
  const pillBg = (risk === "High") ? "#ef4444" : (risk === "Medium") ? "#eab308" : "#22c55e";
  const summary = api?.summary
               || (messageMeta?.subject ? `${messageMeta.subject} — ${messageMeta.snippet||''}` : (messageMeta?.snippet||"No content"));

  const cardId = "pg-card-" + Math.random().toString(36).slice(2, 9);

  const el = document.createElement("div");
  el.className = "pg-card";
  el.id = cardId;
  el.innerHTML = `
    <div class="pg-row">
      <div class="pg-text">
        <div class="pg-title">${esc(messageMeta?.title || messageMeta?.subject || "—")}</div>
        <div class="pg-sub">${esc(messageMeta?.sender || "")}</div>
        <div class="pg-summary">${esc(summary)}</div>
      </div>
      <div class="pg-right">
        <span class="pg-pill" style="background:${pillBg};color:#0b1220">${esc(risk)} · ${pct}%</span>
      </div>
    </div>
    <div class="pg-meta">
      ${api?.reasons?.length ? esc(api.reasons.slice(0, 2).join(" • ")) : "No suspicious signals"}
    </div>
    <div class="pg-actions">
      <button class="pg-btn-safe" data-card="${cardId}" title="Mark this email as safe (not phishing)">✓ Mark as Safe</button>
    </div>
  `;

  el.querySelector(".pg-btn-safe").addEventListener("click", async (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = "Marked safe ✓";
    btn.style.opacity = "0.5";
    try {
      const base = await getApiBase();
      await fetch(base + "/feedback/safe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: messageMeta?.subject || "",
          sender: messageMeta?.sender || "",
          body_preview: summary,
          risk_was: risk,
          prob_was: api?.prob ?? null,
        }),
      });
    } catch (_) {}
  });

  return el;
}

async function scoreOneEmail(msg){
  const base=await getApiBase();
  const res=await fetch(base+"/email/score",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({subject:msg.subject||"",body:msg.body||msg.snippet||"",sender:msg.sender||""})});
  if(!res.ok)throw new Error("API error: "+res.status);
  return res.json();
}

async function renderCard(container,msg){
  try{
    const api=await scoreOneEmail(msg);
    const node=buildInboxCard({title:msg.subject,subject:msg.subject,sender:msg.sender,snippet:msg.snippet||""},api);
    container.appendChild(node);
    try{
      const base=await getApiBase();
      await fetch(base+"/ingest/report",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({time:new Date().toISOString(),risk:api.risk,sender:msg.sender,subject:msg.subject,body_preview:api.summary,reasons:api.reasons||[]})});
    }catch(_){}
  }catch(e){
    const err=document.createElement("div");
    err.className="pg-card";
    err.textContent="Error: "+e.message;
    container.appendChild(err);
  }
}

async function runScan(full){ensurePanel();const box=document.getElementById('phishguard-results');box.innerHTML=full?'Scanning whole inbox… (scrolling)':'Scanning visible emails…';let emails=[];if(full){emails=await collectAllInbox(1000,n=>setCount(n));}else{emails=extractVisibleEmails();setCount(emails.length);}if(!emails.length){box.innerHTML='No emails found.';updateBar(0,1);return;}const batchSize=10;let i=0,cancelled=false;abortScan=()=>{cancelled=true;};while(i<emails.length&&!cancelled){const slice=emails.slice(i,i+batchSize);await Promise.all(slice.map(e=>renderCard(box,e)));i+=batchSize;updateBar(i,emails.length);}abortScan=null;}
if(location.hostname.includes('mail.google.com'))ensurePanel();
chrome.runtime.onMessage.addListener((req,sender,sendResponse)=>{if(req.cmd==='open_panel'){ensurePanel();sendResponse({ok:true});}if(req.cmd==='scan_inbox'){sendResponse({emails:extractVisibleEmails()});}});
