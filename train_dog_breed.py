
from __future__ import annotations

import csv
import hashlib
import random
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from PIL import Image, ImageFile
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from torchvision import models, transforms


# =========================================================
# CONFIG
# =========================================================
DATA_DIR = Path(r"D:\DACN2\dataset\dog_breed")
MODEL_DIR = Path(r"D:\DACN2\models")
CACHE_DIR = MODEL_DIR / "dog_breed_feature_cache"

MODEL_PATH = MODEL_DIR / "dog_breed_efficientnet_b0_best.pth"
HISTORY_PATH = MODEL_DIR / "dog_breed_efficientnet_b0_history.csv"

IMAGE_SIZE = 160
RESIZE_SIZE = 176
FEATURE_BATCH_SIZE = 8
TRAIN_BATCH_SIZE = 128

MAX_EPOCHS = 30
PATIENCE = 5
LEARNING_RATE = 1e-3
WEIGHT_DECAY = 1e-4
SEED = 42

DEVICE = torch.device("cpu")
EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
CACHE_VERSION = "dog-breed-effb0-v1"

MODEL_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

torch.set_num_threads(2)
ImageFile.LOAD_TRUNCATED_IMAGES = True


def set_seed():
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)


def get_transform():
    return transforms.Compose([
        transforms.Resize(RESIZE_SIZE),
        transforms.CenterCrop(IMAGE_SIZE),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
    ])


def list_images(folder: Path):
    if not folder.is_dir():
        return []
    return sorted(
        p for p in folder.rglob("*")
        if p.is_file() and p.suffix.lower() in EXTENSIONS
    )


def detect_layout(root: Path):
    """
    Supported:
    A. root/train/class_name/image.jpg
    B. root/class_name/train/image.jpg
    """
    if not root.is_dir():
        raise FileNotFoundError(
            f"Không tìm thấy dataset: {root}\n"
            "Hãy sửa DATA_DIR cho đúng thư mục chứa dataset giống chó."
        )

    # Layout A: split-first
    train_dir = root / "train"
    if train_dir.is_dir():
        classes = sorted(
            p.name for p in train_dir.iterdir()
            if p.is_dir() and list_images(p)
        )
        if classes:
            for split in ("val", "test"):
                if not (root / split).is_dir():
                    raise FileNotFoundError(
                        f"Thiếu thư mục: {root / split}"
                    )
            return "split_first", classes

    # Layout B: class-first
    classes = []
    for folder in sorted(root.iterdir()):
        if not folder.is_dir():
            continue
        if folder.name.lower() in {"train", "val", "test"}:
            continue
        if any((folder / s).is_dir() for s in ("train", "val", "test")):
            classes.append(folder.name)

    if classes:
        for split in ("train", "val", "test"):
            if not any(list_images(root / c / split) for c in classes):
                raise FileNotFoundError(
                    f"Không tìm thấy ảnh cho split '{split}'"
                )
        return "class_first", classes

    raise RuntimeError(
        f"Không nhận diện được cấu trúc dataset tại {root}.\n"
        "Cần train/<giống>/ảnh hoặc <giống>/train/ảnh."
    )


class DogDataset(Dataset):
    def __init__(self, root, split, layout, classes):
        self.transform = get_transform()
        self.samples = []
        self.classes = classes

        for label, breed in enumerate(classes):
            if layout == "split_first":
                folder = root / split / breed
            else:
                folder = root / breed / split

            for image_path in list_images(folder):
                self.samples.append((image_path, label))

        if not self.samples:
            raise RuntimeError(f"Tập {split} không có ảnh.")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, index):
        path, label = self.samples[index]

        try:
            with Image.open(path) as image:
                image = image.convert("RGB")
                image = self.transform(image)
        except Exception as exc:
            raise RuntimeError(
                f"Không đọc được ảnh:\n{path}\nLỗi: {exc}"
            ) from exc

        return image, label


def make_fingerprint(dataset, classes):
    digest = hashlib.sha256()
    digest.update(CACHE_VERSION.encode())
    digest.update("|".join(classes).encode())

    for path, label in dataset.samples:
        stat = path.stat()
        digest.update(
            f"{path}|{label}|{stat.st_size}|{stat.st_mtime_ns}\n".encode(
                "utf-8", errors="replace"
            )
        )

    return digest.hexdigest()


def build_backbone():
    print("\nĐang tải EfficientNet-B0 pretrained...")

    model = models.efficientnet_b0(
        weights=models.EfficientNet_B0_Weights.DEFAULT
    ).to(DEVICE)

    model.eval()

    for parameter in model.parameters():
        parameter.requires_grad = False

    return model


