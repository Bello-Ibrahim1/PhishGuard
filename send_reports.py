#!/usr/bin/env python3

# send_reports.py — push rows from a CSV (e.g., Nigerian_fraud.csv) into your backend /report

import csv, argparse, time, json, requests
from pathlib import Path

def detect_column(cols, candidates):
    if not cols: return None
    # exact
    for c in candidates:
        for k in cols:
            if k and k.lower().strip() == c: return k
    # partial
    for c in candidates:
        for k in cols:
            if k and c in k.lower(): return k
    return None

def label_to_risk(label):
    if label is None: return "Low"
    s = str(label).strip().lower()
    if s in ("1","phish","phishing","spam","fraud","malicious","scam"):
        return "High"
    if s in ("0","legit","ham","benign","good"):
        return "Low"
    try:
        f = float(s)
        if f >= 0.6: return "High"
        if f >= 0.3: return "Medium"
        return "Low"
    except: pass
    if any(w in s for w in ("phish","fraud","scam","suspicious","urgent")):
        return "High"
    return "Low"

def build_reasons(subject, body, urls, label, sender):
    reasons = []
    if urls and "http" in urls.lower():
        reasons.append("Contains external link")
    if subject and any(w in subject.lower() for w in ("urgent","verify","password","login","account","payment","invoice","confirm")):
        reasons.append("Urgent language")
    if sender and "@" in sender:
        domain = sender.split("@")[-1].lower()
        if any(x in domain for x in ("-","update","verify","secure","account","support","online")):
            reasons.append("Suspicious sender domain")
    if label: reasons.append(f"Label: {label}")
    return reasons[:6]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csvfile", help="Path to CSV (e.g., datasets/Nigerian_fraud.csv)")
    ap.add_argument("--limit", type=int, default=200)
    ap.add_argument("--delay", type=float, default=0.10)   # seconds between posts
    ap.add_argument("--url", default="http://127.0.0.1:8000/report")
    ap.add_argument("--inspect", action="store_true", help="Print headers + sample rows, then exit")
    ap.add_argument("--dry-run", action="store_true", help="Print payloads; do not POST")
    args = ap.parse_args()

    p = Path(args.csvfile)
    if not p.exists():
        print("CSV file not found:", p)
        return

    with open(p, newline='', encoding='utf-8', errors='ignore') as fh:
        reader = csv.DictReader(fh)
        headers = reader.fieldnames or []

        if args.inspect:
            print("Detected headers:", headers)
            for i, row in enumerate(reader):
                print({k: (row.get(k) or "")[:120] for k in headers[:8]})
                if i >= 4: break
            return

        # try to auto-map common column names
        sender_col  = detect_column(headers, ["sender","from","from_addr","fromaddress","email"])
        subject_col = detect_column(headers, ["subject","title","header","topic"])
        body_col    = detect_column(headers, ["body","content","message","text","email_body","msg"])
        label_col   = detect_column(headers, ["label","class","spam","is_spam","category"])
        urls_col    = detect_column(headers, ["urls","links","url","link"])

        print("Using columns:")
        print("  sender :", sender_col)
        print("  subject:", subject_col)
        print("  body   :", body_col)
        print("  label  :", label_col)
        print("  urls   :", urls_col)
        print()

        sent = 0
        for i, row in enumerate(reader):
            if sent >= args.limit: break

            subject = (row.get(subject_col) or "") if subject_col else ""
            sender  = (row.get(sender_col)  or "") if sender_col  else ""
            body    = (row.get(body_col)    or "") if body_col    else ""
            label   = (row.get(label_col)   or "") if label_col   else ""
            urls    = (row.get(urls_col)    or "") if urls_col    else ""

            risk    = label_to_risk(label)
            reasons = build_reasons(subject, body, urls, label, sender)

            payload = {
                "email_subject": subject[:300],
                "sender": sender[:200],
                "risk": risk,
                "reasons": reasons,
                "body": body[:2000],
            }

            if args.dry_run:
                print("[DRY]", payload)
            else:
                try:
                    r = requests.post(args.url, json=payload, timeout=10)
                    print(f"{sent+1:4d} -> {r.status_code} {risk:6s} | {payload['email_subject'][:60]}")
                except Exception as e:
                    print("Error:", e)

            sent += 1
            time.sleep(args.delay)

        print("Done. Sent", sent, "reports.")

if __name__ == "__main__":
    main()

