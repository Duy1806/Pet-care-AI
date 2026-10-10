from __future__ import annotations

import csv
import hashlib
import random
import time
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from PIL import Image, ImageFile
from torchvision import models, transforms

# ========================= CONFIG =========================
DATA_DIR = Path(r"D:\DACN2\dataset\dataset_final")
MODEL_DIR = Path(r"D:\DACN2\models")
MODEL_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR = MODEL_DIR / "efficientnet_b0_feature_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

MODEL_PATH = MODEL_DIR / "pet_5class_efficientnet_b0_best.pth"
HISTORY_PATH = MODEL_DIR / "pet_5class_efficientnet_b0_history.csv"

CLASS_NAMES = ["bird", "cat", "dog", "hamster", "rabbit"]
SPLITS = ("train", "val", "test")
IMAGE_SIZE = 160
RESIZE_SIZE = 176
BATCH_SIZE = 8
CLASSIFIER_BATCH_SIZE = 128
MAX_EPOCHS = 30
EARLY_STOPPING_PATIENCE = 5
LEARNING_RATE = 1e-3
WEIGHT_DECAY = 1e-4
NUM_WORKERS = 0
SEED = 42
CACHE_VERSION = "effb0-v1-img160-imagenetnorm"
DEVICE = torch.device("cpu")

torch.set_num_threads(2)
ImageFile.LOAD_TRUNCATED_IMAGES = True


def set_seed(seed: int = SEED) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def get_transforms():
    return transforms.Compose([
        transforms.Resize(RESIZE_SIZE),
        transforms.CenterCrop(IMAGE_SIZE),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
    ])


class PetImageDataset(Dataset):
    def __init__(self, split: str):
        if split not in SPLITS:
            raise ValueError(f"Split không hợp lệ: {split}")
        self.transform = get_transforms()
        self.samples: List[Tuple[Path, int]] = []

        for label, class_name in enumerate(CLASS_NAMES):
            folder = DATA_DIR / class_name / split
            if not folder.is_dir():
                raise FileNotFoundError(f"Không tìm thấy thư mục: {folder}")
            files = sorted(
                p for p in folder.rglob("*")
                if p.is_file() and p.suffix.lower() in
                {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
            )
            self.samples.extend((p, label) for p in files)

        if not self.samples:
            raise RuntimeError(f"Không có ảnh trong split '{split}' tại {DATA_DIR}")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, index):
        path, label = self.samples[index]
        try:
            with Image.open(path) as image:
                image = image.convert("RGB")
                image = self.transform(image)
        except Exception as exc:
            raise RuntimeError(f"Không đọc được ảnh: {path}\nLỗi: {exc}") from exc
        return image, label


def dataset_fingerprint(dataset: PetImageDataset) -> str:
    digest = hashlib.sha256()
    digest.update(CACHE_VERSION.encode("utf-8"))
    digest.update("|".join(CLASS_NAMES).encode("utf-8"))
    for path, label in dataset.samples:
        stat = path.stat()
        digest.update(
            f"{path}|{label}|{stat.st_size}|{stat.st_mtime_ns}\n".encode(
                "utf-8", errors="replace"
            )
        )
    return digest.hexdigest()


def build_backbone():
    # First run may download ImageNet pretrained weights.
    model = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.DEFAULT)
    model.eval()
    for parameter in model.parameters():
        parameter.requires_grad = False
    return model.to(DEVICE)


@torch.inference_mode()
def extract_or_load_features(split: str, backbone: nn.Module):
    dataset = PetImageDataset(split)
    fingerprint = dataset_fingerprint(dataset)
    cache_path = CACHE_DIR / f"{split}_{fingerprint[:16]}.pt"

    if cache_path.exists():
        try:
            cached = torch.load(cache_path, map_location="cpu", weights_only=True)
            features = cached["features"].float().contiguous()
            labels = cached["labels"].long().contiguous()
            if (
                features.ndim == 2
                and features.shape == (len(dataset), 1280)
                and labels.shape == (len(dataset),)
                and (labels.numel() == 0 or (
                    labels.min().item() >= 0
                    and labels.max().item() < len(CLASS_NAMES)
                ))
            ):
                print(f"[CACHE] Dùng lại features {split}: {len(dataset)} ảnh")
                return features, labels
            print(f"[CACHE] Cache sai định dạng, trích xuất lại: {cache_path.name}")
        except Exception as exc:
            print(f"[CACHE] Không đọc được cache ({exc}), trích xuất lại.")

    loader = DataLoader(
        dataset, batch_size=BATCH_SIZE, shuffle=False,
        num_workers=NUM_WORKERS, pin_memory=False
    )
    feature_batches = []
    label_batches = []
    start = time.time()
    print(f"[FEATURE] Trích xuất {split}: {len(dataset)} ảnh...")

    backbone.eval()
    for batch_index, (images, labels) in enumerate(loader, start=1):
        output = backbone.features(images.to(DEVICE))
        output = backbone.avgpool(output)
        output = torch.flatten(output, 1)  # Shape: [batch, 1280]
        feature_batches.append(output.cpu().float())
        label_batches.append(labels.cpu().long())
        if batch_index % 100 == 0 or batch_index == len(loader):
            print(f"  {split}: {batch_index}/{len(loader)} batches")

    features = torch.cat(feature_batches, dim=0).contiguous()
    labels = torch.cat(label_batches, dim=0).contiguous()

    if features.shape != (len(dataset), 1280):
        raise RuntimeError(f"Shape features không đúng: {tuple(features.shape)}")
    if labels.shape != (len(dataset),):
        raise RuntimeError(f"Shape labels không đúng: {tuple(labels.shape)}")
    if labels.numel() and (
        labels.min().item() < 0 or labels.max().item() >= len(CLASS_NAMES)
    ):
        raise RuntimeError("Nhãn ảnh nằm ngoài phạm vi lớp 0..4.")

    torch.save({
        "features": features,
        "labels": labels,
        "fingerprint": fingerprint,
        "cache_version": CACHE_VERSION,
    }, cache_path)
    print(f"[CACHE] Đã lưu {split}: {cache_path.name} ({time.time() - start:.1f}s)")
    return features, labels


