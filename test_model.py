
# ============================================================
# PETCARE AI - FINAL TEST
# Stage 1: Species classification
# Stage 2: Breed classification (5 models)
# End-to-end: Stage 1 prediction -> route to Stage 2
# ============================================================

import os
import json
import warnings
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import matplotlib.pyplot as plt

from PIL import Image
from pathlib import Path
from datetime import datetime
from torch.utils.data import Dataset, DataLoader
from torchvision import models, transforms
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    classification_report,
    confusion_matrix
)

warnings.filterwarnings("ignore", category=UserWarning)

# ---------------- CONFIG ----------------
MANIFEST_PATH = "/content/petcare_data/petcare_manifest.csv"

MODEL_ROOT = "/content/drive/MyDrive/PetCareAI_models"
STAGE1_PATH = f"{MODEL_ROOT}/stage1/efficientnet_b0_species_best.pth"
STAGE2_ROOT = f"{MODEL_ROOT}/stage2"

RESULT_DIR = f"{MODEL_ROOT}/test_results"
os.makedirs(RESULT_DIR, exist_ok=True)

SPECIES_LIST = ["dog", "cat", "bird", "rabbit", "hamster"]
BATCH_SIZE = 32
NUM_WORKERS = 0

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("Device:", DEVICE)
print("Results:", RESULT_DIR)

# ---------------- CHECK FILES ----------------
assert os.path.isfile(MANIFEST_PATH), f"Missing manifest: {MANIFEST_PATH}"
assert os.path.isfile(STAGE1_PATH), f"Missing Stage 1 checkpoint: {STAGE1_PATH}"

for species in SPECIES_LIST:
    p = f"{STAGE2_ROOT}/{species}/efficientnet_b0_{species}_best.pth"
    assert os.path.isfile(p), f"Missing Stage 2 checkpoint: {p}"

# ---------------- LOAD MANIFEST ----------------
df = pd.read_csv(MANIFEST_PATH)

required_cols = {"path", "species", "breed", "split"}
assert required_cols.issubset(df.columns), (
    f"Manifest must contain columns: {required_cols}"
)

df["species"] = df["species"].astype(str).str.lower().str.strip()
df["breed"] = df["breed"].astype(str).str.strip()
df["split"] = df["split"].astype(str).str.lower().str.strip()

test_df = df[df["split"] == "test"].copy().reset_index(drop=True)

assert len(test_df) > 0, "No test images found in manifest."
assert set(test_df["species"].unique()).issubset(set(SPECIES_LIST)), \
    "Manifest contains an unexpected species."

missing_paths = [p for p in test_df["path"] if not os.path.isfile(p)]
if missing_paths:
    raise FileNotFoundError(
        f"{len(missing_paths)} test files are missing. "
        f"Examples: {missing_paths[:5]}"
    )

print(f"\nTest images: {len(test_df)}")
print("\nTest images by species:")
print(test_df.groupby("species").size().to_string())

# ---------------- TRANSFORM ----------------
eval_transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

class PetTestDataset(Dataset):
    def __init__(self, paths):
        self.paths = list(paths)

    def __len__(self):
        return len(self.paths)

    def __getitem__(self, idx):
        path = self.paths[idx]
        try:
            image = Image.open(path).convert("RGB")
            image = eval_transform(image)
            return image, idx
        except Exception as e:
            raise RuntimeError(f"Cannot read image: {path}\n{e}")

def make_loader(paths):
    return DataLoader(
        PetTestDataset(paths),
        batch_size=BATCH_SIZE,
        shuffle=False,
        num_workers=NUM_WORKERS,
        pin_memory=(DEVICE.type == "cuda")
    )

# ---------------- CHECKPOINT HELPERS ----------------
def load_checkpoint(path):
    try:
        return torch.load(path, map_location="cpu", weights_only=True)
    except TypeError:
        return torch.load(path, map_location="cpu")

