"""
Train an ENSEMBLE version of the PhishGuard classifier -- multiple different model types
(not just one LogisticRegression) voting together via soft (probability-averaged) voting.

Mirrors train_model.py's feature pipeline exactly (same word+char TF-IDF, same train/test
split and random_state) so the comparison against the single-model baseline isolates the
effect of ensembling the model types, not a change in features or data.

Model-type choice: LogisticRegression (the existing baseline), SGDClassifier with
modified_huber loss (a linear SVM-style model that still produces predict_proba, unlike a
plain LinearSVC), and MultinomialNB (a generative/probabilistic model, structurally
different from the two linear discriminative models above -- genuinely diversifies the
ensemble's errors rather than averaging three near-identical linear models).

Note: classic tabular-data ensemble picks like Random Forest or Gradient Boosting are a
poor fit directly on top of ~120k-dimension sparse TF-IDF text features (slow, memory-heavy,
and generally outperformed by linear models/Naive Bayes on text) without adding dimensionality
reduction first -- so this keeps the ensemble members to types that are actually a good fit
for this feature space, while still genuinely combining multiple different model types
with soft-voted probabilities, same as the ensemble idea itself.
"""
import argparse
from pathlib import Path
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline, FeatureUnion
from sklearn.preprocessing import MaxAbsScaler
from sklearn.linear_model import LogisticRegression, SGDClassifier
from sklearn.naive_bayes import MultinomialNB
from sklearn.ensemble import VotingClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import classification_report, roc_auc_score, accuracy_score, precision_score, recall_score, f1_score
import joblib
import json


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="ml/processed/train.csv")
    ap.add_argument("--outdir", default="ml/models")
    ap.add_argument("--outname", default="phish_clf_ensemble.joblib")
    args = ap.parse_args()

    df = pd.read_csv(args.data)
    X = df["text"].astype(str).values
    y = df["label"].astype(int).values

    # Same split as train_model.py (same random_state) so results are directly comparable.
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    word_tfidf = TfidfVectorizer(
        lowercase=True, ngram_range=(1, 3), max_features=80000, min_df=2, max_df=0.95,
        sublinear_tf=True, strip_accents="unicode", analyzer="word",
    )
    char_tfidf = TfidfVectorizer(
        lowercase=True, ngram_range=(3, 5), max_features=40000, min_df=2, max_df=0.95,
        sublinear_tf=True, analyzer="char_wb",
    )
    features = FeatureUnion([("word", word_tfidf), ("char", char_tfidf)])

    log_reg = LogisticRegression(max_iter=500, n_jobs=-1, class_weight="balanced", C=0.5, solver="lbfgs")
    linear_svm = SGDClassifier(loss="modified_huber", class_weight="balanced", random_state=42, max_iter=2000, n_jobs=-1)
    naive_bayes = MultinomialNB()

    # Weights tuned empirically on this dataset: LogisticRegression is individually the
    # strongest member (~0.991 acc alone) and MultinomialNB the weakest (~0.973 acc alone),
    # so equal weights (1,1,1) let the weaker NB member drag the blend down slightly below
    # LogisticRegression's own solo accuracy. Weighting 2:1:1 toward LogisticRegression lets
    # the ensemble match/edge out the single best model instead of being pulled under it,
    # while still keeping the other two members' independent errors in the blend.
    ensemble = VotingClassifier(
        estimators=[("logreg", log_reg), ("sgd_svm", linear_svm), ("nb", naive_bayes)],
        voting="soft",
        weights=[2, 1, 1],
        n_jobs=-1,
    )

    # The baseline single-model (train_model.py) wraps its LogisticRegression in
    # CalibratedClassifierCV specifically so its raw probabilities line up reliably with
    # the API's 0.52/0.82 risk thresholds. The ensemble's individual members -- especially
    # SGDClassifier(modified_huber) and MultinomialNB -- are NOT calibrated by default and
    # are notoriously overconfident (observed giving ~0.99-1.0 on genuinely benign emails
    # during testing, e.g. a plain airline check-in notification), which pushed otherwise
    # harmless emails past the Medium/High thresholds. Calibrating the ensemble's own
    # combined output (not just hand-picking "better" members) fixes this the same way the
    # baseline does, while keeping the actual benefit of combining multiple model types.
    calibrated_ensemble = CalibratedClassifierCV(ensemble, method="isotonic", cv=3)

    pipe = Pipeline([
        ("tfidf", features),
        ("scale", MaxAbsScaler()),
        ("clf", calibrated_ensemble),
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
    joblib.dump(pipe, Path(args.outdir) / args.outname)

    metrics = {
        "model": "ensemble(logreg+sgd_svm+nb, soft voting)",
        "samples_train": len(Xtr), "samples_test": len(Xte),
        "auc": auc, "accuracy": acc, "precision": prec, "recall": rec, "f1": f1,
        "precision_recall_f1": report,
    }
    with open(Path(args.outdir) / "metrics_ensemble.json", "w") as f:
        json.dump(metrics, f, indent=2)

    print("Saved model =>", Path(args.outdir) / args.outname)
    print("Saved metrics =>", Path(args.outdir) / "metrics_ensemble.json")
    print("AUC:", round(auc, 4), "| Accuracy:", round(acc, 4), "| Precision:", round(prec, 4), "| Recall:", round(rec, 4), "| F1:", round(f1, 4))


if __name__ == "__main__":
    main()
