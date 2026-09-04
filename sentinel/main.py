import os, json, time
from datetime import datetime
import re
import ipaddress
import socket
from typing import List, Tuple, Optional
from urllib.parse import urlparse
import requests

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
    sender: str = ""  # used to allowlist trusted companies (e.g. paypal.com, uber.com)
    use_openai: bool = True  # when True and OPENAI_API_KEY is set, get a second opinion from OpenAI


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
    "work from home", "voided check", "no experience required", "selected for a",
    "direct deposit setup", "send a copy of your id", "wire your own funds",
]
# Single-word urgency/credential triggers (strong when combined)
URGENCY_CRED_WORDS = [
    "urgent", "immediately", "asap", "overdue", "verify", "password", "login", "confirm",
    "payment", "invoice", "suspend", "blocked", "expire", "click", "update", "secure",
]
# Legitimate signals (reduce false positives)
LEGIT_PATTERNS = [
    r"\b(unsubscribe|view in browser|sent from mail\.|mail\.google\.com)\b",
    r"\b(notification|newsletter|digest|no-reply@)\b",  # many legit newsletters
    r"\b(verification code is|one-time code|one-time passcode|otp is)\b",  # legit 2FA/OTP emails
]
# Suspicious sender/identifier patterns (fraud indicators)
SENDER_SUSPICIOUS = re.compile(
    r"^(noreply|no-reply|support|account|security|payments?|billing|admin|service)"
    r"[\d_.-]*@|@.*\.(tk|ml|ga|cf|gq|xyz|top|work|click|link|email|account)\b",
    re.I
)
IP_IN_HOST = re.compile(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$")
PUNYCODE_RE = re.compile(r"xn--", re.I)

# Trusted sender domains: legitimate brands (payment receipts, order confirmations) not treated as phish
_TRUSTED_BASE = {
    "paypal.com", "boostmobile.com", "uber.com", "amazon.com", "ebay.com", "bestbuy.com",
    "target.com", "walmart.com", "apple.com", "microsoft.com", "google.com", "gmail.com",
    "yahoo.com", "outlook.com", "linkedin.com", "netflix.com", "spotify.com", "stripe.com",
    "squareup.com", "venmo.com", "chase.com", "bankofamerica.com", "wellsfargo.com",
    "capitalone.com", "americanexpress.com", "sofi.com", "udemy.com", "reddit.com",
    "quora.com", "oldnavy.com", "gap.com", "backmarket.com", "lyft.com", "doordash.com",
    "grubhub.com", "instacart.com", "zoom.us", "slack.com", "dropbox.com", "adobe.com",
    "canva.com", "figma.com", "notion.so", "1password.com", "twilio.com", "calendly.com",
    "airbnb.com", "etsy.com", "mailchimp.com", "docusign.net", "docusign.com", "okta.com",
    "github.com", "atlassian.com", "asana.com", "trello.com", "hubspot.com", "salesforce.com",
    "wellsfargo.com", "bankofamerica.com", "usps.com", "fedex.com", "ups.com",
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


def _is_trusted_domain(domain: str) -> bool:
    """True only if domain is an EXACT trusted domain or a subdomain of one
    (e.g. 'mail.paypal.com' is trusted; 'paypal-verify.com' and 'paypal.com.evil.tk' are NOT).
    Domain trust must never be based on display-name text, since that is fully attacker-controlled."""
    if not domain:
        return False
    domain = domain.strip().lower()
    trusted = _trusted_domains()
    if domain in trusted:
        return True
    return any(domain.endswith("." + t) for t in trusted)


# Brand keyword -> real domain(s), used ONLY to detect impersonation (a brand name showing up
# in the display name or sender domain while the actual domain does NOT match that brand).
_BRAND_DOMAINS = {
    "paypal": ("paypal.com",), "boost mobile": ("boostmobile.com",), "boostmobile": ("boostmobile.com",),
    "uber": ("uber.com",), "amazon": ("amazon.com",), "best buy": ("bestbuy.com",), "bestbuy": ("bestbuy.com",),
    "target": ("target.com",), "walmart": ("walmart.com",), "linkedin": ("linkedin.com",),
    "netflix": ("netflix.com",), "udemy": ("udemy.com",), "reddit": ("reddit.com",), "quora": ("quora.com",),
    "old navy": ("oldnavy.com",), "lyft": ("lyft.com",), "doordash": ("doordash.com",), "sofi": ("sofi.com",),
    "venmo": ("venmo.com",), "chase": ("chase.com",), "american express": ("americanexpress.com",),
    "capital one": ("capitalone.com",), "ebay": ("ebay.com",), "apple": ("apple.com",),
    "microsoft": ("microsoft.com",), "google": ("google.com", "gmail.com"), "stripe": ("stripe.com",),
    "spotify": ("spotify.com",), "zoom": ("zoom.us",), "slack": ("slack.com",), "dropbox": ("dropbox.com",),
    "adobe": ("adobe.com",), "instacart": ("instacart.com",), "grubhub": ("grubhub.com",),
    "wells fargo": ("wellsfargo.com",), "bank of america": ("bankofamerica.com",), "docusign": ("docusign.net", "docusign.com"),
    "okta": ("okta.com",), "usps": ("usps.com",), "irs": ("irs.gov",),
}


def _brand_impersonation(sender: str, subject: str, body: str):
    """Detect a brand name in the sender display-name/domain (or subject) whose ACTUAL sending
    domain does not match that brand's real domain(s) -> classic spoofing/typosquat pattern.
    Returns (brand_name or None)."""
    sender_l = (sender or "").lower()
    domain = _sender_domain(sender)
    text_l = f"{sender_l} {subject or ''}".lower()
    for brand, real_domains in _BRAND_DOMAINS.items():
        if brand not in text_l:
            continue
        if domain and any(domain == d or domain.endswith("." + d) for d in real_domains):
            continue  # genuinely from the brand's real domain
        return brand
    return None


def _domain_lookalike_brand(host: str):
    """A link/redirect domain that contains or closely resembles a known brand name but does
    NOT match that brand's real domain(s) -> classic typosquat/lookalike pattern (e.g.
    'paypal-verify.tk' or 'paypa1-secure.com'). Distinct from _brand_impersonation, which looks
    at sender text; this looks at a URL's actual host."""
    if not host:
        return None
    host_l = host.lower()
    host_key = host_l.replace("-", "").replace(".", "")
    for brand, real_domains in _BRAND_DOMAINS.items():
        brand_key = brand.replace(" ", "")
        if brand_key not in host_key:
            continue
        if any(host_l == d or host_l.endswith("." + d) for d in real_domains):
            continue  # genuinely the brand's real domain
        return brand
    return None

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
            reasons.append(f"Phishing wording: «{phrase[:40]}…»")
            if score >= 6:
                break
    for w in URGENCY_CRED_WORDS:
        if re.search(r"\b" + re.escape(w) + r"\b", low):
            if from_trusted_sender and w in ("payment", "invoice"):
                continue
            score += 1
            reasons.append(f"Urgency/credential word: {w}")
            break
    return min(score, 6), reasons[:5]

def _identifier_score(subject: str, body: str, urls: list, domains: list) -> Tuple[int, List[str]]:
    """Score 0..5 from suspicious identifiers (sender, domains, IPs)."""
    score, reasons = 0, []
    text = f"{subject or ''} {body or ''}"
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
    # Punycode/IDN domains are a classic homograph-attack technique (displaying as
    # e.g. "paypal.com" while actually resolving to a different, attacker-controlled host).
    for d in domains:
        if PUNYCODE_RE.search(d):
            score += 2
            reasons.append("Punycode/IDN domain in link (possible homograph attack)")
            break
    # A link domain that resembles a known brand but isn't that brand's real domain.
    for d in domains:
        brand = _domain_lookalike_brand(d)
        if brand:
            score += 3
            reasons.append(f"Link domain resembles {brand.title()} but isn't its real domain")
            break
    return min(score, 5), reasons[:6]

def _legit_discount(text: str) -> float:
    """Return 0..1 discount to reduce score for likely legitimate content."""
    low = text.lower()
    if not low.strip():
        return 0.0
    discount = 0.0
    for pat in LEGIT_PATTERNS:
        if re.search(pat, low):
            discount += 0.15
    return min(discount, 0.35)

def heuristic_score(subject: str, body: str, sender: str = ""):
    """High-accuracy heuristic: wording + identifiers. Trusted senders get lower wording score.
    Trust is based ONLY on the actual sending domain (never on display-name text, which an
    attacker fully controls). A brand name appearing in the sender/subject while the real
    domain does NOT match that brand is treated as strong impersonation evidence instead."""
    text = f"{subject or ''} {body or ''}".replace("\n", " ")
    urls, domains = extract_urls(body or "")
    domain = _sender_domain(sender)
    trusted = _is_trusted_domain(domain)
    impersonated_brand = _brand_impersonation(sender, subject, body)

    score = 0
    reasons = []

    w_score, w_reasons = _wording_score(text, from_trusted_sender=trusted)
    score += w_score
    reasons.extend(w_reasons)

    i_score, i_reasons = _identifier_score(subject or "", body or "", urls, domains)
    score += i_score
    reasons.extend(i_reasons)

    if impersonated_brand:
        score += 4
        reasons.insert(0, f"Sender impersonates {impersonated_brand.title()} (domain does not match)")

    if urls and not reasons:
        score += 1
        reasons.append("Contains external URL")

    if len((body or "").strip()) < 30 and any(w in text for w in ["urgent", "verify", "click", "password"]):
        score += 1
        reasons.append("Very short message with urgency")

    discount = _legit_discount(text)
    score = max(0, int(round(score * (1.0 - discount))))
    if trusted and not impersonated_brand:
        score = max(0, score - 4)
    return min(score, 10), reasons[:5], urls, domains

# --- Unified risk classification (efficient, evidence-based) ---
def _has_strong_phish_evidence(heur_reasons: List[str]) -> bool:
    """True if reasons include high-confidence phish signals (not just single words like 'payment')."""
    strong = (
        "Phishing wording:",
        "URL shortener",
        "IP address in URL",
        "Many external links",
        "Very short message with urgency",
        "Sender impersonates",
        "Punycode/IDN domain",
        "Link domain resembles",
    )
    return any(s in r for r in (heur_reasons or []) for s in strong)


def classify_risk(
    model_prob: float,
    heur_score: int,
    heur_reasons: List[str],
    trusted_sender: bool,
) -> Tuple[int, str, int]:
    """
    Single, efficient risk classifier: weighted combined score + explicit rules.
    Returns (total_score, risk_level, model_pts).
    - High: only when we have strong evidence (phish phrases, shorteners, etc.) AND high model prob.
    - Medium: some signals or uncertain model; never High for trusted senders.
    - Low: few/no signals, or trusted sender, or low model prob.
    """
    # Combined score: 60% model, 40% heuristics (normalized 0..10 -> 0..1)
    heur_norm = min(1.0, heur_score / 10.0)
    combined = 0.6 * model_prob + 0.4 * heur_norm
    model_pts = min(5, int(round(model_prob * 5.0)))
    total = heur_score + model_pts

    if trusted_sender:
        total = min(total, heur_score + min(2, int(round(model_prob * 2))))
        if total >= 5:
            return total, "Medium", min(2, model_pts)
        return total, "Low", min(2, model_pts)

    strong_evidence = _has_strong_phish_evidence(heur_reasons)

    if combined >= 0.75 and (model_prob >= 0.82 or strong_evidence):
        return total, "High", model_pts
    if combined >= 0.70 and strong_evidence:
        return total, "High", model_pts
    if combined >= 0.35 or total >= 3:
        return total, "Medium", model_pts
    return total, "Low", model_pts

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
        text = f"{subject} {body}"
        model_out = score_text(text)
        prob = float(model_out.get("prob_phish", 0.0))
        h_score, h_reasons, urls, domains = heuristic_score(subject, body, sender)
        trusted_sender = _is_trusted_domain(domain) and not _brand_impersonation(sender, subject, body)
        total, risk, _ = classify_risk(prob, h_score, h_reasons, trusted_sender)
        threat_pct = round(min(10, total) / 10 * 100)  # derived from final (trust/impersonation-adjusted) score, not raw prob
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
        h_score, h_reasons, _, _ = heuristic_score(s, b, "")
        total, risk, _ = classify_risk(prob, h_score, h_reasons, trusted_sender=False)
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

@app.post('/email/score')
def email_score(inp: ScoreIn):
    subject = inp.subject or ""
    body = inp.body or ""
    sender = (inp.sender or "").strip()
    text = f"{subject} {body}".strip()
    domain = _sender_domain(sender)
    trusted_sender = _is_trusted_domain(domain) and not _brand_impersonation(sender, subject, body)

    # 1) Model probability
    model_out = score_text(text)
    prob = float(model_out.get("prob_phish", 0.0))

    # 2) Heuristics (trusted senders get lower score for "payment" etc.)
    h_score, h_reasons, urls, domains = heuristic_score(subject, body, sender)

    # 3) Unified risk classification (evidence-based, efficient)
    total, risk, model_pts = classify_risk(prob, h_score, h_reasons, trusted_sender)

    # 4) Optional OpenAI second opinion (when OPENAI_API_KEY is set and use_openai=True)
    if getattr(inp, "use_openai", True):
        try:
            from sentinel.openai_check import openai_verdict
            verdict = openai_verdict(subject, body, sender)
            if verdict == "legit":
                risk = "Low"
                total = min(total, 3)
            elif verdict == "phish" and risk == "Low":
                risk = "Medium"
                total = max(total, 4)
        except Exception:
            pass

    # 5) Reasons / IoCs
    reasons = []
    if h_reasons:
        reasons.extend(h_reasons)
    reasons.append(f"Model probability={prob:.2f} (+{model_pts})")

    # --- new return builder ---
    clean_reasons = [r for r in reasons if "model probability" not in r.lower()]

    def summarize(subject: str, body: str) -> str:
        s = (subject or "").strip()
        b = (body or "").strip().replace("\n", " ")
        if len(b) > 140:
            b = b[:140].rsplit(" ", 1)[0] + "…"
        return f"{s} — {b}" if s and b else (s or b or "No content")

    summary = summarize(subject, body)
    prob = locals().get("prob", None)  # if you have prob, use it; else None
    threat_pct = round(min(10, total) / 10 * 100)  # derived from final (trust/impersonation-adjusted) score, not raw prob

    iocs = {
        "urls": urls,
        "domains": list(set(domains)),
        "attachments": []
    }

    return {
        "risk": risk,                   # "Low" | "Medium" | "High"
        "score": total,                 # 0..10
        "prob": prob,                   # optional
        "threat_pct": threat_pct,       # 0..100
        "summary": summary,             # <-- for the overlay to show
        "reasons": clean_reasons[:3],   # top few, human-friendly
        "iocs": iocs,                   # unchanged
    }

# --- Sandboxed link deep-scan: PhishGuard's backend visits the link, never the user's own
# browser/device, so a suspicious URL never has to be opened by a real person. This is a
# heuristic, non-JS-executing inspection (a plain HTTP GET + HTML parse) — it will not catch a
# page that only reveals a credential form after running JavaScript, and that limitation is
# intentional to keep this fast and dependency-light; it is not a substitute for a full
# browser-based sandbox. Basic SSRF protections block requests to private/internal networks.
_PRIVATE_NETS = [ipaddress.ip_network(cidr) for cidr in (
    "0.0.0.0/8", "127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
    "169.254.0.0/16", "::1/128", "fc00::/7", "fe80::/10",
)]

def _is_blocked_ip(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True  # unparseable -> block, fail closed
    if any(ip in net for net in _PRIVATE_NETS):
        return True
    return bool(ip.is_reserved or ip.is_multicast or ip.is_link_local or ip.is_loopback or ip.is_unspecified)

def _resolve_host_safe(host: str):
    """Resolve a hostname. Returns (ips, reason): ips is a non-empty set only if resolution
    succeeded AND none of the resolved addresses are private/internal; otherwise ips is None
    and reason explains why ("dns" = couldn't resolve at all, "private" = resolved but blocked)."""
    if not host:
        return None, "empty host"
    try:
        infos = socket.getaddrinfo(host, None)
    except Exception:
        return None, "dns"
    ips = {info[4][0] for info in infos}
    if not ips:
        return None, "dns"
    if any(_is_blocked_ip(ip) for ip in ips):
        return None, "private"
    return ips, None


class LinkScanIn(BaseModel):
    url: str
    expected_brand: str = ""  # optional: brand the email claimed to be from, e.g. "paypal"


@app.post("/scan/link_deepscan")
def link_deepscan(inp: LinkScanIn):
    """Visit a link inside PhishGuard's own sandboxed backend request (not the user's browser),
    follow redirects, and inspect the final page for phishing signals — so the user never has
    to click a suspicious link themselves to find out where it goes."""
    url = (inp.url or "").strip()
    result = {
        "url": url, "ok": False, "final_url": None, "status_code": None,
        "redirect_count": 0, "title": None, "flags": [], "risk": "Unknown",
    }
    try:
        parsed = urlparse(url)
    except Exception:
        result["flags"] = ["Could not parse this as a URL"]
        return result
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        result["flags"] = ["Not an http(s) URL"]
        return result

    host = (parsed.hostname or "").lower()
    ips, block_reason = _resolve_host_safe(host)
    if not ips:
        if block_reason == "dns":
            result["flags"] = ["Could not resolve this domain (DNS lookup failed, or no network access from this backend)"]
            result["risk"] = "Unknown"
        else:
            result["flags"] = ["Blocked: this host resolves to a private/internal address, not scanned"]
            result["risk"] = "Blocked"
        return result

    try:
        resp = requests.get(
            url, timeout=8, allow_redirects=True, stream=False,
            headers={"User-Agent": "Mozilla/5.0 (compatible; PhishGuardSandbox/1.0)"},
        )
    except requests.exceptions.SSLError:
        result["flags"] = ["SSL/certificate error while connecting"]
        result["risk"] = "Medium"
        return result
    except requests.exceptions.Timeout:
        result["flags"] = ["Timed out — the site may be slow, unreachable, or evasive"]
        result["risk"] = "Medium"
        return result
    except requests.exceptions.RequestException as e:
        result["flags"] = [f"Could not reach the site ({type(e).__name__})"]
        result["risk"] = "Medium"
        return result

    final_url = resp.url
    final_host = (urlparse(final_url).hostname or "").lower()
    final_ips, final_block_reason = _resolve_host_safe(final_host)
    if not final_ips and final_block_reason == "private":
        result["flags"] = ["Blocked: redirected to a private/internal address"]
        result["risk"] = "Blocked"
        return result

    result.update({
        "ok": True,
        "final_url": final_url,
        "status_code": resp.status_code,
        "redirect_count": len(resp.history),
    })

    html = (resp.text or "")[:200000]
    title_m = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    if title_m:
        result["title"] = re.sub(r"\s+", " ", title_m.group(1)).strip()[:200]
    has_password_field = bool(re.search(r'type=["\']?password', html, re.I))

    flags, score = [], 0
    if resp.history:
        flags.append(f"Redirected {len(resp.history)}x before landing on the final page")
        score += 1
    if final_host and host and final_host != host:
        flags.append(f"Final domain ({final_host}) differs from the link's domain ({host})")
        score += 1
    if has_password_field:
        flags.append("Final page has a password field")
        score += 2
    lookalike_brand = _domain_lookalike_brand(final_host) or _domain_lookalike_brand(host)
    if lookalike_brand:
        flags.append(f"Domain resembles {lookalike_brand.title()} but isn't its real domain")
        score += 3
    if inp.expected_brand:
        brand = inp.expected_brand.strip().lower()
        real_domains = _BRAND_DOMAINS.get(brand)
        if real_domains and not any(final_host == d or final_host.endswith("." + d) for d in real_domains):
            flags.append(f"Email claimed to be {brand.title()} but this link doesn't go to {brand.title()}'s real domain")
            score += 3
    if IP_IN_HOST.match(final_host or ""):
        flags.append("Final URL host is a raw IP address")
        score += 2
    if PUNYCODE_RE.search(final_host or "") or PUNYCODE_RE.search(host or ""):
        flags.append("Punycode/IDN domain (possible homograph attack)")
        score += 2

    result["flags"] = flags
    result["risk"] = "High" if score >= 4 else ("Medium" if score >= 2 else "Low")
    return result


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

reports = []  # temporary storage for results

@app.post("/report")
async def save_report(request: Request):
    data = await request.json()
    data["timestamp"] = datetime.utcnow().isoformat()
    reports.append(data)
    print(f"✅ Received report: {data}")
    return {"status": "ok", "message": "Report stored!"}

@app.get("/reports")
def get_reports():
    return {"reports": reports}

# Reports are partitioned per-user (keyed by the extension's private client_id, a random
# id generated once per install — see getClientId() in panel.js) instead of one shared
# list everyone's scans landed in. That older shared version meant anyone with the
# dashboard URL could see every installer's scanned senders/subjects, not just their own —
# fine for one person testing, not something to ship to real users. A client_id is not a
# real authenticated account (nothing stops someone from guessing/sharing one), but it's
# never displayed or discoverable, and it means each person's dashboard link only shows
# their own data by default the way an unlisted-but-unauthenticated link normally does.
REPORTS: dict[str, list] = {}          # client_id -> list of report dicts
REPORTS_INDEX: dict[str, dict[str, int]] = {}  # client_id -> {identity key -> index}

# Was capped at 1000 (then a single shared 50000), which either silently truncated a big
# inbox scan or gave one giant list for everyone. Now each user gets their own 50000-entry
# budget — still comfortably past any single inbox scan, and per-user strings are small
# enough that this stays cheap even across a fair number of installs.
REPORTS_CAP = 50000

# The extension re-scores the same email whenever it's still visible on a later "Scan
# visible" click, whenever real-time protection's MutationObserver fires again, or if it's
# caught by both a full API scan and the live inbox — every one of those used to append a
# brand new /ingest/report entry for the SAME email, so the same message could pile up as
# several duplicate rows (and inflate the Total/Low/Medium/High counts) the more you used
# the extension. Give each report a stable identity and upsert instead of blindly
# appending: the real Gmail message id (gmail_link) when we have it, since that uniquely
# identifies the actual email regardless of which scan found it; otherwise sender+subject+
# received-time, which in practice only collides for what really is the same email.
def _report_key(item: dict) -> str:
    gmail_link = item.get("gmail_link")
    if gmail_link:
        return f"link:{gmail_link}"
    # Source included so an Outlook and a Yahoo report can never collide on identity just
    # because they happen to share a sender/subject/time — each mailbox's own reports only
    # ever dedup against themselves.
    return f"c:{item.get('source','')}|{item.get('sender','')}|{item.get('subject','')}|{item.get('time','')}"

def _reindex_reports(client_id: str):
    reports = REPORTS.get(client_id, [])
    idx = {}
    for i, r in enumerate(reports):
        idx[_report_key(r)] = i
    REPORTS_INDEX[client_id] = idx

@app.post("/ingest/report")
def ingest_report(item: dict):
    # No client_id means an old/broken client — file it under a bucket nothing can ever
    # read back (no /reports endpoint accepts an empty uid), rather than either crashing
    # or silently mixing it into someone else's data.
    client_id = (item.get("client_id") or "").strip() or "__no_client_id__"
    reports = REPORTS.setdefault(client_id, [])
    index = REPORTS_INDEX.setdefault(client_id, {})

    key = _report_key(item)
    idx = index.get(key)
    is_duplicate = idx is not None and idx < len(reports)
    if is_duplicate:
        reports[idx] = item  # refresh in place (e.g. risk/reasons changed on a re-score)
    else:
        reports.append(item)
        index[key] = len(reports) - 1
        if len(reports) > REPORTS_CAP:
            del reports[:-REPORTS_CAP]
            _reindex_reports(client_id)  # trimming shifts every remaining index
    return {"ok": True, "count": len(reports), "duplicate": is_duplicate}

@app.get("/reports/recent")
def reports_recent(uid: str = "", limit: int = 200):
    uid = (uid or "").strip()
    if not uid:
        return []
    reports = REPORTS.get(uid, [])
    return reports[-limit:][::-1]

@app.get("/reports/summary")
def reports_summary(uid: str = ""):
    uid = (uid or "").strip()
    reports = REPORTS.get(uid, []) if uid else []
    total = len(reports)
    low = sum(1 for r in reports if r.get("risk") == "Low")
    med = sum(1 for r in reports if r.get("risk") == "Medium")
    high = sum(1 for r in reports if r.get("risk") == "High")
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