class FeatureClassifier(nn.Module):
    def __init__(self, num_classes: int):
        super().__init__()
        self.classifier = nn.Sequential(
            nn.Dropout(p=0.2),
            nn.Linear(1280, num_classes),
        )

    def forward(self, features: torch.Tensor) -> torch.Tensor:
        # Always returns [batch_size, 5] logits, never 1280-D feature vectors.
        return self.classifier(features)


def calculate_metrics(logits: torch.Tensor, labels: torch.Tensor):
    num_classes = len(CLASS_NAMES)
    if logits.ndim != 2 or logits.shape[1] != num_classes:
        raise RuntimeError(
            f"Logits phải có shape [batch, {num_classes}], nhận {tuple(logits.shape)}"
        )
    if labels.ndim != 1 or len(labels) != len(logits):
        raise RuntimeError(
            f"Labels/logits không khớp: {tuple(labels.shape)} / {tuple(logits.shape)}"
        )
    if labels.numel() and (
        labels.min().item() < 0 or labels.max().item() >= num_classes
    ):
        raise RuntimeError("Nhãn thật nằm ngoài phạm vi 0..4.")

    predictions = logits.argmax(dim=1)
    confusion = torch.bincount(
        labels.long() * num_classes + predictions.long(),
        minlength=num_classes * num_classes,
    ).reshape(num_classes, num_classes)

    accuracy = (predictions == labels).float().mean().item()
    tp = confusion.diag().float()
    precision = tp / confusion.sum(dim=0).float().clamp_min(1)
    recall = tp / confusion.sum(dim=1).float().clamp_min(1)
    f1 = 2 * precision * recall / (precision + recall).clamp_min(1e-12)
    return accuracy, f1.mean().item(), confusion


def evaluate_classifier(classifier, features, labels, batch_size=CLASSIFIER_BATCH_SIZE):
    classifier.eval()
    logits_list = []
    labels_list = []
    with torch.inference_mode():
        for start in range(0, len(features), batch_size):
            batch_x = features[start:start + batch_size].to(DEVICE).float()
            batch_y = labels[start:start + batch_size].to(DEVICE).long()
            logits = classifier(batch_x)
            expected_shape = (len(batch_y), len(CLASS_NAMES))
            if tuple(logits.shape) != expected_shape:
                raise RuntimeError(
                    f"Classifier output sai shape: cần {expected_shape}, "
                    f"nhận {tuple(logits.shape)}"
                )
            logits_list.append(logits.cpu())
            labels_list.append(batch_y.cpu())

    return calculate_metrics(
        torch.cat(logits_list, dim=0),
        torch.cat(labels_list, dim=0),
    )


def make_train_loader(features, labels):
    counts = torch.bincount(labels, minlength=len(CLASS_NAMES)).float()
    if (counts == 0).any():
        missing = [CLASS_NAMES[i] for i, value in enumerate(counts) if value == 0]
        raise RuntimeError(f"Train thiếu ảnh của lớp: {missing}")
    sample_weights = (1.0 / counts)[labels]
    sampler = WeightedRandomSampler(
        sample_weights.double(), num_samples=len(labels), replacement=True
    )
    dataset = torch.utils.data.TensorDataset(features.float(), labels.long())
    return DataLoader(dataset, batch_size=CLASSIFIER_BATCH_SIZE, sampler=sampler)


def print_confusion_matrix(confusion):
    print("\nConfusion matrix (hàng = nhãn thật, cột = dự đoán):")
    print(" " * 12 + " ".join(f"{name:>10}" for name in CLASS_NAMES))
    for i, name in enumerate(CLASS_NAMES):
        print(f"{name:>10}  " + " ".join(f"{int(x):>10}" for x in confusion[i]))


