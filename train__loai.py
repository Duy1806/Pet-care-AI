
# ============================================================
# DACN2 - PET CARE AI
# STAGE 1: 5-SPECIES CLASSIFICATION WITH EFFICIENTNET-B0
# Train / Validation / Test = 70% / 15% / 15%
# ============================================================
# sửa dường dẫn dataset và lưu model trước khi thực hiện train lại

import os
import json
import random
import copy
import time
import platform
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from PIL import Image, ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = False

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms, models

from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    classification_report,
    confusion_matrix
)

# ============================================================
# 1. CONFIGURATION
# ============================================================

SEED = 42
IMG_SIZE = 224
BATCH_SIZE = 32
EPOCHS = 15
PATIENCE = 4
NUM_WORKERS = 2

BACKBONE_LR = 1e-4
CLASSIFIER_LR = 1e-3
WEIGHT_DECAY = 1e-4
DROPOUT = 0.3

MANIFEST_PATH = Path(
    "/content/petcare_data/petcare_manifest.csv"
)

SAVE_DIR = Path(
    "/content/drive/MyDrive/PetCareAI_models/stage1"
)
SAVE_DIR.mkdir(parents=True, exist_ok=True)

# Seed để tăng khả năng tái lập kết quả
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)

if torch.cuda.is_available():
    torch.cuda.manual_seed_all(SEED)

torch.backends.cudnn.benchmark = True

device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

print("=" * 65)
print("PET CARE AI - STAGE 1 TRAINING")
print("=" * 65)
print("Device:", device)

if device.type == "cuda":
    print("GPU:", torch.cuda.get_device_name(0))
else:
    raise RuntimeError(
        "Chưa bật GPU! Vào Runtime > Change runtime type > GPU."
    )

if not MANIFEST_PATH.is_file():
    raise FileNotFoundError(
        f"Không tìm thấy manifest: {MANIFEST_PATH}"
    )

# ============================================================
# 2. LOAD AND VALIDATE MANIFEST
# ============================================================

df = pd.read_csv(MANIFEST_PATH)

required_columns = {"path", "species", "breed", "split"}

if not required_columns.issubset(df.columns):
    raise ValueError(
        f"Manifest thiếu cột: {required_columns - set(df.columns)}"
    )

if df["path"].duplicated().any():
    raise ValueError("Manifest có đường dẫn ảnh trùng lặp.")

if df[["path", "species", "breed", "split"]].isnull().any().any():
    raise ValueError("Manifest có trường bị thiếu.")

expected_species = {"bird", "cat", "dog", "hamster", "rabbit"}
actual_species = set(df["species"].unique())

if actual_species != expected_species:
    raise ValueError(
        f"Không đúng 5 loài mong muốn: {actual_species}"
    )

if set(df["split"].unique()) != {"train", "val", "test"}:
    raise ValueError("Manifest phải có train, val và test.")

# Kiểm tra mỗi giống chỉ thuộc về một loài
breed_species_counts = df.groupby("breed")["species"].nunique()

if (breed_species_counts > 1).any():
    raise ValueError("Có tên giống được gán cho nhiều loài.")

# Kiểm tra ảnh có tồn tại
missing_paths = [
    p for p in df["path"].tolist()
    if not os.path.isfile(p)
]

if missing_paths:
    raise FileNotFoundError(
        f"Thiếu {len(missing_paths)} ảnh. Ví dụ: {missing_paths[:5]}"
    )

# Kiểm tra không có đường dẫn trùng giữa các tập
path_split_counts = df.groupby("path")["split"].nunique()

if (path_split_counts > 1).any():
    raise ValueError("Có ảnh bị rò rỉ giữa train/val/test.")

species_names = sorted(actual_species)
species_to_idx = {
    name: index for index, name in enumerate(species_names)
}
idx_to_species = {
    index: name for name, index in species_to_idx.items()
}

# Chỉ dùng train và validation trong quá trình chọn mô hình
train_df = df[df["split"] == "train"].reset_index(drop=True)
val_df = df[df["split"] == "val"].reset_index(drop=True)

print("\nDataset overview:")
print("Total images:", len(df))
print("Train:", len(train_df))
print("Validation:", len(val_df))
print("Test: giữ riêng, chưa sử dụng")
print("Species mapping:", species_to_idx)

