import os
from pathlib import Path
import joblib

_MODEL = None

# Which trained model file to load. "single" = the original single LogisticRegression
# model (phish_clf.joblib). "ensemble" = the soft-voting ensemble of LogisticRegression +
# linear SVM (SGDClassifier) + MultinomialNB (phish_clf_ensemble.joblib, built by
# ml/train_ensemble.py). Controlled by PHISHGUARD_MODEL_VARIANT so this can be switched
# without touching any call site -- default stays "single" so behavior doesn't change
# unless this is explicitly opted into.
_VARIANT_PATHS = {
    "single": "ml/models/phish_clf.joblib",
    "ensemble": "ml/models/phish_clf_ensemble.joblib",
}


def _project_root() -> Path:
    """Project root (parent of sentinel package). Works from any cwd."""
    return Path(__file__).resolve().parent.parent


def default_model_path() -> str:
    variant = os.environ.get("PHISHGUARD_MODEL_VARIANT", "single").strip().lower()
    return _VARIANT_PATHS.get(variant, _VARIANT_PATHS["single"])


def load_model(path: str = None):
    global _MODEL
    if path is None:
        path = default_model_path()
    p = Path(path)
    if not p.is_absolute():
        p = _project_root() / path
    if not p.exists():
        print("[Model] WARNING: model not found at", p)
        _MODEL = None
        return None
    _MODEL = joblib.load(p)
    print("[Model] Loaded", p)
    return _MODEL

def score_text(text: str):
    """
    Returns: dict { prob_phish: float, risk: Low/Medium/High }
    Uses calibrated thresholds for high accuracy (legit vs fraud).
    """
    global _MODEL
    if _MODEL is None:
        return {"prob_phish": 0.0, "risk": "Low"}  # fallback
    raw_prob = float(_MODEL.predict_proba([text])[0][1])
    # Stricter thresholds for fewer false positives (legit classified as phish)
    # and fewer false negatives (phish classified as legit) -> ~99% target
    if raw_prob >= 0.82:
        risk = "High"
    elif raw_prob >= 0.52:
        risk = "Medium"
    else:
        risk = "Low"
    return {"prob_phish": raw_prob, "risk": risk}