def get_state_dict(checkpoint):
    if isinstance(checkpoint, dict):
        for key in ["model_state_dict", "state_dict"]:
            if key in checkpoint:
                return checkpoint[key]
    raise ValueError("Checkpoint does not contain model_state_dict/state_dict.")

def get_linear_head_info(state_dict):
    """
    Supports EfficientNet heads saved as either:
    classifier.1.weight (Dropout + Linear)
    or classifier.weight (Linear only).
    """
    if "classifier.1.weight" in state_dict:
        weight = state_dict["classifier.1.weight"]
        return "sequential", int(weight.shape[0]), int(weight.shape[1])

    if "classifier.weight" in state_dict:
        weight = state_dict["classifier.weight"]
        return "linear", int(weight.shape[0]), int(weight.shape[1])

    raise ValueError(
        "Cannot identify classifier layer in checkpoint. "
        "Please check the model architecture used during training."
    )

def build_model(checkpoint):
    state_dict = get_state_dict(checkpoint)
    head_type, num_classes, in_features = get_linear_head_info(state_dict)

    model = models.efficientnet_b0(weights=None)

    if head_type == "sequential":
        model.classifier = nn.Sequential(
            nn.Dropout(p=0.3),
            nn.Linear(in_features, num_classes)
        )
    else:
        model.classifier = nn.Linear(in_features, num_classes)

    # Strict loading ensures the architecture matches the saved model.
    model.load_state_dict(state_dict, strict=True)
    model.to(DEVICE)
    model.eval()

    return model

def get_species_mapping(checkpoint, manifest):
    """
    Uses the saved Stage 1 class_to_idx mapping.
    Never guesses the output class order when checkpoint metadata exists.
    """
    mapping = checkpoint.get("class_to_idx")

    if mapping is None:
        mapping = checkpoint.get("species_to_idx")

    if mapping is None:
        raise KeyError(
            "Stage 1 checkpoint has no class_to_idx/species_to_idx. "
            "Do not guess the class order; inspect the checkpoint metadata."
        )

    mapping = {str(k).lower().strip(): int(v) for k, v in mapping.items()}
    idx_to_species = {v: k for k, v in mapping.items()}

    if set(idx_to_species.values()) != set(SPECIES_LIST):
        raise ValueError(
            f"Unexpected Stage 1 species mapping: {idx_to_species}"
        )

    return mapping, idx_to_species

def predict_paths(model, paths, idx_to_label):
    """Returns predicted labels and confidence for paths in the same order."""
    if len(paths) == 0:
        return [], []

    loader = make_loader(paths)
    all_indices = []
    all_preds = []
    all_conf = []

    with torch.inference_mode():
        for images, indices in loader:
            images = images.to(DEVICE, non_blocking=True)
            logits = model(images)
            probs = torch.softmax(logits, dim=1)
            confidence, pred_idx = probs.max(dim=1)

            all_indices.extend(indices.numpy().tolist())
            all_preds.extend(pred_idx.cpu().numpy().tolist())
            all_conf.extend(confidence.cpu().numpy().tolist())

    # Restore original order even if loader behavior changes.
    order = np.argsort(all_indices)
    all_preds = [all_preds[i] for i in order]
    all_conf = [all_conf[i] for i in order]

    labels = [idx_to_label[int(i)] for i in all_preds]
    return labels, all_conf

def calculate_metrics(y_true, y_pred):
    p, r, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average="macro", zero_division=0
    )
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "macro_precision": float(p),
        "macro_recall": float(r),
        "macro_f1": float(f1)
    }