print("\nẢnh theo loài và tập:")
print(pd.crosstab(df["species"], df["split"]))

# Lưu cấu hình
config = {
    "seed": SEED,
    "input_size": IMG_SIZE,
    "batch_size": BATCH_SIZE,
    "max_epochs": EPOCHS,
    "early_stopping_patience": PATIENCE,
    "backbone": "EfficientNet-B0",
    "pretrained": "ImageNet",
    "dropout": DROPOUT,
    "backbone_lr": BACKBONE_LR,
    "classifier_lr": CLASSIFIER_LR,
    "weight_decay": WEIGHT_DECAY,
    "optimizer": "AdamW",
    "loss": "Weighted Cross Entropy",
    "scheduler": "ReduceLROnPlateau",
    "species_to_idx": species_to_idx,
    "python_version": platform.python_version(),
    "torch_version": torch.__version__,
    "torchvision_version": __import__("torchvision").__version__,
    "dataset_manifest": str(MANIFEST_PATH),
}

with open(SAVE_DIR / "training_config.json", "w") as f:
    json.dump(config, f, indent=2, ensure_ascii=False)

# ============================================================
# 3. PREPROCESSING AND AUGMENTATION
# ============================================================

# Thống kê ImageNet tương ứng với pretrained weights
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]

train_transform = transforms.Compose([
    transforms.RandomResizedCrop(
        IMG_SIZE,
        scale=(0.75, 1.0),
        ratio=(0.85, 1.15)
    ),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.RandomRotation(degrees=12),
    transforms.ColorJitter(
        brightness=0.15,
        contrast=0.15,
        saturation=0.12,
        hue=0.03
    ),
    transforms.ToTensor(),
    transforms.Normalize(MEAN, STD),
])

eval_transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(IMG_SIZE),
    transforms.ToTensor(),
    transforms.Normalize(MEAN, STD),
])

class PetSpeciesDataset(Dataset):
    def __init__(self, dataframe, transform):
        self.dataframe = dataframe.reset_index(drop=True)
        self.transform = transform

    def __len__(self):
        return len(self.dataframe)

    def __getitem__(self, index):
        row = self.dataframe.iloc[index]

        with Image.open(row["path"]) as image:
            image = image.convert("RGB")
            image = self.transform(image)

        label = species_to_idx[row["species"]]

        return image, label

train_dataset = PetSpeciesDataset(
    train_df, train_transform
)

val_dataset = PetSpeciesDataset(
    val_df, eval_transform
)

loader_generator = torch.Generator()
loader_generator.manual_seed(SEED)

train_loader = DataLoader(
    train_dataset,
    batch_size=BATCH_SIZE,
    shuffle=True,
    num_workers=NUM_WORKERS,
    pin_memory=True,
    generator=loader_generator,
    persistent_workers=(NUM_WORKERS > 0)
)

val_loader = DataLoader(
    val_dataset,
    batch_size=BATCH_SIZE,
    shuffle=False,
    num_workers=NUM_WORKERS,
    pin_memory=True,
    persistent_workers=(NUM_WORKERS > 0)
)

print("\nPreprocessing complete.")
print("Train batches:", len(train_loader))
print("Validation batches:", len(val_loader))

# ============================================================
# 4. BUILD EFFICIENTNET-B0
# ============================================================

print("\nLoading EfficientNet-B0 pretrained on ImageNet...")

weights = models.EfficientNet_B0_Weights.DEFAULT

model = models.efficientnet_b0(weights=weights)

in_features = model.classifier[1].in_features

model.classifier = nn.Sequential(
    nn.Dropout(p=DROPOUT),
    nn.Linear(in_features, len(species_names))
)

model = model.to(device)

# Weighted Cross Entropy:
# trọng số lớp tỷ lệ nghịch với số ảnh train của mỗi loài
class_counts = train_df["species"].value_counts()

class_weights = torch.tensor(
    [
        len(train_df) / (
            len(species_names) * class_counts[species]
        )
        for species in species_names
    ],
    dtype=torch.float32,
    device=device
)

criterion = nn.CrossEntropyLoss(
    weight=class_weights
)

