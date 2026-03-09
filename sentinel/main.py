import os, json, time
from datetime import datetime, timezone
import re
from typing import List, Tuple
from urllib.parse import urlparse

LOG_PATH = os.path.join(os.path.dirname(__file__), "logs.json")

def _read_logs():
    if not os.path.exists(LOG_PATH):
        return []
    try:
        return json.load(open(LOG_PATH, "r"))
    except Exception:
        return []

def _write_logs(items):
    with open(LOG_PATH, "w") as f:
        json.dump(items, f, indent=2)

from fastapi import FastAPI, Request
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from .features import extract_email_features
from .scorer import heuristic_score as base_heuristic_score, ml_predict
from .model import load_model, score_text

app=FastAPI()
app.add_middleware(
    CORSMiddleware,
    # For dev: allow localhost UI AND Chrome extension origins
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        # TEMP: allow any origin so the extension preflight succeeds
        "*",
    ],
    allow_origin_regex=".*",   # dev-sledgehammer, OK for local testing
    allow_credentials=False,   # keep False if using "*" origin
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScoreIn(BaseModel):
    subject: str = ""
    body: str = ""
    sender: str = ""      # used to allowlist trusted companies (e.g. paypal.com, uber.com)
    reply_to: str = ""    # if different from sender, strong phishing signal
    use_openai: bool = True


class BatchEmailItem(BaseModel):
    subject: str = ""
    body: str = ""
    sender: str = ""


class BatchScoreIn(BaseModel):
    emails: List[BatchEmailItem] = []

@app.on_event("startup")
def _load_model():
    load_model("ml/models/phish_clf.joblib")

