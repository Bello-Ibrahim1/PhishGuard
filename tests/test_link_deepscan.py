"""
Offline tests for the sandboxed link deep-scan endpoint and the new link-safety heuristics.

Both available test environments for this session turned out to be network-restricted (the
local device shell has no network access at all; the cloud dev container only allows a fixed
package-registry allowlist and returns 403 Forbidden for arbitrary sites), so a true live fetch
of a real phishing-style page could not be exercised end-to-end here. These tests instead mock
requests.get to simulate real HTTP responses (redirects, a credential-harvesting page, SSL/DNS
failures) so the actual parsing/scoring logic is genuinely regression-tested, and separately
verify the SSRF protection with real (network-free) DNS/IP logic. Run with:
    python3 tests/test_link_deepscan.py
"""
import sys
import os
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests
from sentinel import main as m

failures = 0
def check(label, cond):
    global failures
    print(("PASS " if cond else "FAIL ") + label)
    if not cond:
        failures += 1


def fake_response(url, status_code=200, history=None, text="<html><head><title>T</title></head><body></body></html>"):
    r = MagicMock()
    r.url = url
    r.status_code = status_code
    r.history = history or []
    r.text = text
    return r


# ---------- SSRF / private-IP protection (pure logic, no network needed) ----------
check("blocks loopback IP", m._is_blocked_ip("127.0.0.1") is True)
check("blocks cloud metadata IP", m._is_blocked_ip("169.254.169.254") is True)
check("blocks RFC1918 10.x", m._is_blocked_ip("10.1.2.3") is True)
check("blocks RFC1918 192.168.x", m._is_blocked_ip("192.168.1.1") is True)
check("allows a real public IP", m._is_blocked_ip("93.184.216.34") is False)
check("blocks unparseable input (fail closed)", m._is_blocked_ip("not-an-ip") is True)

# ---------- domain lookalike detection (pure logic) ----------
check("detects paypal lookalike", m._domain_lookalike_brand("paypal-secure-login.tk") == "paypal")
check("does not flag real paypal.com", m._domain_lookalike_brand("paypal.com") is None)
check("does not flag unrelated domain", m._domain_lookalike_brand("example.com") is None)
check("detects lookalike subdomain-style", m._domain_lookalike_brand("paypal.verify-account.xyz") == "paypal")

# ---------- link_deepscan: URL validation, no network needed ----------
r = m.link_deepscan(m.LinkScanIn(url="javascript:alert(1)"))
check("rejects non-http(s) scheme", r["flags"] == ["Not an http(s) URL"] and r["risk"] == "Unknown")

r = m.link_deepscan(m.LinkScanIn(url="not a url at all"))
check("rejects unparseable/no-netloc URL", "Not an http(s) URL" in r["flags"])

# ---------- link_deepscan: SSRF blocking with real (network-free) DNS resolution ----------
r = m.link_deepscan(m.LinkScanIn(url="http://127.0.0.1/admin"))
check("blocks loopback target", r["risk"] == "Blocked" and "private" in r["flags"][0])

r = m.link_deepscan(m.LinkScanIn(url="http://169.254.169.254/latest/meta-data/"))
check("blocks cloud metadata target", r["risk"] == "Blocked")

r = m.link_deepscan(m.LinkScanIn(url="http://this-domain-should-not-exist-abc123xyz.invalid/"))
check("DNS failure reported distinctly from a block", r["risk"] == "Unknown" and "resolve" in r["flags"][0].lower())

# ---------- link_deepscan: mocked HTTP responses (simulating real fetch outcomes) ----------
with patch.object(m, "_resolve_host_safe", return_value=({"93.184.216.34"}, None)):
    with patch.object(m.requests, "get", return_value=fake_response(
        "https://example.com/", text="<html><head><title>Example Domain</title></head><body>Hi</body></html>"
    )):
        r = m.link_deepscan(m.LinkScanIn(url="https://example.com/"))
        check("clean page scores Low", r["ok"] is True and r["risk"] == "Low")
        check("clean page has no flags", r["flags"] == [])
        check("title extracted correctly", r["title"] == "Example Domain")

    # Simulated credential-harvesting lookalike page, reached via 2 redirects
    phishy_html = '<html><head><title>PayPal - Log In</title></head><body><form><input type="password" name="pw"></form></body></html>'
    with patch.object(m.requests, "get", return_value=fake_response(
        "https://paypal-secure-login.tk/login",
        history=[MagicMock(), MagicMock()],
        text=phishy_html,
    )):
        r = m.link_deepscan(m.LinkScanIn(url="https://bit.ly/fake123", expected_brand="paypal"))
        check("phishing-style redirect chain scores High", r["risk"] == "High")
        check("flags redirect count", any("Redirected 2x" in f for f in r["flags"]))
        check("flags password field", any("password field" in f for f in r["flags"]))
        check("flags brand lookalike domain", any("Resembles" in f or "resembles" in f for f in r["flags"]))
        check("flags expected-brand mismatch", any("claimed to be Paypal" in f for f in r["flags"]))

    # SSL error path
    with patch.object(m.requests, "get", side_effect=requests.exceptions.SSLError("bad cert")):
        r = m.link_deepscan(m.LinkScanIn(url="https://example.com/"))
        check("SSL error handled gracefully", r["risk"] == "Medium" and "SSL" in r["flags"][0])

    # Timeout path
    with patch.object(m.requests, "get", side_effect=requests.exceptions.Timeout("slow")):
        r = m.link_deepscan(m.LinkScanIn(url="https://example.com/"))
        check("timeout handled gracefully", r["risk"] == "Medium" and "Timed out" in r["flags"][0])

    # Generic connection error path
    with patch.object(m.requests, "get", side_effect=requests.exceptions.ConnectionError("refused")):
        r = m.link_deepscan(m.LinkScanIn(url="https://example.com/"))
        check("connection error handled gracefully", r["risk"] == "Medium" and "Could not reach" in r["flags"][0])

    # Redirect into a private address must still be blocked, even if the ORIGINAL host was public
    with patch.object(m, "_resolve_host_safe", side_effect=[({"93.184.216.34"}, None), (None, "private")]):
        with patch.object(m.requests, "get", return_value=fake_response("http://169.254.169.254/secret")):
            r = m.link_deepscan(m.LinkScanIn(url="https://example.com/redirect-to-metadata"))
            check("blocks a redirect that lands on a private address", r["risk"] == "Blocked")

# ---------- heuristic_score: punycode + lookalike domain integration ----------
_, reasons, _, _ = m.heuristic_score(
    "Account alert", "Login at http://xn--pypal-4ve.com/login to continue", "alerts@xn--pypal-4ve.com"
)
check("heuristic_score flags punycode domain", any("Punycode" in r for r in reasons))

_, reasons2, _, _ = m.heuristic_score(
    "PayPal: verify your account",
    "Please visit http://paypal-secure-login.tk/verify to confirm your identity",
    "PayPal <support@paypal-secure-login.tk>",
)
check("heuristic_score flags brand-lookalike link domain or impersonation",
      any("resembles Paypal" in r or "impersonates Paypal" in r for r in reasons2))

print(f"\n{'ALL LINK DEEPSCAN TESTS PASSED' if failures == 0 else str(failures) + ' TEST(S) FAILED'}")
sys.exit(0 if failures == 0 else 1)
