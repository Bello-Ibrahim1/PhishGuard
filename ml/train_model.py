"""
Train PhishGuard classifier.
Uses LightGBM + TF-IDF (word + char n-grams) + structural features for high accuracy.
Structural features capture patterns the language model misses:
  URL count, uppercase ratio, punctuation density, text length, HTML presence, etc.
"""
import argparse
import re
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
import json
import scipy.sparse as sp
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import FeatureUnion
from sklearn.metrics import (
    classification_report, roc_auc_score,
    accuracy_score, precision_score, recall_score, f1_score,
)
from lightgbm import LGBMClassifier

_URL_RE = re.compile(r'https?://\S+', re.I)
_IP_RE = re.compile(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b')
_HTML_RE = re.compile(r'<[a-z][^>]*>', re.I)
_SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "goo.gl", "rb.gy", "ow.ly", "is.gd", "cutt.ly"}


def structural_features(texts: list) -> np.ndarray:
    """
    Extract numerical features that capture email structure and style.
    Returns shape (n_samples, n_features).
    """
    rows = []
    for t in texts:
        t = t or ""
        words = t.split()
        n_chars = len(t)
        n_words = len(words) or 1
        urls = _URL_RE.findall(t)
        n_urls = len(urls)
        n_shortener = sum(1 for u in urls if any(s in u for s in _SHORTENERS))
        n_ip = len(_IP_RE.findall(t))
        n_html = len(_HTML_RE.findall(t))
        upper_ratio = sum(1 for c in t if c.isupper()) / max(n_chars, 1)
        exclaim = t.count("!")
        question = t.count("?")
        dollar = t.count("$")
        avg_word_len = sum(len(w) for w in words) / n_words
        # All-caps words (URGENT, VERIFY, etc.)
        n_allcaps = sum(1 for w in words if len(w) > 2 and w.isupper())
        rows.append([
            n_chars,
            n_words,
            n_urls,
            n_shortener,
            n_ip,
            n_html,
            upper_ratio,
            exclaim,
            question,
            dollar,
            avg_word_len,
            n_allcaps,
        ])
    return np.array(rows, dtype=np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="ml/processed/train.csv")
    ap.add_argument("--outdir", default="ml/models")
    args = ap.parse_args()

    df = pd.read_csv(args.data)
    X_text = df["text"].astype(str).tolist()
    y = df["label"].astype(int).values

    X_tr_txt, X_te_txt, y_tr, y_te = train_test_split(
        X_text, y, test_size=0.2, random_state=42, stratify=y
    )

    # --- TF-IDF features ---
    word_tfidf = TfidfVectorizer(
        lowercase=True, ngram_range=(1, 3), max_features=80000,
        min_df=2, max_df=0.95, sublinear_tf=True,
        strip_accents="unicode", analyzer="word",
    )
    char_tfidf = TfidfVectorizer(
        lowercase=True, ngram_range=(3, 5), max_features=40000,
        min_df=2, max_df=0.95, sublinear_tf=True, analyzer="char_wb",
    )
    tfidf = FeatureUnion([("word", word_tfidf), ("char", char_tfidf)])
    X_tr_tfidf = tfidf.fit_transform(X_tr_txt)
    X_te_tfidf = tfidf.transform(X_te_txt)

    # --- Structural features ---
    X_tr_struct = structural_features(X_tr_txt)
    X_te_struct = structural_features(X_te_txt)

    # --- Combine ---
    X_tr = sp.hstack([X_tr_tfidf, sp.csr_matrix(X_tr_struct)])
    X_te = sp.hstack([X_te_tfidf, sp.csr_matrix(X_te_struct)])

    # --- LightGBM ---
    clf = LGBMClassifier(
        n_estimators=400,
        learning_rate=0.05,
        num_leaves=63,
        class_weight="balanced",
        n_jobs=-1,
        random_state=42,
        verbose=-1,
    )
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        clf.fit(X_tr, y_tr)
        preds = clf.predict(X_te)
        probs = clf.predict_proba(X_te)[:, 1]

    auc = roc_auc_score(y_te, probs)
    acc = accuracy_score(y_te, preds)
    prec = precision_score(y_te, preds, zero_division=0)
    rec = recall_score(y_te, preds, zero_division=0)
    f1 = f1_score(y_te, preds, zero_division=0)
    report = classification_report(y_te, preds, output_dict=True)

    Path(args.outdir).mkdir(parents=True, exist_ok=True)
    # Save the full pipeline: vectorizer + classifier together
    joblib.dump({"tfidf": tfidf, "clf": clf}, Path(args.outdir) / "phish_clf.joblib")

    metrics = {
        "model": "LightGBM",
        "samples_train": len(X_tr_txt),
        "samples_test": len(X_te_txt),
        "auc": auc, "accuracy": acc,
        "precision": prec, "recall": rec, "f1": f1,
        "precision_recall_f1": report,
    }
    with open(Path(args.outdir) / "metrics.json", "w") as mf:
        json.dump(metrics, mf, indent=2)

    print("Saved model  =>", Path(args.outdir) / "phish_clf.joblib")
    print("Saved metrics =>", Path(args.outdir) / "metrics.json")
    print(f"AUC: {auc:.4f} | Accuracy: {acc:.4f} | Precision: {prec:.4f} | Recall: {rec:.4f} | F1: {f1:.4f}")


if __name__ == "__main__":
    main()
