
# ==============================================================
# PETCARE AI - STAGE 2: TRAIN 5 SPECIES-SPECIFIC BREED CLASSIFIERS
# EfficientNet-B0 | Transfer learning from Stage 1
# Train: train split | Model selection: validation Macro F1
# Test split: KHONG SU DUNG trong qua trinh train
# ==============================================================
# sửa đường dẫn trước khi train lại
# model được train ở gg colab

import os
import json
import random
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from pathlib import Path
from PIL import Image
from tqdm.auto import tqdm

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torchvision import models, transforms

from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    classification_report,
    confusion_matrix,
    ConfusionMatrixDisplay
)

# ==============================================================
# 1. CONFIGURATION
# ==============================================================

SEED = 42
BATCH_SIZE = 32
MAX_EPOCHS = 15
EARLY_STOPPING_PATIENCE = 4
NUM_WORKERS = 2

MANIFEST_PATH = Path(
    "/content/petcare_data/petcare_manifest.csv"
)

STAGE1_PATH = Path(
    "/content/drive/MyDrive/PetCareAI_models/stage1/"
    "efficientnet_b0_species_best.pth"
)

OUTPUT_ROOT = Path(
    "/content/drive/MyDrive/PetCareAI_models/stage2"
)

SPECIES_LIST = [
    "dog",
    "cat",
    "bird",
    "rabbit",
    "hamster"
]

random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)

if torch.cuda.is_available():
    torch.cuda.manual_seed_all(SEED)

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)
USE_AMP = DEVICE.type == "cuda"

print("=" * 65)
print("PETCARE AI - STAGE 2")
print("=" * 65)
print("Device:", DEVICE)

if DEVICE.type == "cuda":
    print("GPU:", torch.cuda.get_device_name(0))
else:
    print("Đang chạy CPU. Thời gian train có thể lâu hơn.")

# ==============================================================
# 2. CHECK INPUT FILES AND MANIFEST
# ==============================================================

assert MANIFEST_PATH.exists(), (
    f"Không tìm thấy manifest: {MANIFEST_PATH}\n"
    "Kiểm tra dataset trong Colab trước khi train."
)

assert STAGE1_PATH.exists(), (
    f"Không tìm thấy checkpoint Stage 1: {STAGE1_PATH}\n"
    "Kiểm tra checkpoint trên Google Drive."
)

OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

df = pd.read_csv(MANIFEST_PATH)

required_columns = {
    "path", "species", "breed", "split"
}
assert required_columns.issubset(df.columns), (
    f"Manifest thiếu cột: {required_columns - set(df.columns)}"
)

df["species"] = (
    df["species"].astype(str).str.strip().str.lower()
)
df["breed"] = df["breed"].astype(str).str.strip()
df["split"] = df["split"].astype(str).str.strip().str.lower()

assert set(df["split"].unique()).issubset(
    {"train", "val", "test"}
), "Giá trị split không hợp lệ."

assert set(SPECIES_LIST).issubset(
    set(df["species"].unique())
), "Thiếu một hoặc nhiều loài trong manifest."

# Kiểm tra tất cả file ảnh tồn tại.
missing_paths = [
    p for p in df["path"].tolist()
    if not Path(p).is_file()
]

assert len(missing_paths) == 0, (
    f"Có {len(missing_paths)} ảnh bị thiếu. "
    f"Ví dụ: {missing_paths[:5]}"
)

# Không cho phép một đường dẫn xuất hiện nhiều lần.
assert not df["path"].duplicated().any(), (
    "Manifest có đường dẫn ảnh trùng lặp."
)

# Mỗi đường dẫn chỉ thuộc một split.
assert df.groupby("path")["split"].nunique().max() == 1

print("\nDataset tổng:", len(df))
print("\nSố ảnh theo loài và split:")
print(pd.crosstab(df["species"], df["split"]))

# ==============================================================
# 3. LOAD STAGE 1 CHECKPOINT
# ==============================================================

def load_checkpoint(path):
    # Checkpoint do chính pipeline này tạo ra.
    try:
        return torch.load(
            path,
            map_location="cpu",
            weights_only=True
        )
    except TypeError:
        return torch.load(path, map_location="cpu")


