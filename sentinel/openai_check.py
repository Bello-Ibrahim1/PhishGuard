"""
Optional OpenAI API check: second opinion on whether an email is legitimate or phishing.
Set OPENAI_API_KEY (or PHISHGUARD_OPENAI_API_KEY) to enable. Set PHISHGUARD_OPENAI_ENABLED=0 to disable.
"""
from __future__ import annotations

import os
from typing import Optional, Literal

Verdict = Literal["legit", "phish"]


def _get_api_key() -> Optional[str]:
    return os.environ.get("PHISHGUARD_OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY") or None


def _is_enabled() -> bool:
    if not _get_api_key():
        return False
    env = os.environ.get("PHISHGUARD_OPENAI_ENABLED", "1").strip().lower()
    return env in ("1", "true", "yes", "on")


def openai_verdict(subject: str, body: str, sender: str = "") -> Optional[Verdict]:
    """
    Ask OpenAI to classify the email as likely legitimate (e.g. from known company) or phishing.
    Returns "legit", "phish", or None if disabled / no key / error.
    """
    if not _is_enabled():
        return None
    api_key = _get_api_key()
    if not api_key:
        return None
    try:
        from openai import OpenAI
    except ImportError:
        return None

    sender = (sender or "").strip()
    subj = (subject or "")[:500]
    snippet = (body or "")[:800].replace("\n", " ")

    prompt = f"""You are a phishing detector. Classify this email as LEGIT or PHISH.

Sender: {sender}
Subject: {subj}
Body snippet: {snippet}

Legitimate = real transactional emails from known companies (PayPal, Uber, banks, receipts, order confirmations).
Phishing = scam, impersonation, credential theft, suspicious links, urgent money requests from unknown senders.

Reply with exactly one word: LEGIT or PHISH. Nothing else."""

    try:
        client = OpenAI(api_key=api_key)
        r = client.chat.completions.create(
            model=os.environ.get("PHISHGUARD_OPENAI_MODEL", "gpt-4o-mini"),
            messages=[{"role": "user", "content": prompt}],
            max_tokens=10,
            temperature=0,
        )
        text = (r.choices[0].message.content or "").strip().upper()
        if "LEGIT" in text:
            return "legit"
        if "PHISH" in text:
            return "phish"
        return None
    except Exception:
        return None
