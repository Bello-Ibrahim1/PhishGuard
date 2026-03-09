import argparse
import pandas as pd
from pathlib import Path

def pick(colnames, candidates):
    # exact or fuzzy match
    low = {c.lower(): c for c in colnames}
    for c in candidates:
        if c in low:
            return low[c]
    for c in candidates:
        for k in colnames:
            if c in k.lower():
                return k
    return None

def load_one(path):
    try:
        df = pd.read_csv(path, encoding="utf-8", engine="python", on_bad_lines="skip")
    except TypeError:
        # older pandas fallback (on_bad_lines not available)
        df = pd.read_csv(path, encoding="utf-8", engine="python")
    except UnicodeDecodeError:
        # encoding fallback
        try:
            df = pd.read_csv(path, encoding="latin-1", engine="python", on_bad_lines="skip")
        except TypeError:
            df = pd.read_csv(path, encoding="latin-1", engine="python")
    cols = list(df.columns)
    sender = pick(cols, ["sender", "from", "from_addr", "fromaddress", "email"])
    subject = pick(cols, ["subject", "title", "header", "topic"])
    body = pick(cols, ["body", "content", "message", "text", "email_body", "msg"])
    label = pick(cols, ["label", "class", "spam", "is_spam", "category", "phishing"])

    if subject is None and body is None:
        raise ValueError(f"Could not find subject/body in {path}")

    # build text (subject + body)
    s = df[subject].astype(str) if subject else ""
    b = df[body].astype(str) if body else ""
    text = (s + " " + b).str.replace(r"\s+", " ", regex=True).str.strip()

    # map label to y (1=phish, 0=legit)
    y_raw = df[label] if label else pd.Series(["0"] * len(df))
    def map_label(v):
        v = str(v).lower().strip()
        if v in ("1","phish","phishing","spam","fraud","malicious","scam"):
            return 1
        if v.replace(".", "", 1).isdigit():  # prob or 0/1 float
            try:
                p = float(v)
                return 1 if p >= 0.5 else 0
            except:
                pass
        return 0
    y = y_raw.map(map_label)

    out = pd.DataFrame({"text": text.fillna(""), "label": y})
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--inputs", nargs="+", required=True, help="CSV files under datasets/")
    ap.add_argument("--out", default="ml/processed/train.csv")
    args = ap.parse_args()

    all_dfs = []
    for inp in args.inputs:
        p = Path(inp)
        if not p.exists():
            p = Path("datasets") / inp
        print("Reading:", p)
        all_dfs.append(load_one(p))
    big = pd.concat(all_dfs, ignore_index=True)
    big = big.dropna(subset=["text"]).drop_duplicates(subset=["text"])
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    big.to_csv(args.out, index=False)
    print("Wrote:", args.out, "rows:", len(big))

if __name__ == "__main__":
    main()