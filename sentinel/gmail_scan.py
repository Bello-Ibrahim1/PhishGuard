"""
Optional Gmail API batch scan. Only used if google-api-python-client is installed
and PHISHGUARD_GMAIL_CREDENTIALS (or GOOGLE_APPLICATION_CREDENTIALS) is set.
For most users, prefer POST /scan/batch with emails you fetch via Gmail API from your own script.
"""
from __future__ import annotations

import os
from typing import List, Dict, Any, Optional, Callable

def list_and_score_emails(
    max_results: int = 50,
    credentials_path: Optional[str] = None,
    score_fn: Optional[Callable] = None,
) -> Dict[str, Any]:
    """
    Fetch recent Gmail messages and score them. Returns dict with results or error.
    score_fn(subject, body) -> dict with risk, threat_pct, etc.
    """
    try:
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
    except ImportError:
        return {
            "ok": False,
            "error": "Gmail API not installed. Optional: pip install google-api-python-client google-auth-oauthlib",
            "results": [],
        }

    creds_path = credentials_path or os.environ.get("PHISHGUARD_GMAIL_CREDENTIALS") or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not creds_path or not os.path.isfile(creds_path):
        return {
            "ok": False,
            "error": "Gmail credentials not set. Set PHISHGUARD_GMAIL_CREDENTIALS to your OAuth client secret JSON path.",
            "results": [],
        }

    if score_fn is None:
        return {"ok": False, "error": "score_fn required", "results": []}

    try:
        SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
        creds = None
        token_path = os.path.join(os.path.dirname(creds_path) or ".", "token.json")
        if os.path.exists(token_path):
            creds = Credentials.from_authorized_user_file(token_path, SCOPES)
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES)
                creds = flow.run_local_server(port=0)
            with open(token_path, "w") as t:
                t.write(creds.to_json())

        service = build("gmail", "v1", credentials=creds)
        results = service.users().messages().list(userId="me", maxResults=max_results).execute()
        messages = results.get("messages", []) or []
        out = []
        for msg_ref in messages:
            try:
                msg = service.users().messages().get(userId="me", id=msg_ref["id"], format="metadata", metadataHeaders=["Subject"]).execute()
                payload = msg.get("payload", {})
                headers = {h["name"].lower(): h["value"] for h in payload.get("headers", [])}
                subject = headers.get("subject", "")
                snippet = msg.get("snippet", "")
                scored = score_fn(subject, snippet)
                out.append({
                    "id": msg_ref["id"],
                    "subject": (subject or "")[:120],
                    "snippet": (snippet or "")[:200],
                    "risk": scored.get("risk", "Low"),
                    "threat_pct": scored.get("threat_pct", 0),
                })
            except Exception as e:
                out.append({"id": msg_ref.get("id"), "error": str(e)})
        return {"ok": True, "results": out, "count": len(out)}
    except Exception as e:
        return {"ok": False, "error": str(e), "results": []}