def save_confusion(y_true, y_pred, labels, prefix, title):
    cm = confusion_matrix(y_true, y_pred, labels=labels)

    pd.DataFrame(
        cm, index=labels, columns=labels
    ).to_csv(f"{prefix}_confusion_matrix.csv", encoding="utf-8-sig")

    fig_size = max(7, min(18, len(labels) * 0.55))
    fig, ax = plt.subplots(figsize=(fig_size, fig_size))
    im = ax.imshow(cm, interpolation="nearest")
    ax.set_title(title)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_xticks(range(len(labels)))
    ax.set_yticks(range(len(labels)))
    ax.set_xticklabels(labels, rotation=90, fontsize=8)
    ax.set_yticklabels(labels, fontsize=8)
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(f"{prefix}_confusion_matrix.png", dpi=180)
    plt.close(fig)

    return cm

# ============================================================
# 1. TEST STAGE 1 - SPECIES CLASSIFICATION
# ============================================================
print("\n" + "=" * 65)
print("1. TEST STAGE 1: SPECIES CLASSIFICATION")
print("=" * 65)

stage1_ckpt = load_checkpoint(STAGE1_PATH)
species_to_idx, idx_to_species = get_species_mapping(stage1_ckpt, df)
stage1_model = build_model(stage1_ckpt)

stage1_true = test_df["species"].tolist()
stage1_pred, stage1_conf = predict_paths(
    stage1_model,
    test_df["path"].tolist(),
    idx_to_species
)

stage1_metrics = calculate_metrics(stage1_true, stage1_pred)

stage1_labels = [idx_to_species[i] for i in sorted(idx_to_species)]
stage1_report = classification_report(
    stage1_true,
    stage1_pred,
    labels=stage1_labels,
    output_dict=True,
    zero_division=0
)

pd.DataFrame(stage1_report).transpose().to_csv(
    f"{RESULT_DIR}/stage1_classification_report.csv",
    encoding="utf-8-sig"
)

save_confusion(
    stage1_true,
    stage1_pred,
    stage1_labels,
    f"{RESULT_DIR}/stage1",
    "Stage 1 - Species Confusion Matrix"
)

print("Stage 1 metrics:")
for k, v in stage1_metrics.items():
    print(f"  {k}: {v:.6f}")

# ============================================================
# 2. TEST EACH STAGE 2 MODEL ON ITS TRUE SPECIES TEST IMAGES
# ============================================================
print("\n" + "=" * 65)
print("2. TEST STAGE 2: EACH BREED MODEL")
print("=" * 65)

stage2_metrics = {}
stage2_predictions = {}
stage2_models = {}
stage2_label_maps = {}

for species in SPECIES_LIST:
    print(f"\nTesting {species} model...")

    ckpt_path = (
        f"{STAGE2_ROOT}/{species}/"
        f"efficientnet_b0_{species}_best.pth"
    )
    ckpt = load_checkpoint(ckpt_path)

    if str(ckpt.get("species", species)).lower() != species:
        raise ValueError(
            f"Checkpoint species mismatch: expected {species}, "
            f"got {ckpt.get('species')}"
        )

    breed_to_idx = ckpt.get("breed_to_idx")
    if breed_to_idx is None:
        raise KeyError(f"{species} checkpoint has no breed_to_idx mapping.")

    breed_to_idx = {str(k): int(v) for k, v in breed_to_idx.items()}
    idx_to_breed = {v: k for k, v in breed_to_idx.items()}

    if sorted(idx_to_breed.keys()) != list(range(len(idx_to_breed))):
        raise ValueError(f"Non-contiguous breed indices in {species} mapping.")

    # Confirm checkpoint class labels agree with manifest labels.
    manifest_breeds = set(
        df.loc[df["species"] == species, "breed"].unique()
    )
    checkpoint_breeds = set(idx_to_breed.values())

    if manifest_breeds != checkpoint_breeds:
        raise ValueError(
            f"Breed mapping mismatch for {species}.\n"
            f"Manifest only/checkpoint missing: {manifest_breeds - checkpoint_breeds}\n"
            f"Checkpoint only/manifest missing: {checkpoint_breeds - manifest_breeds}"
        )

    model = build_model(ckpt)
    stage2_models[species] = model
    stage2_label_maps[species] = idx_to_breed

    subset = test_df[test_df["species"] == species].copy().reset_index(drop=True)

    y_true = subset["breed"].tolist()
    y_pred, confidence = predict_paths(
        model,
        subset["path"].tolist(),
        idx_to_breed
    )

    metrics = calculate_metrics(y_true, y_pred)
    stage2_metrics[species] = {
        "species": species,
        "num_breeds": len(idx_to_breed),
        "test_images": len(subset),
        **metrics
    }

    report = classification_report(
        y_true,
        y_pred,
        labels=[idx_to_breed[i] for i in sorted(idx_to_breed)],
        output_dict=True,
        zero_division=0
    )

    pd.DataFrame(report).transpose().to_csv(
        f"{RESULT_DIR}/stage2_{species}_classification_report.csv",
        encoding="utf-8-sig"
    )

    save_confusion(
        y_true,
        y_pred,
        [idx_to_breed[i] for i in sorted(idx_to_breed)],
        f"{RESULT_DIR}/stage2_{species}",
        f"Stage 2 - {species.title()} Breed Confusion Matrix"
    )

    stage2_predictions[species] = {
        "paths": subset["path"].tolist(),
        "true_breeds": y_true,
        "pred_breeds": y_pred,
        "confidence": confidence
    }

    print(
        f"  Images: {len(subset)} | "
        f"Accuracy: {metrics['accuracy']:.4%} | "
        f"Macro F1: {metrics['macro_f1']:.6f}"
    )