optimizer = torch.optim.AdamW(
    [
        {
            "params": model.features.parameters(),
            "lr": BACKBONE_LR
        },
        {
            "params": model.classifier.parameters(),
            "lr": CLASSIFIER_LR
        },
    ],
    weight_decay=WEIGHT_DECAY
)

scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
    optimizer,
    mode="max",
    factor=0.5,
    patience=2,
    min_lr=1e-7
)

# Mixed precision giúp tiết kiệm VRAM trên GPU tương thích
amp_enabled = (
    device.type == "cuda"
    and torch.cuda.get_device_capability(0)[0] >= 7
)

scaler = torch.amp.GradScaler(
    "cuda",
    enabled=amp_enabled
)

print("Class weights:")
for name, weight in zip(species_names, class_weights.tolist()):
    print(f"  {name}: {weight:.4f}")

# ============================================================
# 5. TRAINING LOOP WITH EARLY STOPPING
# ============================================================

best_macro_f1 = -1.0
best_epoch = 0
best_state = None
epochs_without_improvement = 0

history = []
start_time = time.time()

for epoch in range(1, EPOCHS + 1):

    # ----------------------
    # TRAIN
    # ----------------------
    model.train()

    train_loss_sum = 0.0
    train_correct = 0
    train_total = 0

    for images, labels in train_loader:
        images = images.to(device, non_blocking=True)
        labels = labels.to(device, non_blocking=True)

        optimizer.zero_grad(set_to_none=True)

        with torch.autocast(
            device_type="cuda",
            dtype=torch.float16,
            enabled=amp_enabled
        ):
            logits = model(images)
            loss = criterion(logits, labels)

        scaler.scale(loss).backward()

        scaler.unscale_(optimizer)

        torch.nn.utils.clip_grad_norm_(
            model.parameters(),
            max_norm=1.0
        )

        scaler.step(optimizer)
        scaler.update()

        train_loss_sum += loss.item() * labels.size(0)
        train_correct += (
            logits.argmax(dim=1) == labels
        ).sum().item()
        train_total += labels.size(0)

    train_loss = train_loss_sum / train_total
    train_accuracy = train_correct / train_total

    # ----------------------
    # VALIDATION
    # ----------------------
    model.eval()

    val_loss_sum = 0.0
    y_true = []
    y_pred = []

    with torch.no_grad():
        for images, labels in val_loader:
            images = images.to(device, non_blocking=True)
            labels = labels.to(device, non_blocking=True)

            with torch.autocast(
                device_type="cuda",
                dtype=torch.float16,
                enabled=amp_enabled
            ):
                logits = model(images)
                loss = criterion(logits, labels)

            val_loss_sum += loss.item() * labels.size(0)

            y_true.extend(labels.cpu().tolist())
            y_pred.extend(logits.argmax(dim=1).cpu().tolist())

    val_loss = val_loss_sum / len(val_dataset)

    val_accuracy = accuracy_score(y_true, y_pred)

    val_precision, val_recall, val_macro_f1, _ = (
        precision_recall_fscore_support(
            y_true,
            y_pred,
            labels=list(range(len(species_names))),
            average="macro",
            zero_division=0
        )
    )

    scheduler.step(val_macro_f1)

    current_backbone_lr = optimizer.param_groups[0]["lr"]
    current_classifier_lr = optimizer.param_groups[1]["lr"]

    row = {
        "epoch": epoch,
        "train_loss": train_loss,
        "train_accuracy": train_accuracy,
        "val_loss": val_loss,
        "val_accuracy": val_accuracy,
        "val_precision_macro": val_precision,
        "val_recall_macro": val_recall,
        "val_macro_f1": val_macro_f1,
        "backbone_lr": current_backbone_lr,
        "classifier_lr": current_classifier_lr,
    }

    history.append(row)

    print(
        f"Epoch {epoch:02d}/{EPOCHS} | "
        f"Train Loss: {train_loss:.4f} | "
        f"Train Acc: {train_accuracy:.4f} | "
        f"Val Loss: {val_loss:.4f} | "
        f"Val Acc: {val_accuracy:.4f} | "
        f"Val Macro F1: {val_macro_f1:.4f}"
    )

    # Lưu lịch sử sau từng epoch để tránh mất log
    pd.DataFrame(history).to_csv(
        SAVE_DIR / "training_history.csv",
        index=False
    )

    # Chỉ lưu checkpoint khi validation Macro F1 cải thiện
    if val_macro_f1 > best_macro_f1:
        best_macro_f1 = val_macro_f1
        best_epoch = epoch
        best_state = copy.deepcopy(model.state_dict())

        epochs_without_improvement = 0

        checkpoint = {
            "model_state_dict": best_state,
            "species_to_idx": species_to_idx,
            "idx_to_species": idx_to_species,
            "input_size": IMG_SIZE,
            "mean": MEAN,
            "std": STD,
            "dropout": DROPOUT,
            "best_epoch": best_epoch,
            "best_val_macro_f1": best_macro_f1,
        }

        torch.save(
            checkpoint,
            SAVE_DIR / "efficientnet_b0_species_best.pth"
        )

        print("  -> Đã lưu checkpoint tốt nhất.")
    else:
        epochs_without_improvement += 1

    if epochs_without_improvement >= PATIENCE:
        print(
            f"\nEarly stopping tại epoch {epoch}: "
            f"Validation Macro F1 không cải thiện "
            f"sau {PATIENCE} epoch."
        )
        break