# --- High-accuracy heuristics: wording + identifiers (legit vs fraud) ---
URL_RE = re.compile(r'https?://[^\s)\]\"]+', re.I)
# URL shorteners and high-risk redirectors
SHORTENERS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "rb.gy", "ow.ly", "is.gd", "cutt.ly",
    "shorte.st", "short.co", "buff.ly", "adf.ly", "j.mp", "bc.vc", "tiny.cc", "tr.im",
}
# Malicious / phishing wording (high precision indicators)
PHISH_WORDING = [
    "verify your account", "verify account", "suspended", "verify identity", "confirm your identity",
    "click here", "click below", "act now", "verify now", "update now", "confirm now",
    "your account has been", "account suspended", "password expired", "reset password",
    "unusual activity", "suspicious activity", "locked out", "restore access",
    "wire transfer", "bank transfer", "urgent payment", "overdue payment", "pay now",
    "invoice attached", "document attached", "secure document", "view document",
    "winner", "congratulations you", "you have won", "claim your prize", "free gift",
    "nigerian prince", "inheritance", "lottery", "refund", "tax refund", "irs ",
    "dear customer", "dear member", "dear account holder", "valued customer",
    "confirm your email", "verify your email", "update your information", "update payment",
    "limited time", "expires today", "expires in 24 hours", "final notice", "immediate action",
    "dear sir/madam", "dear beneficiary", "urgent request", "action required",
    "re: your account", "re: payment", "re: verification", "re: suspended",
]
# Low-weight phrases: suspicious in isolation but common in legit emails too.
# Only scored if combined with other signals (handled in _wording_score).
PHISH_WORDING_WEAK = [
    "click here", "click below",
    "unsubscribe", "click to unsubscribe", "manage preferences",
    "invoice attached", "document attached",
]
# Single-word urgency/credential triggers (strong when combined)
URGENCY_CRED_WORDS = [
    "urgent", "immediately", "asap", "overdue", "verify", "password", "login", "confirm",
    "payment", "invoice", "suspend", "blocked", "expire", "click", "update", "secure",
]
# Legitimate signals (reduce false positives)
LEGIT_PATTERNS = [
    r"\b(unsubscribe|view in browser|sent from mail\.|mail\.google\.com)\b",
    r"\b(notification|newsletter|digest|no-reply@)\b",
    r"\b(order confirmation|order #|your receipt|thank you for your (purchase|order|payment))\b",
    r"\b(tracking number|shipment|your order has (shipped|been placed|been delivered))\b",
    r"\b(statement|account summary|monthly (statement|summary)|billing statement)\b",
]
# Suspicious sender/identifier patterns (fraud indicators)
SENDER_SUSPICIOUS = re.compile(
    r"^(noreply|no-reply|support|account|security|payments?|billing|admin|service)"
    r"[\d_.-]*@|@.*\.(tk|ml|ga|cf|gq|xyz|top|work|click|link|email|account)\b",
    re.I
)
IP_IN_HOST = re.compile(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$")

# Brand impersonation: map keyword → set of legitimate domains for that brand
_BRAND_DOMAINS: dict = {
    "paypal":           {"paypal.com"},
    "apple":            {"apple.com", "icloud.com"},
    "microsoft":        {"microsoft.com", "office.com", "outlook.com", "live.com", "hotmail.com"},
    "google":           {"google.com", "gmail.com", "accounts.google.com"},
    "amazon":           {"amazon.com", "amazon.co.uk", "amazon.ca", "amazon.de"},
    "netflix":          {"netflix.com"},
    "ebay":             {"ebay.com", "ebay.co.uk"},
    "chase":            {"chase.com"},
    "bank of america":  {"bankofamerica.com"},
    "wellsfargo":       {"wellsfargo.com"},
    "well fargo":       {"wellsfargo.com"},      # noqa: S1192 shared domain intentional
    "american express": {"americanexpress.com"},
    "amex":             {"americanexpress.com"},  # noqa: S1192 shared domain intentional
    "linkedin":         {"linkedin.com"},
    "dropbox":          {"dropbox.com"},
    "docusign":         {"docusign.com", "docusign.net"},
    "fedex":            {"fedex.com"},
    "ups":              {"ups.com"},
    "dhl":              {"dhl.com"},
    "usps":             {"usps.com"},
    "irs":              {"irs.gov"},
}

# Suspicious TLDs commonly used in phishing domains
_SUSPICIOUS_TLDS = {
    ".tk", ".ml", ".ga", ".cf", ".gq", ".xyz", ".top", ".work",
    ".click", ".link", ".email", ".account", ".online", ".site",
    ".win", ".loan", ".bid", ".stream", ".faith", ".date",
}

# Trusted sender domains: legitimate brands (payment receipts, order confirmations) not treated as phish
_TRUSTED_BASE = {
    "paypal.com", "boostmobile.com", "uber.com", "amazon.com", "ebay.com", "bestbuy.com",
    "target.com", "walmart.com", "apple.com", "microsoft.com", "google.com", "gmail.com",
    "yahoo.com", "outlook.com", "linkedin.com", "netflix.com", "spotify.com", "stripe.com",
    "squareup.com", "venmo.com", "chase.com", "bankofamerica.com", "wellsfargo.com",
    "capitalone.com", "americanexpress.com", "sofi.com", "udemy.com", "reddit.com",
    "quora.com", "oldnavy.com", "gap.com", "backmarket.com", "lyft.com", "doordash.com",
    "grubhub.com", "instacart.com", "zoom.us", "slack.com", "dropbox.com", "adobe.com",
}
def _trusted_domains():
    extra = os.environ.get("PHISHGUARD_TRUSTED_DOMAINS", "")
    out = set(_TRUSTED_BASE)
    for d in extra.replace(" ", "").lower().split(","):
        if d and "." in d:
            out.add(d.strip())
    return out

def _sender_domain(sender: str) -> str:
    """Extract domain from sender (e.g. 'Boost Mobile <noreply@boostmobile.com>' -> boostmobile.com)."""
    if not sender or not isinstance(sender, str):
        return ""
    s = sender.strip().lower()
    if "@" in s:
        part = s.split("@")[-1]
        return part.split(">")[0].split(")")[0].strip()
    if "." in s:
        return s
    return ""


def _sender_looks_trusted(sender: str) -> bool:
    """True if sender string looks like a known brand (display name or email)."""
    if not sender:
        return False
    s = sender.strip().lower()
    # Match domain or display name (e.g. "PayPal", "service@paypal.com", "Boost Mobile")
    brands = (
        "paypal", "boost mobile", "boostmobile", "uber", "amazon", "best buy", "bestbuy",
        "target", "walmart", "linkedin", "netflix", "udemy", "reddit", "quora", "old navy",
        "lyft", "doordash", "sofi", "back market", "backmarket", "venmo", "chase",
        "american express", "capital one", "ebay", "apple", "microsoft", "google", "stripe",
        "spotify", "zoom", "slack", "dropbox", "adobe", "instacart", "grubhub",
    )
    return any(b in s for b in brands)

def _brand_impersonation_score(text: str, sender_domain: str) -> Tuple[int, List[str]]:
    """
    Detect brand impersonation: brand name mentioned in email but sender domain doesn't match.
    e.g. 'Your PayPal account is suspended' sent from random123.tk → High signal.
    """
    score, reasons = 0, []
    low = text.lower()
    for brand, legit_domains in _BRAND_DOMAINS.items():
        if brand in low:
            if sender_domain and not any(sender_domain == d or sender_domain.endswith("." + d) for d in legit_domains):
                score += 3
                reasons.append(f"Brand impersonation: «{brand}» mentioned but sender is «{sender_domain}»")
                break  # one impersonation signal is enough
    return min(score, 3), reasons


def _check_domain_spoofing(d: str, trusted: set) -> Tuple[int, str]:
    """Return (score, reason) if domain spoofs a trusted brand."""
    parts = d.split(".")
    root_domain = ".".join(parts[-2:]) if len(parts) >= 2 else d
    if root_domain in trusted:
        return 0, ""
    for trusted_d in trusted:
        brand_root = trusted_d.split(".")[0]
        if brand_root in d and root_domain != trusted_d:
            return 3, f"Subdomain spoofing: «{d}» mimics «{trusted_d}»"
    return 0, ""


def _url_suspicion_score(domains: list) -> Tuple[int, List[str]]:
    """
    Detect suspicious URL patterns:
    - Suspicious TLDs in links
    - Subdomain spoofing: paypal.login.evil.com
    """
    score, reasons = 0, []
    trusted = _trusted_domains()

    for d in domains:
        for tld in _SUSPICIOUS_TLDS:
            if d.endswith(tld):
                score += 2
                reasons.append(f"Suspicious TLD in link: {d}")
                break

        sp_score, sp_reason = _check_domain_spoofing(d, trusted)
        score += sp_score
        if sp_reason:
            reasons.append(sp_reason)

        if score >= 5:
            break

    return min(score, 5), reasons[:3]


def extract_urls(text: str):
    urls = URL_RE.findall(text or "")
    domains = []
    for u in urls:
        try:
            parsed = urlparse(u)
            host = (parsed.netloc or "").lower().split(":")[0]
            if host:
                domains.append(host)
        except Exception:
            pass
    return urls, domains

def _wording_score(text: str, from_trusted_sender: bool = False) -> Tuple[int, List[str]]:
    """Score 0..6 from malicious wording. If from_trusted_sender, skip single-word 'payment' boost."""
    score, reasons = 0, []
    low = text.lower()
    for phrase in PHISH_WORDING:
        if phrase in low:
            score += 2
            reasons.append(f"Phishing wording: «{phrase[:40]}»")
            if score >= 6:
                break
    urgency_hits = [
        w for w in URGENCY_CRED_WORDS
        if re.search(r"\b" + re.escape(w) + r"\b", low)
        and not (from_trusted_sender and w in ("payment", "invoice"))
    ]
    if len(urgency_hits) >= 2:
        score += 1
        reasons.append(f"Multiple urgency/credential words: {', '.join(urgency_hits[:3])}")
    # Weak phrases only add +1 if other signals already present (avoids flagging legit newsletters)
    if score > 0:
        for phrase in PHISH_WORDING_WEAK:
            if phrase in low:
                score += 1
                reasons.append(f"Suspicious wording: «{phrase[:40]}»")
                break
    return min(score, 6), reasons[:5]

def _identifier_score(urls: list, domains: list) -> Tuple[int, List[str]]:
    """Score 0..5 from suspicious identifiers (sender, domains, IPs)."""
    score, reasons = 0, []
    # Suspicious domains in links
    for d in domains:
        if any(s in d for s in SHORTENERS):
            score += 2
            reasons.append("URL shortener in link")
            break
    if len(domains) > 3:
        score += 1
        reasons.append("Many external links")
    # IP in URL host (often phish)
    for u in (urls or []):
        try:
            host = urlparse(u).netloc.split(":")[0]
            if IP_IN_HOST.match(host):
                score += 2
                reasons.append("IP address in URL")
                break
        except Exception:
            pass
    return min(score, 5), reasons[:4]

def _legit_discount(text: str) -> float:
    """Return 0..1 discount to reduce score for likely legitimate content."""
    low = text.lower()
    if not low.strip():
        return 0.0
    discount = 0.0
    for pat in LEGIT_PATTERNS:
        if re.search(pat, low):
            discount += 0.15
    return min(discount, 0.50)

def _reply_to_score(sender: str, reply_to: str, sender_domain: str) -> Tuple[int, str]:
    """Return (score, reason) if Reply-To domain differs from sender domain."""
    if not (reply_to and sender):
        return 0, ""
    rt_domain = _sender_domain(reply_to)
    if rt_domain and sender_domain and rt_domain != sender_domain:
        return 3, f"Reply-To mismatch: sender «{sender_domain}» vs reply-to «{rt_domain}»"
    return 0, ""


def heuristic_score(subject: str, body: str, sender: str = "", reply_to: str = ""):
    """High-accuracy heuristic: wording + identifiers + impersonation. Trusted senders get lower score."""
    text = f"{subject or ''} {body or ''}".replace("\n", " ")
    urls, domains = extract_urls(body or "")
    domain = _sender_domain(sender)
    trusted = (domain in _trusted_domains() if domain else False) or _sender_looks_trusted(sender)

    score = 0
    reasons = []

    w_score, w_reasons = _wording_score(text, from_trusted_sender=trusted)
    score += w_score
    reasons.extend(w_reasons)

    i_score, i_reasons = _identifier_score(urls, domains)
    score += i_score
    reasons.extend(i_reasons)

    # Brand impersonation (only when sender domain doesn't match the brand)
    if not trusted:
        b_score, b_reasons = _brand_impersonation_score(text, domain)
        score += b_score
        reasons.extend(b_reasons)

    # URL suspicious patterns (subdomain spoofing, bad TLDs)
    u_score, u_reasons = _url_suspicion_score(domains)
    score += u_score
    reasons.extend(u_reasons)

    rt_score, rt_reason = _reply_to_score(sender, reply_to, domain)
    score += rt_score
    if rt_reason:
        reasons.append(rt_reason)

    if urls and not reasons:
        score += 1
        reasons.append("Contains external URL")

    if len((body or "").strip()) < 30 and any(w in text for w in ["urgent", "verify", "click", "password"]):
        score += 1
        reasons.append("Very short message with urgency")

    discount = _legit_discount(text)
    score = max(0, int(round(score * (1.0 - discount))))
    if trusted:
        score = max(0, score - 4)
    return min(score, 10), reasons[:5], urls, domains

def blend_model_with_heuristics(model_prob: float, heur_score: int, trusted_sender: bool = False):
    """
    Calibrated blend: model + heuristics.
    trusted_sender: known brands never get High; usually Low unless strong phish signals.
    """
    if trusted_sender:
        model_points = min(2, int(round(model_prob * 2)))
        total = heur_score + model_points
        if total >= 5:
            risk = "Medium"
        else:
            risk = "Low"
        return total, risk, model_points
    model_points = min(5, int(round(model_prob * 5.5)))
    total = heur_score + model_points
    if model_prob >= 0.90 or total >= 8:
        risk = "High"
    elif total >= 6 or (model_prob >= 0.75 and heur_score >= 1):
        risk = "High"
    elif total >= 4 or model_prob >= 0.58:
        risk = "Medium"
    else:
        risk = "Low"
    return total, risk, model_points

class EmailInput(BaseModel):
    sender_email:str=''
    subject:str=''
    body_snippet:str=''
    links:list=[]
    attachments:list=[]

@app.get('/health')
def health():
    return {'status':'ok'}


@app.post("/scan/batch")
def scan_batch(inp: BatchScoreIn):
    """Score many emails at once (e.g. from Gmail API or Outlook). Same logic as /email/score."""
    results = []
    for item in inp.emails[:200]:
        subject = (item.subject or "").strip()
        body = (item.body or "").strip()
        sender = (getattr(item, "sender", None) or "").strip()
        domain = _sender_domain(sender)
        trusted_sender = domain in _trusted_domains() if domain else False
        text = f"{subject} {body}"
        model_out = score_text(text)
        prob = float(model_out.get("prob_phish", 0.0))
        h_score, h_reasons, _, _ = heuristic_score(subject, body, sender)  # noqa: urls/domains unused in batch
        total, risk, _ = blend_model_with_heuristics(prob, h_score, trusted_sender=trusted_sender)
        threat_pct = round((prob or (total / 10)) * 100)
        results.append({
            "subject": subject[:120],
            "risk": risk,
            "score": total,
            "threat_pct": threat_pct,
            "reasons": h_reasons[:3],
        })
    return {"count": len(results), "results": results}


def _gmail_scan_available():
    try:
        import sentinel.gmail_scan as gs
        return os.environ.get("PHISHGUARD_GMAIL_CREDENTIALS") or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    except Exception:
        return None


@app.get("/scan/gmail")
def scan_gmail(max_results: int = 50):
    """
    Optional: fetch recent Gmail messages and score them via Google API.
    Requires: pip install google-api-python-client google-auth-oauthlib
    and set PHISHGUARD_GMAIL_CREDENTIALS to your OAuth client secret JSON path.
    If not configured, returns JSON with instructions (no error).
    """
    def score_fn(s: str, b: str):
        model_out = score_text(f"{s} {b}")
        prob = float(model_out.get("prob_phish", 0.0))
        h_score, _, _, _ = heuristic_score(s, b)
        total, risk, _ = blend_model_with_heuristics(prob, h_score)
        return {"risk": risk, "threat_pct": round((prob or (total / 10)) * 100)}

    try:
        from sentinel import gmail_scan
    except ImportError:
        return {
            "ok": False,
            "error": "Gmail API not installed. Optional: pip install google-api-python-client google-auth-oauthlib",
            "results": [],
        }
    creds = _gmail_scan_available()
    if not creds:
        return {
            "ok": False,
            "error": "Gmail API not configured. Set PHISHGUARD_GMAIL_CREDENTIALS to OAuth client secret JSON path.",
            "results": [],
        }
    out = gmail_scan.list_and_score_emails(max_results=max_results, score_fn=score_fn)
    return out

def _apply_openai(subject: str, body: str, sender: str, risk: str, total: int):
    """Return (risk, total) adjusted by OpenAI verdict, or unchanged on failure."""
    try:
        from sentinel.openai_check import openai_verdict
        verdict = openai_verdict(subject, body, sender)
        if verdict == "legit":
            return "Low", min(total, 3)
        if verdict == "phish" and risk == "Low":
            return "Medium", max(total, 4)
    except Exception:
        pass
    return risk, total


def _summarize(subject: str, body: str) -> str:
    s = (subject or "").strip()
    b = (body or "").strip().replace("\n", " ")
    if len(b) > 140:
        b = b[:140].rsplit(" ", 1)[0] + "…"
    return f"{s} — {b}" if s and b else (s or b or "No content")


@app.post('/email/score')
def email_score(inp: ScoreIn):
    subject = inp.subject or ""
    body = inp.body or ""
    sender = (inp.sender or "").strip()
    text = f"{subject} {body}".strip()
    domain = _sender_domain(sender)
    trusted_sender = (domain in _trusted_domains() if domain else False) or _sender_looks_trusted(sender)

    # 1) Model probability
    prob = float(score_text(text).get("prob_phish", 0.0))

    # 2) Heuristics
    reply_to = (inp.reply_to or "").strip()
    h_score, h_reasons, urls, domains = heuristic_score(subject, body, sender, reply_to)

    # 3) Blend
    total, risk, _ = blend_model_with_heuristics(prob, h_score, trusted_sender=trusted_sender)

    # 4) Optional OpenAI second opinion
    if getattr(inp, "use_openai", True):
        risk, total = _apply_openai(subject, body, sender, risk, total)

    # 5) Build response
    clean_reasons = [r for r in h_reasons if "model probability" not in r.lower()]
    threat_pct = round((prob or (total / 10)) * 100)

    return {
        "risk": risk,
        "score": total,
        "prob": prob,
        "threat_pct": threat_pct,
        "summary": _summarize(subject, body),
        "reasons": clean_reasons[:3],
        "iocs": {"urls": urls, "domains": list(set(domains)), "attachments": []},
    }

class LogItem(BaseModel):
    sender: str = ""
    subject: str = ""
    risk: str = "Low"   # Low / Medium / High
    scored_at: float = 0

@app.post("/logs/add")
def logs_add(item: LogItem):
    items = _read_logs()
    if not item.scored_at:
        item.scored_at = time.time()
    items.append(item.dict())
    _write_logs(items)
    return {"ok": True, "count": len(items)}

@app.get("/logs/summary")
def logs_summary():
    items = _read_logs()
    total = len(items)
    by_risk = {"Low": 0, "Medium": 0, "High": 0}
    for it in items:
        r = it.get("risk", "Low")
        if r in by_risk:
            by_risk[r] += 1
    return {"total": total, "by_risk": by_risk}

@app.get("/logs/all")
def logs_all():
    return {"items": _read_logs()}


# --- Feedback loop: user-marked safe emails ---
FEEDBACK_PATH = os.path.join(os.path.dirname(__file__), "feedback_safe.json")

class FeedbackItem(BaseModel):
    subject: str = ""
    sender: str = ""
    body_preview: str = ""
    risk_was: str = ""
    prob_was: float = 0.0

def _read_feedback():
    if not os.path.exists(FEEDBACK_PATH):
        return []
    try:
        return json.load(open(FEEDBACK_PATH, "r"))
    except Exception:
        return []

@app.post("/feedback/safe")
def feedback_safe(item: FeedbackItem):
    """Store a user-marked false positive. Used for future hard negative mining."""
    items = _read_feedback()
    entry = item.dict()
    entry["marked_at"] = time.time()
    items.append(entry)
    with open(FEEDBACK_PATH, "w") as f:
        json.dump(items, f, indent=2)
    return {"ok": True, "count": len(items)}

@app.get("/feedback/safe")
def feedback_safe_list():
    """Return all user-marked safe emails."""
    return {"items": _read_feedback()}


reports = []  # temporary storage for results

@app.post("/report")
async def save_report(request: Request):
    data = await request.json()
    data["timestamp"] = datetime.now(timezone.utc).isoformat()
    reports.append(data)
    print(f"✅ Received report: {data}")
    return {"status": "ok", "message": "Report stored!"}

@app.get("/reports")
def get_reports():
    return {"reports": reports}

REPORTS = []

@app.post("/ingest/report")
def ingest_report(item: dict):
    REPORTS.append(item)
    if len(REPORTS) > 1000:
        del REPORTS[:-1000]
    return {"ok": True, "count": len(REPORTS)}

@app.get("/reports/recent")
def reports_recent(limit: int = 50):
    return REPORTS[-limit:][::-1]

@app.get("/reports/summary")
def reports_summary():
    total = len(REPORTS)
    low = sum(1 for r in REPORTS if r.get("risk") == "Low")
    med = sum(1 for r in REPORTS if r.get("risk") == "Medium")
    high = sum(1 for r in REPORTS if r.get("risk") == "High")
    return {"total": total, "low": low, "medium": med, "high": high}

@app.post("/email/score_ml")
def email_score_ml(inp: ScoreIn):
    text = f"{inp.subject} {inp.body}".strip()
    out = score_text(text)
    return {
        "risk": out["risk"],
        "prob_phish": out["prob_phish"],
        "reasons": [f"Model probability={out['prob_phish']:.2f}"]
    }