# ============================================================
# 3. END-TO-END TEST
# Stage 1 predicted species selects the Stage 2 model.
# ============================================================
print("\n" + "=" * 65)
print("3. END-TO-END TEST: STAGE 1 -> STAGE 2")
print("=" * 65)

e2e_rows = []

for i, row in test_df.iterrows():
    true_species = row["species"]
    true_breed = row["breed"]
    predicted_species = stage1_pred[i]
    species_confidence = stage1_conf[i]

    # Route using predicted species, not the ground-truth species.
    model = stage2_models[predicted_species]
    idx_to_breed = stage2_label_maps[predicted_species]

    predicted_breed_list, breed_confidence_list = predict_paths(
        model,
        [row["path"]],
        idx_to_breed
    )
    predicted_breed = predicted_breed_list[0]
    breed_confidence = breed_confidence_list[0]

    exact_correct = (
        predicted_species == true_species
        and predicted_breed == true_breed
    )

    e2e_rows.append({
        "path": row["path"],
        "true_species": true_species,
        "predicted_species": predicted_species,
        "species_confidence": species_confidence,
        "true_breed": true_breed,
        "predicted_breed": predicted_breed,
        "breed_confidence": breed_confidence,
        "species_correct": predicted_species == true_species,
        "breed_correct_given_true_species": (
            predicted_breed == true_breed
            if predicted_species == true_species
            else False
        ),
        "exact_correct": exact_correct
    })

e2e_df = pd.DataFrame(e2e_rows)
e2e_df.to_csv(
    f"{RESULT_DIR}/end_to_end_predictions.csv",
    index=False,
    encoding="utf-8-sig"
)

e2e_species_accuracy = accuracy_score(
    e2e_df["true_species"],
    e2e_df["predicted_species"]
)
e2e_exact_accuracy = float(e2e_df["exact_correct"].mean())

correct_species_df = e2e_df[
    e2e_df["true_species"] == e2e_df["predicted_species"]
]
if len(correct_species_df) > 0:
    breed_acc_when_species_correct = float(
        (
            correct_species_df["true_breed"]
            == correct_species_df["predicted_breed"]
        ).mean()
    )
else:
    breed_acc_when_species_correct = 0.0

# Combined labels preserve species + breed identity.
all_pairs = sorted({
    f"{r.species}::{r.breed}" for r in df.itertuples()
})
e2e_true_labels = (
    e2e_df["true_species"] + "::" + e2e_df["true_breed"]
).tolist()
e2e_pred_labels = (
    e2e_df["predicted_species"] + "::" + e2e_df["predicted_breed"]
).tolist()

