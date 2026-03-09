"""
Train PhishGuard classifier for high accuracy (~99% target).
Uses word + character n-grams (wording), class balancing, and probability calibration
to better separate legitimate vs fraudulent/malicious emails.
"""
import argparse
from pathlib import Path
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline, FeatureUnion
from sklearn.preprocessing import MaxAbsScaler
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import classification_report, roc_auc_score, accuracy_score, precision_score, recall_score, f1_score
import joblib
import json

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="ml/processed/train.csv")
    ap.add_argument("--outdir", default="ml/models")
    ap.add_argument("--calibrate", action="store_true", default=True, help="Use CalibratedClassifierCV for reliable probabilities")
    args = ap.parse_args()

    df = pd.read_csv(args.data)
    X = df["text"].astype(str).values
    y = df["label"].astype(int).values

    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    # Word n-grams (1-3): phrasing, "verify account", "click here", etc.
    word_tfidf = TfidfVectorizer(
        lowercase=True,
        ngram_range=(1, 3),
        max_features=80000,
        min_df=2,
        max_df=0.95,
        sublinear_tf=True,
        strip_accents="unicode",
        analyzer="word",
    )
    # Character n-grams (3-5): obfuscation, weird spellings, typos common in phish
    char_tfidf = TfidfVectorizer(
        lowercase=True,
        ngram_range=(3, 5),
        max_features=40000,
        min_df=2,
        max_df=0.95,
        sublinear_tf=True,
        analyzer="char_wb",
    )
    features = FeatureUnion([
        ("word", word_tfidf),
        ("char", char_tfidf),
    ])
    base_clf = LogisticRegression(
        max_iter=500,
        n_jobs=-1,
        class_weight="balanced",  # handle imbalanced legit vs phish
        C=0.5,
        solver="lbfgs",
    )
    if args.calibrate:
        # Calibrated probabilities so API thresholds (0.52, 0.82) are reliable
        clf = CalibratedClassifierCV(base_clf, method="isotonic", cv=3)
    else:
        clf = base_clf

    pipe = Pipeline([
        ("tfidf", features),
        ("scale", MaxAbsScaler()),  # keeps values bounded, avoids numerical warnings
        ("clf", clf),
    ])

    pipe.fit(Xtr, ytr)
    preds = pipe.predict(Xte)
    probs = pipe.predict_proba(Xte)[:, 1]

    report = classification_report(yte, preds, output_dict=True)
    auc = roc_auc_score(yte, probs)
    acc = accuracy_score(yte, preds)
    prec = precision_score(yte, preds, zero_division=0)
    rec = recall_score(yte, preds, zero_division=0)
    f1 = f1_score(yte, preds, zero_division=0)

    Path(args.outdir).mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, Path(args.outdir) / "phish_clf.joblib")

    metrics = {
        "samples_train": len(Xtr),
        "samples_test": len(Xte),
        "auc": auc,
        "accuracy": acc,
        "precision": prec,
        "recall": rec,
        "f1": f1,
        "precision_recall_f1": report,
    }

    with open(Path(args.outdir) / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    print("Saved model =>", Path(args.outdir) / "phish_clf.joblib")
    print("Saved metrics =>", Path(args.outdir) / "metrics.json")
    print("AUC:", round(auc, 4), "| Accuracy:", round(acc, 4), "| Precision:", round(prec, 4), "| Recall:", round(rec, 4), "| F1:", round(f1, 4))

if __name__ == "__main__":
    main()