@torch.inference_mode()
def extract_features(split, layout, classes, backbone):
    dataset = DogDataset(DATA_DIR, split, layout, classes)
    fingerprint = make_fingerprint(dataset, classes)

    cache_path = CACHE_DIR / (
        f"{split}_{fingerprint[:16]}.pt"
    )

    if cache_path.exists():
        try:
            cached = torch.load(
                cache_path,
                map_location="cpu",
                weights_only=True,
            )

            x = cached["features"].float().contiguous()
            y = cached["labels"].long().contiguous()

            if (
                x.shape == (len(dataset), 1280)
                and y.shape == (len(dataset),)
                and (
                    y.numel() == 0
                    or (
                        y.min().item() >= 0
                        and y.max().item() < len(classes)
                    )
                )
            ):
                print(f"[CACHE] {split}: dùng lại {len(y)} ảnh")
                return x, y

        except Exception as exc:
            print(f"[CACHE] Cache lỗi, tạo lại: {exc}")

    loader = DataLoader(
        dataset,
        batch_size=FEATURE_BATCH_SIZE,
        shuffle=False,
        num_workers=0,
    )

    feature_batches = []
    label_batches = []

    print(f"\n[FEATURE] {split}: {len(dataset)} ảnh")
    start_time = time.time()

    backbone.eval()

    for i, (images, labels) in enumerate(loader, start=1):
        output = backbone.features(images.to(DEVICE))
        output = backbone.avgpool(output)
        output = torch.flatten(output, 1)

        feature_batches.append(output.cpu().float())
        label_batches.append(labels.cpu().long())

        if i % 100 == 0 or i == len(loader):
            print(f"  Batch {i}/{len(loader)}")

    x = torch.cat(feature_batches).contiguous()
    y = torch.cat(label_batches).contiguous()

    if x.shape != (len(dataset), 1280):
        raise RuntimeError(f"Features sai shape: {tuple(x.shape)}")

    if y.shape != (len(dataset),):
        raise RuntimeError(f"Labels sai shape: {tuple(y.shape)}")

    torch.save({
        "features": x,
        "labels": y,
        "fingerprint": fingerprint,
        "classes": classes,
        "cache_version": CACHE_VERSION,
    }, cache_path)

    print(
        f"[CACHE] Đã lưu {split} sau "
        f"{time.time() - start_time:.1f}s"
    )

    return x, y


def calculate_metrics(logits, labels, num_classes):
    if logits.ndim != 2:
        raise RuntimeError(f"Logits sai shape: {tuple(logits.shape)}")

    if logits.shape != (len(labels), num_classes):
        raise RuntimeError(
            f"Logits cần {(len(labels), num_classes)}, "
            f"nhưng nhận {tuple(logits.shape)}"
        )

    if labels.ndim != 1 or len(labels) != len(logits):
        raise RuntimeError("Số lượng labels và logits không khớp.")

    if labels.numel() and (
        labels.min().item() < 0
        or labels.max().item() >= num_classes
    ):
        raise RuntimeError("Nhãn thật nằm ngoài phạm vi lớp.")

    predictions = logits.argmax(dim=1)

    confusion = torch.bincount(
        labels.long() * num_classes + predictions.long(),
        minlength=num_classes * num_classes,
    ).reshape(num_classes, num_classes)

    accuracy = (predictions == labels).float().mean().item()

    true_positive = confusion.diag().float()
    precision = true_positive / confusion.sum(0).float().clamp_min(1)
    recall = true_positive / confusion.sum(1).float().clamp_min(1)

    f1 = (
        2 * precision * recall
        / (precision + recall).clamp_min(1e-12)
    )

    return accuracy, f1.mean().item(), confusion


def evaluate(classifier, features, labels, num_classes):
    classifier.eval()
    logits_batches = []

    with torch.inference_mode():
        for start in range(0, len(features), TRAIN_BATCH_SIZE):
            batch_x = features[start:start + TRAIN_BATCH_SIZE].float()
            logits = classifier(batch_x)

            expected = (len(batch_x), num_classes)

            if tuple(logits.shape) != expected:
                raise RuntimeError(
                    f"Output classifier sai shape: {tuple(logits.shape)}"
                )

            logits_batches.append(logits)

    logits = torch.cat(logits_batches, dim=0)

    return calculate_metrics(logits, labels, num_classes)


class DogClassifier(nn.Module):
    def __init__(self, num_classes):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Dropout(p=0.2),
            nn.Linear(1280, num_classes),
        )

    def forward(self, x):
        return self.layers(x)