def extract_state_dict(checkpoint):
    if not isinstance(checkpoint, dict):
        raise ValueError("Checkpoint không có cấu trúc dict.")

    for key in (
        "model_state_dict",
        "state_dict",
        "model",
        "model_state",
        "weights"
    ):
        value = checkpoint.get(key)

        if isinstance(value, dict) and value:
            if all(torch.is_tensor(v) for v in value.values()):
                return value

    if checkpoint and all(
        torch.is_tensor(v) for v in checkpoint.values()
    ):
        return checkpoint

    raise ValueError(
        "Không tìm thấy state_dict trong checkpoint Stage 1."
    )


stage1_checkpoint = load_checkpoint(STAGE1_PATH)
stage1_state = extract_state_dict(stage1_checkpoint)

# Bỏ prefix thường gặp khi dùng DataParallel.
stage1_state = {
    k.removeprefix("module."): v
    for k, v in stage1_state.items()
}

print("\nĐã đọc checkpoint Stage 1.")
print("Số tensor trong checkpoint:", len(stage1_state))

# ==============================================================
# 4. IMAGE TRANSFORMS
# ==============================================================

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

train_transform = transforms.Compose([
    transforms.RandomResizedCrop(
        224,
        scale=(0.75, 1.0),
        ratio=(0.85, 1.15)
    ),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.RandomRotation(12),
    transforms.ColorJitter(
        brightness=0.15,
        contrast=0.15,
        saturation=0.15
    ),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=IMAGENET_MEAN,
        std=IMAGENET_STD
    )
])

eval_transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=IMAGENET_MEAN,
        std=IMAGENET_STD
    )
])

# ==============================================================
# 5. DATASET
# ==============================================================

class BreedDataset(Dataset):
    def __init__(self, frame, breed_to_idx, training=False):
        self.frame = frame.reset_index(drop=True)
        self.breed_to_idx = breed_to_idx
        self.transform = (
            train_transform if training else eval_transform
        )

    def __len__(self):
        return len(self.frame)

    def __getitem__(self, index):
        row = self.frame.iloc[index]

        with Image.open(row["path"]) as image:
            image = image.convert("RGB")
            image = self.transform(image)

        label = self.breed_to_idx[row["breed"]]

        return image, label


# ==============================================================
# 6. CREATE MODEL AND TRANSFER LEARNING
# ==============================================================

def create_breed_model(num_classes):
    # Tạo đúng kiến trúc EfficientNet-B0.
    model = models.efficientnet_b0(weights=None)

    model_state = model.state_dict()

    # Chỉ chuyển các trọng số backbone khớp tên và kích thước.
    # Không chuyển classifier 5 loài sang classifier giống.
    compatible_state = {
        key: value
        for key, value in stage1_state.items()
        if (
            key in model_state
            and model_state[key].shape == value.shape
            and not key.startswith("classifier.")
        )
    }

    if len(compatible_state) == 0:
        raise RuntimeError(
            "Không có trọng số backbone tương thích. "
            "Dừng để kiểm tra cấu trúc checkpoint Stage 1."
        )

    model.load_state_dict(
        compatible_state,
        strict=False
    )

    print(
        f"Transfer learning: nạp {len(compatible_state)} "
        "tensor backbone từ Stage 1."
    )

    # Classifier riêng cho từng loài.
    in_features = model.classifier[1].in_features

    model.classifier = nn.Sequential(
        nn.Dropout(p=0.3),
        nn.Linear(in_features, num_classes)
    )

    return model


# ==============================================================
# 7. EVALUATION FUNCTION
# ==============================================================

def evaluate_model(model, loader, criterion):
    model.eval()

    total_loss = 0.0
    y_true = []
    y_pred = []

    with torch.no_grad():
        for images, labels in loader:
            images = images.to(
                DEVICE, non_blocking=True
            )
            labels = labels.to(
                DEVICE, non_blocking=True
            )

            with torch.autocast(
                device_type=DEVICE.type,
                dtype=torch.float16,
                enabled=USE_AMP
            ):
                logits = model(images)
                loss = criterion(logits, labels)

            total_loss += loss.item() * labels.size(0)

            predictions = logits.argmax(dim=1)

            y_true.extend(labels.cpu().numpy().tolist())
            y_pred.extend(predictions.cpu().numpy().tolist())

    accuracy = accuracy_score(y_true, y_pred)

    precision, recall, macro_f1, _ = (
        precision_recall_fscore_support(
            y_true,
            y_pred,
            average="macro",
            zero_division=0
        )
    )

    return {
        "loss": total_loss / len(loader.dataset),
        "accuracy": float(accuracy),
        "macro_precision": float(precision),
        "macro_recall": float(recall),
        "macro_f1": float(macro_f1),
        "y_true": np.asarray(y_true),
        "y_pred": np.asarray(y_pred)
    }


