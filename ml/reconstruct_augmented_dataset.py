"""
Reconstructs the actual training dataset the currently-deployed model (ml/models/phish_clf.joblib)
was trained on.

Why this exists: ml/processed/ is gitignored, but ml/processed/train.csv was force-committed at
some point and is still tracked -- however, a LATER, larger file (train_augmented2.csv, built by
concatenating train.csv with both rounds of synthetic augmentation below and de-duplicating) is
what the deployed model was actually trained on, and that file was never committed. Without it,
retraining from a fresh clone silently uses a smaller, non-augmented dataset and can reintroduce
false positives the augmentation rounds specifically fixed (confirmed firsthand: a fresh retrain
on train.csv alone flagged a plain Delta Air Lines check-in email and an NYT newsletter as
Medium risk; retraining on this reconstructed file scores both correctly as Low, matching the
deployed model).

Run this before ml/train_model.py or ml/train_ensemble.py if you want results that match (or
fairly compare against) the deployed model:

    python3 ml/reconstruct_augmented_dataset.py
    python3 ml/train_model.py --data ml/processed/train_augmented2.csv
    python3 ml/train_ensemble.py --data ml/processed/train_augmented2.csv

Row count is deterministic given the same inputs (concat + drop_duplicates on "text"); as of this
script's writing it reproduces exactly 34601 rows, matching ml/models/metrics.json's
samples_train + samples_test (27680 + 6921).
"""
import pandas as pd
from pathlib import Path


def main():
    root = Path(__file__).resolve().parent
    base = pd.read_csv(root / "processed" / "train.csv")
    aug1 = pd.read_csv(root / "augment_synthetic.csv")
    aug2 = pd.read_csv(root / "augment_synthetic_2.csv")

    combined = pd.concat([base, aug1, aug2], ignore_index=True)
    combined = combined.dropna(subset=["text"]).drop_duplicates(subset=["text"])

    out_path = root / "processed" / "train_augmented2.csv"
    combined.to_csv(out_path, index=False)
    print(f"Wrote {out_path} -- {len(combined)} rows, label counts: {combined['label'].value_counts().to_dict()}")


if __name__ == "__main__":
    main()