e2e_report = classification_report(
    e2e_true_labels,
    e2e_pred_labels,
    labels=all_pairs,
    output_dict=True,
    zero_division=0
)
pd.DataFrame(e2e_report).transpose().to_csv(
    f"{RESULT_DIR}/end_to_end_classification_report.csv",
    encoding="utf-8-sig"
)

save_confusion(
    e2e_true_labels,
    e2e_pred_labels,
    all_pairs,
    f"{RESULT_DIR}/end_to_end",
    "End-to-End Species + Breed Confusion Matrix"
)

# ============================================================
# 4. SAVE ALL METRICS
# ============================================================
summary_rows = [{
    "model": "Stage 1 - Species",
    "test_images": len(test_df),
    **stage1_metrics
}]

for species in SPECIES_LIST:
    m = stage2_metrics[species]
    summary_rows.append({
        "model": f"Stage 2 - {species}",
        "test_images": m["test_images"],
        "accuracy": m["accuracy"],
        "macro_precision": m["macro_precision"],
        "macro_recall": m["macro_recall"],
        "macro_f1": m["macro_f1"]
    })

summary_rows.append({
    "model": "End-to-End - Exact Species + Breed",
    "test_images": len(test_df),
    "accuracy": e2e_exact_accuracy,
    "macro_precision": np.nan,
    "macro_recall": np.nan,
    "macro_f1": np.nan
})

summary_df = pd.DataFrame(summary_rows)
summary_df.to_csv(
    f"{RESULT_DIR}/test_metrics_summary.csv",
    index=False,
    encoding="utf-8-sig"
)

final_results = {
    "evaluated_at": datetime.now().isoformat(timespec="seconds"),
    "device": str(DEVICE),
    "test_images": int(len(test_df)),
    "stage1": stage1_metrics,
    "stage2": stage2_metrics,
    "end_to_end": {
        "species_accuracy": float(e2e_species_accuracy),
        "breed_accuracy_when_species_correct": float(
            breed_acc_when_species_correct
        ),
        "exact_species_and_breed_accuracy": float(e2e_exact_accuracy),
        "correct_exact_predictions": int(e2e_df["exact_correct"].sum()),
        "total_test_images": int(len(e2e_df))
    },
    "notes": [
        "Test split was used for evaluation only.",
        "Stage 2 per-species metrics use the ground-truth species to select the model.",
        "End-to-end evaluation routes each image using the predicted Stage 1 species.",
        "Exact correctness requires both species and breed to be correct."
    ]
}

with open(f"{RESULT_DIR}/final_test_results.json", "w", encoding="utf-8") as f:
    json.dump(final_results, f, ensure_ascii=False, indent=2)

print("\n" + "=" * 65)
print("FINAL TEST SUMMARY")
print("=" * 65)
print(summary_df.to_string(index=False))

print("\nEnd-to-end:")
print(f"  Species accuracy: {e2e_species_accuracy:.4%}")
print(
    "  Breed accuracy when species is correct: "
    f"{breed_acc_when_species_correct:.4%}"
)
print(
    "  Exact species + breed accuracy: "
    f"{e2e_exact_accuracy:.4%} "
    f"({int(e2e_df['exact_correct'].sum())}/{len(e2e_df)})"
)

print("\nAll results saved to:")
print(RESULT_DIR)
print("\nKey files:")
print(" - test_metrics_summary.csv")
print(" - final_test_results.json")
print(" - end_to_end_predictions.csv")
print(" - stage1_classification_report.csv")
print(" - stage1_confusion_matrix.png / .csv")
print(" - stage2_<species>_classification_report.csv")
print(" - stage2_<species>_confusion_matrix.png / .csv")
print(" - end_to_end_classification_report.csv")
print(" - end_to_end_confusion_matrix.png / .csv")