# ==============================================================
# 8. TRAIN ONE SPECIES
# ==============================================================

def train_one_species(species):
    print("\n" + "#" * 65)
    print(f"TRAIN MODEL: {species.upper()}")
    print("#" * 65)

    species_df = df[
        df["species"] == species
    ].copy()

    train_df = species_df[
        species_df["split"] == "train"
    ].copy()

    val_df = species_df[
        species_df["split"] == "val"
    ].copy()

    # Test không được dùng trong train hoặc chọn checkpoint.
    assert len(train_df) > 0, f"{species}: train rỗng."
    assert len(val_df) > 0, f"{species}: validation rỗng."

    # Tất cả giống phải có mặt trong cả train và val.
    train_breeds = set(train_df["breed"].unique())
    val_breeds = set(val_df["breed"].unique())

    assert train_breeds == val_breeds, (
        f"{species}: tập train và val có bộ nhãn khác nhau."
    )

    breeds = sorted(train_breeds)
    breed_to_idx = {
        breed: index
        for index, breed in enumerate(breeds)
    }
    idx_to_breed = {
        index: breed
        for breed, index in breed_to_idx.items()
    }

    print("Số giống:", len(breeds))
    print("Số ảnh train:", len(train_df))
    print("Số ảnh val:", len(val_df))

    species_dir = OUTPUT_ROOT / species
    species_dir.mkdir(parents=True, exist_ok=True)

    checkpoint_path = (
        species_dir / f"efficientnet_b0_{species}_best.pth"
    )
    metrics_path = species_dir / "final_metrics.json"

    # Nếu model đã hoàn thành, bỏ qua để tránh train lại.
    # Nếu chỉ có checkpoint nhưng thiếu metrics, train lại.
    if checkpoint_path.exists() and metrics_path.exists():
        try:
            with open(metrics_path, "r", encoding="utf-8") as f:
                old_metrics = json.load(f)

            old_checkpoint = load_checkpoint(checkpoint_path)

            if (
                old_metrics.get("status") == "completed"
                and old_checkpoint.get("breed_to_idx") == breed_to_idx
            ):
                print(
                    f"Đã có kết quả hoàn chỉnh cho {species}. "
                    "Bỏ qua model này."
                )
                return old_metrics

        except Exception as error:
            print("Không thể dùng kết quả cũ:", error)
            print("Sẽ train lại model này.")

    train_ds = BreedDataset(
        train_df, breed_to_idx, training=True
    )
    val_ds = BreedDataset(
        val_df, breed_to_idx, training=False
    )

    train_loader = DataLoader(
        train_ds,
        batch_size=BATCH_SIZE,
        shuffle=True,
        num_workers=NUM_WORKERS,
        pin_memory=USE_AMP
    )

    val_loader = DataLoader(
        val_ds,
        batch_size=BATCH_SIZE,
        shuffle=False,
        num_workers=NUM_WORKERS,
        pin_memory=USE_AMP
    )

    model = create_breed_model(len(breeds)).to(DEVICE)

    optimizer = torch.optim.AdamW(
        [
            {
                "params": model.features.parameters(),
                "lr": 5e-5
            },
            {
                "params": model.classifier.parameters(),
                "lr": 5e-4
            }
        ],
        weight_decay=1e-4
    )

    criterion = nn.CrossEntropyLoss()

    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer,
        mode="max",
        factor=0.5,
        patience=2
    )

    scaler = torch.amp.GradScaler(
        "cuda",
        enabled=USE_AMP
    )

    history = []
    best_f1 = -1.0
    best_epoch = 0
    patience_count = 0

    # ---------------- EPOCH LOOP ----------------
    for epoch in range(1, MAX_EPOCHS + 1):
        model.train()

        running_loss = 0.0
        train_y = []
        train_pred = []

        progress = tqdm(
            train_loader,
            desc=f"{species} | Epoch {epoch}/{MAX_EPOCHS}",
            leave=False
        )

        for images, labels in progress:
            images = images.to(
                DEVICE, non_blocking=True
            )
            labels = labels.to(
                DEVICE, non_blocking=True
            )

            optimizer.zero_grad(set_to_none=True)

            with torch.autocast(
                device_type=DEVICE.type,
                dtype=torch.float16,
                enabled=USE_AMP
            ):
                logits = model(images)
                loss = criterion(logits, labels)

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()

            running_loss += loss.item() * labels.size(0)

            train_y.extend(labels.detach().cpu().tolist())
            train_pred.extend(
                logits.argmax(dim=1).detach().cpu().tolist()
            )

            progress.set_postfix(
                loss=f"{loss.item():.4f}"
            )

        train_loss = running_loss / len(train_ds)
        train_accuracy = accuracy_score(train_y, train_pred)

        _, _, train_macro_f1, _ = (
            precision_recall_fscore_support(
                train_y,
                train_pred,
                average="macro",
                zero_division=0
            )
        )

        val_result = evaluate_model(
            model, val_loader, criterion
        )

        scheduler.step(val_result["macro_f1"])

        row = {
            "epoch": epoch,
            "train_loss": float(train_loss),
            "train_accuracy": float(train_accuracy),
            "train_macro_f1": float(train_macro_f1),
            "val_loss": val_result["loss"],
            "val_accuracy": val_result["accuracy"],
            "val_macro_precision": val_result["macro_precision"],
            "val_macro_recall": val_result["macro_recall"],
            "val_macro_f1": val_result["macro_f1"]
        }

        history.append(row)

        # Lưu lịch sử sau từng epoch.
        pd.DataFrame(history).to_csv(
            species_dir / "training_history.csv",
            index=False
        )

        print(
            f"Epoch {epoch:02d}/{MAX_EPOCHS} | "
            f"Train Loss: {train_loss:.4f} | "
            f"Train Acc: {train_accuracy:.4%} | "
            f"Val Loss: {val_result['loss']:.4f} | "
            f"Val Acc: {val_result['accuracy']:.4%} | "
            f"Val Macro F1: {val_result['macro_f1']:.4f}"
        )

        # Chọn checkpoint theo validation Macro F1.
        if val_result["macro_f1"] > best_f1:
            best_f1 = val_result["macro_f1"]
            best_epoch = epoch
            patience_count = 0

            torch.save(
                {
                    "model_state_dict": model.state_dict(),
                    "architecture": "efficientnet_b0",
                    "species": species,
                    "breed_to_idx": breed_to_idx,
                    "idx_to_breed": idx_to_breed,
                    "num_classes": len(breeds),
                    "input_size": 224,
                    "best_epoch": best_epoch,
                    "best_val_macro_f1": best_f1,
                    "seed": SEED
                },
                checkpoint_path
            )

            print("  -> Đã lưu checkpoint tốt nhất.")

        else:
            patience_count += 1

        if patience_count >= EARLY_STOPPING_PATIENCE:
            print(
                f"Early stopping tại epoch {epoch}; "
                f"epoch tốt nhất: {best_epoch}."
            )
            break

    # ==========================================================
    # 9. RELOAD BEST CHECKPOINT AND SAVE VALIDATION REPORTS
    # ==========================================================

    best_checkpoint = load_checkpoint(checkpoint_path)

    model.load_state_dict(
        best_checkpoint["model_state_dict"]
    )

    # Đánh giá lại trên validation bằng checkpoint tốt nhất.
    val_result = evaluate_model(
        model, val_loader, criterion
    )

    y_true = val_result["y_true"]
    y_pred = val_result["y_pred"]

    report = classification_report(
        y_true,
        y_pred,
        labels=list(range(len(breeds))),
        target_names=breeds,
        output_dict=True,
        zero_division=0
    )

    pd.DataFrame(report).transpose().to_csv(
        species_dir / "validation_classification_report.csv"
    )

    # Confusion matrix.
    cm = confusion_matrix(
        y_true,
        y_pred,
        labels=list(range(len(breeds)))
    )

    pd.DataFrame(
        cm,
        index=breeds,
        columns=breeds
    ).to_csv(
        species_dir / "confusion_matrix_val.csv"
    )

    fig_size = max(8, min(16, len(breeds) * 0.65))

    fig, ax = plt.subplots(
        figsize=(fig_size, fig_size)
    )

    display_cm = ConfusionMatrixDisplay(
        confusion_matrix=cm,
        display_labels=breeds
    )

    display_cm.plot(
        ax=ax,
        xticks_rotation=90,
        colorbar=False,
        values_format="d"
    )

    ax.set_title(
        f"{species.title()} Breed - Validation Confusion Matrix"
    )

    plt.tight_layout()

    plt.savefig(
        species_dir / "confusion_matrix_val.png",
        dpi=180,
        bbox_inches="tight"
    )

    plt.close(fig)

    # Biểu đồ training.
    hist_df = pd.DataFrame(history)

    fig, axes = plt.subplots(
        1, 3, figsize=(16, 4)
    )

    axes[0].plot(
        hist_df["epoch"], hist_df["train_loss"],
        label="Train"
    )
    axes[0].plot(
        hist_df["epoch"], hist_df["val_loss"],
        label="Validation"
    )
    axes[0].set_title("Loss")
    axes[0].legend()

    axes[1].plot(
        hist_df["epoch"], hist_df["train_accuracy"],
        label="Train"
    )
    axes[1].plot(
        hist_df["epoch"], hist_df["val_accuracy"],
        label="Validation"
    )
    axes[1].set_title("Accuracy")
    axes[1].legend()

    axes[2].plot(
        hist_df["epoch"], hist_df["train_macro_f1"],
        label="Train"
    )
    axes[2].plot(
        hist_df["epoch"], hist_df["val_macro_f1"],
        label="Validation"
    )
    axes[2].set_title("Macro F1")
    axes[2].legend()

    for ax in axes:
        ax.set_xlabel("Epoch")
        ax.grid(True, alpha=0.3)

    fig.suptitle(
        f"{species.title()} Breed Training Curves"
    )

    plt.tight_layout()

    plt.savefig(
        species_dir / "training_curves.png",
        dpi=180,
        bbox_inches="tight"
    )

    plt.close(fig)

    # Lưu tổng kết cuối cùng.
    summary = {
        "status": "completed",
        "species": species,
        "num_breeds": len(breeds),
        "breed_labels": breeds,
        "train_images": len(train_df),
        "val_images": len(val_df),
        "best_epoch": best_epoch,
        "val_loss": val_result["loss"],
        "val_accuracy": val_result["accuracy"],
        "val_macro_precision": val_result["macro_precision"],
        "val_macro_recall": val_result["macro_recall"],
        "val_macro_f1": val_result["macro_f1"],
        "checkpoint": str(checkpoint_path)
    }

    with open(
        metrics_path, "w", encoding="utf-8"
    ) as file:
        json.dump(
            summary,
            file,
            ensure_ascii=False,
            indent=2
        )

    print(f"\nHoàn thành model {species.upper()}.")
    print(
        f"Best epoch: {best_epoch} | "
        f"Val Accuracy: {val_result['accuracy']:.4%} | "
        f"Val Macro F1: {val_result['macro_f1']:.4f}"
    )

    del model, optimizer, scaler
    del train_loader, val_loader, train_ds, val_ds

    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    return summary


