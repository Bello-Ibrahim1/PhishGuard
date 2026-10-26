"""
Optional Claude (Anthropic) API check: a third, independent "expert" opinion on whether
an email is legitimate or phishing, meant to be combined with the heuristic score and the
trained ML model as part of an ensemble (see classify_risk() in main.py).

Set ANTHROPIC_API_KEY (or PHISHGUARD_ANTHROPIC_API_KEY) to enable. Set
PHISHGUARD_CLAUDE_ENABLED=0 to disable even if a key is present. Uses a cheap/fast model
(Claude Haiku) by default to keep per-email cost low -- this runs on every scanned email,
so model choice directly drives cost.

Privacy note: only a truncated subject/body snippet and the sender address are sent to
Anthropic's API -- never the full email, never attachments, never other recipients. Nothing
from this call is logged or persisted; on any error this fails silently (returns None)
rather than raising something that could leak email content into an error trace or log.

Mirrors the structure of openai_check.py, but returns a probability (0.0-1.0) instead of
just a LEGIT/PHISH verdict, so it can be weighted-averaged with the other two experts
instead of only contributing a hard vote.
"""
from __future__ import annotations

import os
import re
from typing import Optional


def _get_api_key() -> Optional[str]:
    return os.environ.get("PHISHGUARD_ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_API_KEY") or None


def _is_enabled() -> bool:
    if not _get_api_key():
        return False
    env = os.environ.get("PHISHGUARD_CLAUDE_ENABLED", "1").strip().lower()
    return env in ("1", "true", "yes", "on")


def claude_phish_probability(subject: str, body: str, sender: str = "") -> Optional[float]:
    """
    Ask Claude to rate how likely this email is phishing, as a 0-100 confidence score.
    Returns a float in [0.0, 1.0], or None if disabled / no key / error.
    """
    if not _is_enabled():
        return None
    api_key = _get_api_key()
    if not api_key:
        return None
    try:
        from anthropic import Anthropic
    except ImportError:
        return None

    sender = (sender or "").strip()
    subj = (subject or "")[:500]
    snippet = (body or "")[:800].replace("\n", " ")

    prompt = f"""You are a phishing detector. Rate how likely this email is a phishing/scam
attempt, as a confidence score from 0 to 100 (0 = definitely legitimate, 100 = definitely
phishing).

Sender: {sender}
Subject: {subj}
Body snippet: {snippet}

Legitimate = real transactional emails from known companies (PayPal, Uber, banks, receipts,
order confirmations) or ordinary personal/business correspondence.
Phishing = scam, impersonation, credential theft, suspicious links, urgent money requests
from unknown or spoofed senders.

Reply with exactly one number from 0 to 100. Nothing else -- no words, no punctuation."""

    try:
        client = Anthropic(api_key=api_key)
        model = os.environ.get("PHISHGUARD_CLAUDE_MODEL", "claude-haiku-5-5")
        r = client.messages.create(
            model=model,
            max_tokens=8,
            temperature=0,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(
            block.text for block in r.content if getattr(block, "type", None) == "text"
        ).strip()
        match = re.search(r"\d+(?:\.\d+)?", text)
        if not match:
            return None
        score = float(match.group(0))
        score = max(0.0, min(100.0, score))
        return score / 100.0
    except Exception:
        return None