if best_state is None:
    raise RuntimeError("Training không tạo được checkpoint.")

# ============================================================
# 6. RESTORE BEST MODEL AND VALIDATION REPORT
# ============================================================

model.load_state_dict(best_state)
model.eval()

val_true = []
val_pred = []

with torch.no_grad():
    for images, labels in val_loader:
        images = images.to(device, non_blocking=True)

        with torch.autocast(
            device_type="cuda",
            dtype=torch.float16,
            enabled=amp_enabled
        ):
            logits = model(images)

        val_true.extend(labels.tolist())
        val_pred.extend(logits.argmax(dim=1).cpu().tolist())

val_acc_best = accuracy_score(val_true, val_pred)

val_precision, val_recall, val_f1, _ = (
    precision_recall_fscore_support(
        val_true,
        val_pred,
        labels=list(range(len(species_names))),
        average="macro",
        zero_division=0
    )
)

report = classification_report(
    val_true,
    val_pred,
    labels=list(range(len(species_names))),
    target_names=species_names,
    output_dict=True,
    zero_division=0
)

report_df = pd.DataFrame(report).transpose()
report_df.to_csv(
    SAVE_DIR / "validation_classification_report.csv"
)

with open(
    SAVE_DIR / "validation_classification_report.json", "w"
) as f:
    json.dump(report, f, indent=2)

print("\n" + "=" * 65)
print("BEST CHECKPOINT - VALIDATION RESULTS")
print("=" * 65)
print("Best epoch:", best_epoch)
print(f"Validation Accuracy: {val_acc_best:.4f}")
print(f"Validation Macro Precision: {val_precision:.4f}")
print(f"Validation Macro Recall: {val_recall:.4f}")
print(f"Validation Macro F1: {val_f1:.4f}")

print("\nClassification report:")
print(classification_report(
    val_true,
    val_pred,
    labels=list(range(len(species_names))),
    target_names=species_names,
    digits=4,
    zero_division=0
))

# ============================================================
# 7. SAVE CONFUSION MATRIX
# ============================================================

cm = confusion_matrix(
    val_true,
    val_pred,
    labels=list(range(len(species_names)))
)

# Lưu ma trận dạng CSV
cm_df = pd.DataFrame(
    cm,
    index=species_names,
    columns=species_names
)
cm_df.index.name = "True label"
cm_df.to_csv(SAVE_DIR / "confusion_matrix_val.csv")

# Vẽ confusion matrix bằng Matplotlib
fig, ax = plt.subplots(figsize=(8, 7))

im = ax.imshow(cm, interpolation="nearest", cmap="Blues")
fig.colorbar(im, ax=ax)

ax.set(
    xticks=np.arange(len(species_names)),
    yticks=np.arange(len(species_names)),
    xticklabels=species_names,
    yticklabels=species_names,
    xlabel="Predicted label",
    ylabel="True label",
    title="EfficientNet-B0 - Validation Confusion Matrix"
)

plt.setp(
    ax.get_xticklabels(),
    rotation=35,
    ha="right",
    rotation_mode="anchor"
)