# ==============================================================
# 10. TRAIN ALL FIVE SPECIES
# ==============================================================

all_results = []

for species in SPECIES_LIST:
    result = train_one_species(species)
    all_results.append(result)

    # Cập nhật bảng tổng kết sau từng model hoàn thành.
    pd.DataFrame(all_results).to_csv(
        OUTPUT_ROOT / "stage2_validation_summary.csv",
        index=False
    )

# Đọc lại kết quả của cả 5 model, bao gồm model được bỏ qua
# vì đã hoàn thành từ lần chạy trước.
complete_results = []

for species in SPECIES_LIST:
    metrics_path = (
        OUTPUT_ROOT / species / "final_metrics.json"
    )

    if metrics_path.exists():
        with open(
            metrics_path, "r", encoding="utf-8"
        ) as file:
            metrics = json.load(file)

        if metrics.get("status") == "completed":
            complete_results.append(metrics)

summary_df = pd.DataFrame(complete_results)

summary_df.to_csv(
    OUTPUT_ROOT / "stage2_validation_summary.csv",
    index=False
)

print("\n" + "=" * 65)
print("TỔNG KẾT STAGE 2")
print("=" * 65)

if len(summary_df):
    display(
        summary_df[
            [
                "species",
                "num_breeds",
                "train_images",
                "val_images",
                "best_epoch",
                "val_accuracy",
                "val_macro_f1"
            ]
        ]
    )

print("\nThư mục kết quả:", OUTPUT_ROOT)
print("Tập test chưa được sử dụng.")