def main():
    set_seed()
    print("=" * 60)
    print("EFFICIENTNET-B0 - 5 CLASS PET CLASSIFICATION")
    print(f"Data: {DATA_DIR}")
    print(f"Device: {DEVICE}")
    print(f"Classes: {CLASS_NAMES}")
    print("=" * 60)

    for class_name in CLASS_NAMES:
        for split in SPLITS:
            folder = DATA_DIR / class_name / split
            if not folder.is_dir():
                raise FileNotFoundError(f"Thiếu thư mục dữ liệu: {folder}")

    backbone = build_backbone()
    X_train, y_train = extract_or_load_features("train", backbone)
    X_val, y_val = extract_or_load_features("val", backbone)
    X_test, y_test = extract_or_load_features("test", backbone)

    print("\nSố lượng ảnh:")
    print(f"Train: {len(y_train)} | Val: {len(y_val)} | Test: {len(y_test)}")
    if not len(y_train) or not len(y_val) or not len(y_test):
        raise RuntimeError("Train/val/test không được để trống.")

    train_loader = make_train_loader(X_train, y_train)
    classifier = FeatureClassifier(len(CLASS_NAMES)).to(DEVICE)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.05)
    optimizer = torch.optim.AdamW(
        classifier.parameters(), lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY
    )
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="max", factor=0.5, patience=2
    )

    best_val_f1 = -1.0
    best_epoch = 0
    patience_counter = 0
    history: List[Dict[str, float]] = []

    print("\n========== TRAIN CLASSIFIER ==========")
    for epoch in range(1, MAX_EPOCHS + 1):
        classifier.train()
        total_loss = 0.0
        total_seen = 0

        for batch_x, batch_y in train_loader:
            batch_x = batch_x.to(DEVICE).float()
            batch_y = batch_y.to(DEVICE).long()
            optimizer.zero_grad(set_to_none=True)
            logits = classifier(batch_x)

            if tuple(logits.shape) != (len(batch_y), len(CLASS_NAMES)):
                raise RuntimeError(f"Logits train sai shape: {tuple(logits.shape)}")
            loss = criterion(logits, batch_y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * len(batch_y)
            total_seen += len(batch_y)

        train_loss = total_loss / max(total_seen, 1)
        train_acc, train_f1, _ = evaluate_classifier(classifier, X_train, y_train)
        val_acc, val_f1, _ = evaluate_classifier(classifier, X_val, y_val)
        scheduler.step(val_f1)
        lr = optimizer.param_groups[0]["lr"]

        history.append({
            "epoch": epoch,
            "train_loss": train_loss,
            "train_accuracy": train_acc,
            "train_macro_f1": train_f1,
            "val_accuracy": val_acc,
            "val_macro_f1": val_f1,
            "learning_rate": lr,
        })
        print(
            f"Epoch {epoch:02d}/{MAX_EPOCHS} | loss={train_loss:.4f} | "
            f"train_acc={train_acc:.4f} | train_F1={train_f1:.4f} | "
            f"val_acc={val_acc:.4f} | val_F1={val_f1:.4f} | lr={lr:.2e}"
        )

        if val_f1 > best_val_f1:
            best_val_f1 = val_f1
            best_epoch = epoch
            patience_counter = 0
            torch.save({
                "model_state_dict": classifier.state_dict(),
                "class_names": CLASS_NAMES,
                "image_size": IMAGE_SIZE,
                "feature_dim": 1280,
                "best_epoch": best_epoch,
                "best_val_macro_f1": best_val_f1,
                "cache_version": CACHE_VERSION,
            }, MODEL_PATH)
            print(f"  -> Đã lưu model tốt nhất: {MODEL_PATH}")
        else:
            patience_counter += 1

        if patience_counter >= EARLY_STOPPING_PATIENCE:
            print(f"\nEarly stopping sau {EARLY_STOPPING_PATIENCE} epoch không cải thiện.")
            break

    with HISTORY_PATH.open("w", newline="", encoding="utf-8-sig") as file:
        fields = [
            "epoch", "train_loss", "train_accuracy", "train_macro_f1",
            "val_accuracy", "val_macro_f1", "learning_rate",
        ]
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        writer.writerows(history)

    if not MODEL_PATH.exists():
        raise RuntimeError("Không tạo được checkpoint model.")

    checkpoint = torch.load(MODEL_PATH, map_location="cpu", weights_only=True)
    classifier.load_state_dict(checkpoint["model_state_dict"])
    test_acc, test_f1, test_confusion = evaluate_classifier(classifier, X_test, y_test)

    print("\n========== FINAL TEST RESULT ==========")
    print(f"Best epoch: {best_epoch}")
    print(f"Best validation Macro F1: {best_val_f1:.4f}")
    print(f"Test accuracy: {test_acc:.4f} ({test_acc * 100:.2f}%)")
    print(f"Test Macro F1: {test_f1:.4f}")
    print_confusion_matrix(test_confusion)
    print(f"\nModel: {MODEL_PATH}")
    print(f"History: {HISTORY_PATH}")
    print(f"Feature cache: {CACHE_DIR}")


if __name__ == "__main__":
    main()