threshold = cm.max() / 2 if cm.size else 0

for i in range(cm.shape[0]):
    for j in range(cm.shape[1]):
        ax.text(
            j, i, str(cm[i, j]),
            ha="center",
            va="center",
            color="white" if cm[i, j] > threshold else "black"
        )

fig.tight_layout()
fig.savefig(
    SAVE_DIR / "confusion_matrix_val.png",
    dpi=300,
    bbox_inches="tight"
)
plt.show()

# ============================================================
# 8. PLOT TRAINING CURVES
# ============================================================

history_df = pd.DataFrame(history)

# Accuracy
fig, ax = plt.subplots(figsize=(8, 5))
ax.plot(
    history_df["epoch"],
    history_df["train_accuracy"],
    marker="o",
    label="Train Accuracy"
)
ax.plot(
    history_df["epoch"],
    history_df["val_accuracy"],
    marker="o",
    label="Validation Accuracy"
)
ax.set_xlabel("Epoch")
ax.set_ylabel("Accuracy")
ax.set_title("EfficientNet-B0 - Accuracy")
ax.legend()
ax.grid(True, alpha=0.3)
fig.tight_layout()
fig.savefig(SAVE_DIR / "accuracy_curve.png", dpi=300)
plt.show()

# Loss
fig, ax = plt.subplots(figsize=(8, 5))
ax.plot(
    history_df["epoch"],
    history_df["train_loss"],
    marker="o",
    label="Train Loss"
)
ax.plot(
    history_df["epoch"],
    history_df["val_loss"],
    marker="o",
    label="Validation Loss"
)
ax.set_xlabel("Epoch")
ax.set_ylabel("Loss")
ax.set_title("EfficientNet-B0 - Loss")
ax.legend()
ax.grid(True, alpha=0.3)
fig.tight_layout()
fig.savefig(SAVE_DIR / "loss_curve.png", dpi=300)
plt.show()

# Validation Macro F1
fig, ax = plt.subplots(figsize=(8, 5))
ax.plot(
    history_df["epoch"],
    history_df["val_macro_f1"],
    marker="o",
    label="Validation Macro F1"
)
ax.set_xlabel("Epoch")
ax.set_ylabel("Macro F1")
ax.set_title("EfficientNet-B0 - Validation Macro F1")
ax.legend()
ax.grid(True, alpha=0.3)
fig.tight_layout()
fig.savefig(SAVE_DIR / "macro_f1_curve.png", dpi=300)
plt.show()

# ============================================================
# 9. SAVE FINAL METRICS AND LABELS
# ============================================================

elapsed_minutes = (time.time() - start_time) / 60

final_metrics = {
    "model": "EfficientNet-B0",
    "task": "5-species classification",
    "total_images": int(len(df)),
    "train_images": int(len(train_df)),
    "validation_images": int(len(val_df)),
    "test_images_reserved": int((df["split"] == "test").sum()),
    "species": species_names,
    "number_of_species": len(species_names),
    "best_epoch": int(best_epoch),
    "validation_accuracy": float(val_acc_best),
    "validation_macro_precision": float(val_precision),
    "validation_macro_recall": float(val_recall),
    "validation_macro_f1": float(val_f1),
    "training_time_minutes": round(elapsed_minutes, 2),
}

with open(SAVE_DIR / "final_metrics.json", "w") as f:
    json.dump(final_metrics, f, indent=2, ensure_ascii=False)

with open(SAVE_DIR / "species_labels.json", "w") as f:
    json.dump(species_to_idx, f, indent=2, ensure_ascii=False)

print("\n" + "=" * 65)
print("TRAINING COMPLETE")
print("=" * 65)
print(f"Training time: {elapsed_minutes:.2f} minutes")
print("Best epoch:", best_epoch)
print(f"Validation Accuracy: {val_acc_best:.4f}")
print(f"Validation Macro F1: {val_f1:.4f}")
print("\nAll outputs saved to:")
print(SAVE_DIR)

print("\nFiles:")
for file in sorted(SAVE_DIR.iterdir()):
    print(" -", file.name)

print(
    "\nLƯU Ý: Test set chưa được sử dụng. "
    "Chỉ đánh giá test sau khi hoàn thiện mô hình."
)
