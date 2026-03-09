import warnings
from pathlib import Path
import re
import numpy as np
import scipy.sparse as sp
import joblib

_MODEL = None

_URL_RE = re.compile(r'https?://\S+', re.I)
_IP_RE = re.compile(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b')
_HTML_RE = re.compile(r'<[a-z][^>]*>', re.I)
_SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "goo.gl", "rb.gy", "ow.ly", "is.gd", "cutt.ly"}


def _project_root() -> Path:
    return Path(__file__).resolve().parent.parent


def _structural(text: str) -> np.ndarray:
    """Extract structural features from a single email text."""
    t = text or ""
    words = t.split()
    n_chars = len(t)
    n_words = len(words) or 1
    urls = _URL_RE.findall(t)
    rows = [[
        n_chars,
        n_words,
        len(urls),
        sum(1 for u in urls if any(s in u for s in _SHORTENERS)),
        len(_IP_RE.findall(t)),
        len(_HTML_RE.findall(t)),
        sum(1 for c in t if c.isupper()) / max(n_chars, 1),
        t.count("!"),
        t.count("?"),
        t.count("$"),
        sum(len(w) for w in words) / n_words,
        sum(1 for w in words if len(w) > 2 and w.isupper()),
    ]]
    return np.array(rows, dtype=np.float32)


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


def score_text(text: str) -> dict:
    """
    Returns: dict { prob_phish: float, risk: Low/Medium/High }
    Supports both legacy Pipeline models and new dict {"tfidf": ..., "clf": ...} format.
    """
    global _MODEL
    if _MODEL is None:
        return {"prob_phish": 0.0, "risk": "Low"}

    # New LightGBM format: dict with separate tfidf and clf
    if isinstance(_MODEL, dict) and "tfidf" in _MODEL:
        tfidf = _MODEL["tfidf"]
        clf = _MODEL["clf"]
        x_tfidf = tfidf.transform([text])
        x_struct = sp.csr_matrix(_structural(text))
        X = sp.hstack([x_tfidf, x_struct])
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            raw_prob = float(clf.predict_proba(X)[0][1])
    else:
        # Legacy sklearn Pipeline
        raw_prob = float(_MODEL.predict_proba([text])[0][1])

    if raw_prob >= 0.82:
        risk = "High"
    elif raw_prob >= 0.52:
        risk = "Medium"
    else:
        risk = "Low"
    return {"prob_phish": raw_prob, "risk": risk}
