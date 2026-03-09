from pathlib import Path
import joblib

_MODEL = None

def _project_root() -> Path:
    """Project root (parent of sentinel package). Works from any cwd."""
    return Path(__file__).resolve().parent.parent

def load_model(path: str = "ml/models/phish_clf.joblib"):
    global _MODEL
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