def main():
    set_seed()

    print("=" * 65)
    print("DOG BREED CLASSIFICATION - EFFICIENTNET-B0")
    print(f"Dataset: {DATA_DIR}")
    print(f"Device: {DEVICE}")
    print(f"Epoch tối đa: {MAX_EPOCHS}")
    print("=" * 65)

    layout, classes = detect_layout(DATA_DIR)
    num_classes = len(classes)

    if num_classes < 2:
        raise RuntimeError(
            f"Dataset chỉ phát hiện {num_classes} lớp: {classes}"
        )

    print(f"Cấu trúc dataset: {layout}")
    print(f"Số giống chó: {num_classes}")
    print("Danh sách giống:")
    for name in classes:
        print(f"  - {name}")

    backbone = build_backbone()

    train_x, train_y = extract_features(
        "train", layout, classes, backbone
    )
    val_x, val_y = extract_features(
        "val", layout, classes, backbone
    )
    test_x, test_y = extract_features(
        "test", layout, classes, backbone
    )

    print(
        f"\nSố ảnh: train={len(train_y)}, "
        f"val={len(val_y)}, test={len(test_y)}"
    )

    counts = torch.bincount(train_y, minlength=num_classes).float()

    if (counts == 0).any():
        missing = [
            classes[i] for i, count in enumerate(counts) if count == 0
        ]
        raise RuntimeError(f"Thiếu ảnh train ở các lớp: {missing}")

    sample_weights = (1.0 / counts)[train_y]

    sampler = WeightedRandomSampler(
        sample_weights.double(),
        num_samples=len(train_y),
        replacement=True,
    )

    train_loader = DataLoader(
        torch.utils.data.TensorDataset(train_x.float(), train_y.long()),
        batch_size=TRAIN_BATCH_SIZE,
        sampler=sampler,
        num_workers=0,
    )

    classifier = DogClassifier(num_classes).to(DEVICE)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.05)

    optimizer = torch.optim.AdamW(
        classifier.parameters(),
        lr=LEARNING_RATE,
        weight_decay=WEIGHT_DECAY,
    )

    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer,
        mode="max",
        factor=0.5,
        patience=2,
    )

    best_f1 = -1.0
    best_epoch = 0
    wait = 0
    history = []

    print("\n========== TRAIN DOG BREEDS ==========")

    for epoch in range(1, MAX_EPOCHS + 1):
        classifier.train()
        total_loss = 0.0
        total_seen = 0

        for batch_x, batch_y in train_loader:
            optimizer.zero_grad(set_to_none=True)

            logits = classifier(batch_x.float())

            if tuple(logits.shape) != (len(batch_y), num_classes):
                raise RuntimeError(
                    f"Logits train sai shape: {tuple(logits.shape)}"
                )

            loss = criterion(logits, batch_y.long())
            loss.backward()
            optimizer.step()

            total_loss += loss.item() * len(batch_y)
            total_seen += len(batch_y)

        train_loss = total_loss / max(total_seen, 1)

        train_acc, train_f1, _ = evaluate(
            classifier, train_x, train_y, num_classes
        )

        val_acc, val_f1, _ = evaluate(
            classifier, val_x, val_y, num_classes
        )

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
            f"Epoch {epoch:02d}/{MAX_EPOCHS} | "
            f"loss={train_loss:.4f} | "
            f"train_acc={train_acc:.4f} | "
            f"train_F1={train_f1:.4f} | "
            f"val_acc={val_acc:.4f} | "
            f"val_F1={val_f1:.4f} | "
            f"lr={lr:.2e}"
        )

        if val_f1 > best_f1:
            best_f1 = val_f1
            best_epoch = epoch
            wait = 0

            torch.save({
                "model_state_dict": classifier.state_dict(),
                "class_names": classes,
                "task_name": "dog_breed",
                "backbone": "efficientnet_b0",
                "image_size": IMAGE_SIZE,
                "feature_dim": 1280,
                "best_epoch": best_epoch,
                "best_val_macro_f1": best_f1,
                "cache_version": CACHE_VERSION,
            }, MODEL_PATH)

            print(f"  -> Đã lưu model tốt nhất: {MODEL_PATH}")

        else:
            wait += 1

        if wait >= PATIENCE:
            print(
                f"\nEarly Stopping: validation Macro F1 "
                f"không cải thiện sau {PATIENCE} epoch."
            )
            break

    with HISTORY_PATH.open(
        "w", newline="", encoding="utf-8-sig"
    ) as file:
        fields = [
            "epoch",
            "train_loss",
            "train_accuracy",
            "train_macro_f1",
            "val_accuracy",
            "val_macro_f1",
            "learning_rate",
        ]
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        writer.writerows(history)

    checkpoint = torch.load(
        MODEL_PATH,
        map_location="cpu",
        weights_only=True,
    )
    classifier.load_state_dict(checkpoint["model_state_dict"])

    test_acc, test_f1, confusion = evaluate(
        classifier, test_x, test_y, num_classes
    )

    print("\n========== FINAL TEST RESULT ==========")
    print(f"Best epoch: {best_epoch}")
    print(f"Best validation Macro F1: {best_f1:.4f}")
    print(f"Test Accuracy: {test_acc:.4f} ({test_acc * 100:.2f}%)")
    print(f"Test Macro F1: {test_f1:.4f}")

    print("\nConfusion matrix (hàng=nhãn thật, cột=dự đoán):")
    print(" " * 20 + " ".join(f"{c[:8]:>9}" for c in classes))
    for i, name in enumerate(classes):
        values = " ".join(f"{int(v):>9}" for v in confusion[i])
        print(f"{name[:18]:>18}  {values}")

    print(f"\nModel: {MODEL_PATH}")
    print(f"History: {HISTORY_PATH}")
    print(f"Cache: {CACHE_DIR}")


if __name__ == "__main__":
    main()