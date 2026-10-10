
from pathlib import Path
from collections import Counter
import hashlib
import time
import csv

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from torchvision import models, transforms
from torchvision.models import EfficientNet_B0_Weights
from PIL import Image


# ============================================================
# 1. CONFIG
# ============================================================

DATA_DIR = Path(r"D:\DACN2\dataset\cat_breed")
MODEL_DIR = Path(r"D:\DACN2\models")
CACHE_DIR = MODEL_DIR / "cat_breed_feature_cache"

MODEL_PATH = MODEL_DIR / "cat_breed_efficientnet_b0_best.pth"
HISTORY_PATH = MODEL_DIR / "cat_breed_efficientnet_b0_history.csv"

DEVICE = torch.device("cpu")

IMAGE_SIZE = 160
RESIZE_SIZE = 176

FEATURE_BATCH_SIZE = 8
TRAIN_BATCH_SIZE = 128

MAX_EPOCHS = 30
PATIENCE = 5

LEARNING_RATE = 1e-3
WEIGHT_DECAY = 1e-4
LABEL_SMOOTHING = 0.05

CACHE_VERSION = 1

IMAGE_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".bmp", ".webp"
}

MODEL_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# 2. DATASET
# Supports:
# A. cat_breed/train/class_name/image.jpg
# B. cat_breed/class_name/train/image.jpg
# ============================================================

class CatBreedDataset(Dataset):
    def __init__(self, root, split, class_names, transform):
        self.root = root
        self.split = split
        self.class_names = class_names
        self.transform = transform
        self.samples = []

        if (root / "train").is_dir():
            # Layout A: split first
            split_dir = root / split

            if not split_dir.is_dir():
                raise FileNotFoundError(
                    f"Không tìm thấy thư mục: {split_dir}"
                )

            for label, class_name in enumerate(class_names):
                class_dir = split_dir / class_name

                if not class_dir.is_dir():
                    raise FileNotFoundError(
                        f"Thiếu thư mục giống mèo: {class_dir}"
                    )

                for path in sorted(class_dir.rglob("*")):
                    if (
                        path.is_file()
                        and path.suffix.lower() in IMAGE_EXTENSIONS
                    ):
                        self.samples.append((path, label))

        else:
            # Layout B: class first
            for label, class_name in enumerate(class_names):
                class_dir = root / class_name / split

                if not class_dir.is_dir():
                    raise FileNotFoundError(
                        f"Thiếu thư mục: {class_dir}"
                    )

                for path in sorted(class_dir.rglob("*")):
                    if (
                        path.is_file()
                        and path.suffix.lower() in IMAGE_EXTENSIONS
                    ):
                        self.samples.append((path, label))

        if not self.samples:
            raise RuntimeError(
                f"Không có ảnh trong split '{split}'. "
                f"Kiểm tra lại DATA_DIR và cấu trúc dataset."
            )

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
                f"Lỗi đọc ảnh: {path}"
            ) from exc

        return image, label


# ============================================================
# 3. PREPROCESSING
# ============================================================

transform = transforms.Compose([
    transforms.Resize((RESIZE_SIZE, RESIZE_SIZE)),
    transforms.CenterCrop(IMAGE_SIZE),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])


def discover_classes():
    if not DATA_DIR.is_dir():
        raise FileNotFoundError(
            f"Không tìm thấy dataset: {DATA_DIR}"
        )

    if (DATA_DIR / "train").is_dir():
        train_dir = DATA_DIR / "train"

        classes = sorted(
            p.name for p in train_dir.iterdir()
            if p.is_dir()
        )
    else:
        classes = sorted(
            p.name for p in DATA_DIR.iterdir()
            if p.is_dir()
            and (p / "train").is_dir()
        )

    if len(classes) < 2:
        raise RuntimeError(
            "Không tìm thấy đủ các thư mục giống mèo. "
            "Hãy kiểm tra cấu trúc dataset."
        )

    return classes


# ============================================================
# 4. BUILD DATASETS
# ============================================================

def build_datasets():
    class_names = discover_classes()

    datasets = {
        split: CatBreedDataset(
            DATA_DIR, split, class_names, transform
        )
        for split in ["train", "val", "test"]
    }

    return class_names, datasets


# ============================================================
# 5. EFFICIENTNET-B0 FEATURE EXTRACTOR
# ============================================================

def build_backbone():
    print("\nĐang tải EfficientNet-B0 pretrained...")

    weights = EfficientNet_B0_Weights.DEFAULT
    model = models.efficientnet_b0(weights=weights)
    model = model.to(DEVICE)
    model.eval()

    for parameter in model.parameters():
        parameter.requires_grad = False

    return model


@torch.inference_mode()
def extract_features(backbone, dataset, split):
    cache_path = CACHE_DIR / f"{split}_features.pt"

    # Check whether the cache matches the current images.
    digest = hashlib.sha256()
    digest.update(str(CACHE_VERSION).encode())
    digest.update(str(IMAGE_SIZE).encode())

    for path, label in dataset.samples:
        stat = path.stat()
        digest.update(
            f"{path}|{stat.st_size}|{stat.st_mtime_ns}|{label}\n"
            .encode("utf-8")
        )

    fingerprint = digest.hexdigest()

    if cache_path.exists():
        try:
            cached = torch.load(
                cache_path,
                map_location="cpu",
                weights_only=True
            )

            if cached.get("fingerprint") == fingerprint:
                print(f"\n[CACHE] Dùng lại {split}: {cache_path}")
                return cached["features"], cached["labels"]

        except Exception:
            print(f"[CACHE] Cache {split} không hợp lệ, tạo lại.")

    print(f"\n[FEATURE] {split}: {len(dataset)} ảnh")
    start = time.time()

    loader = DataLoader(
        dataset,
        batch_size=FEATURE_BATCH_SIZE,
        shuffle=False,
        num_workers=0
    )

    all_features = []
    all_labels = []

    for batch_idx, (images, labels) in enumerate(loader, start=1):
        images = images.to(DEVICE)

        features = backbone.features(images)
        features = backbone.avgpool(features)
        features = torch.flatten(features, 1)

        all_features.append(features.cpu())
        all_labels.append(labels.cpu())

        if batch_idx % 100 == 0 or batch_idx == len(loader):
            print(
                f"  Batch {batch_idx}/{len(loader)}"
            )

    features = torch.cat(all_features, dim=0)
    labels = torch.cat(all_labels, dim=0)

    torch.save({
        "fingerprint": fingerprint,
        "features": features,
        "labels": labels
    }, cache_path)

    print(
        f"[CACHE] Đã lưu {split} sau "
        f"{time.time() - start:.1f}s"
    )

    return features, labels


# ============================================================
# 6. METRICS
# ============================================================

def calculate_metrics(y_true, y_pred, num_classes):
    y_true = y_true.long().cpu()
    y_pred = y_pred.long().cpu()

    encoded = y_true * num_classes + y_pred

    matrix = torch.bincount(
        encoded,
        minlength=num_classes * num_classes
    ).reshape(num_classes, num_classes)

    accuracy = (
        matrix.diag().sum().item()
        / max(matrix.sum().item(), 1)
    )

    true_positive = matrix.diag().float()
    actual_count = matrix.sum(dim=1).float()
    predicted_count = matrix.sum(dim=0).float()

    precision = true_positive / predicted_count.clamp(min=1)
    recall = true_positive / actual_count.clamp(min=1)

    f1 = (
        2 * precision * recall
        / (precision + recall).clamp(min=1e-12)
    )

    # Macro F1 over all classes, including classes with no predictions.
    macro_f1 = f1.mean().item()

    return accuracy, macro_f1, matrix


# ============================================================
# 7. TRAINING
# ============================================================

def train():
    print("=" * 65)
    print("CAT BREED CLASSIFICATION - EFFICIENTNET-B0")
    print(f"Dataset: {DATA_DIR}")
    print(f"Device: {DEVICE}")
    print(f"Epoch tối đa: {MAX_EPOCHS}")
    print("=" * 65)

    class_names, datasets = build_datasets()
    num_classes = len(class_names)

    print(f"\nSố giống mèo: {num_classes}")
    print("Danh sách giống:")

    for name in class_names:
        print(f"  - {name}")

    backbone = build_backbone()

    features = {}
    labels = {}

    for split in ["train", "val", "test"]:
        features[split], labels[split] = extract_features(
            backbone,
            datasets[split],
            split
        )

    print(
        f"\nSố ảnh: train={len(labels['train'])}, "
        f"val={len(labels['val'])}, "
        f"test={len(labels['test'])}"
    )

    del backbone

    # Balanced sampling helps when breeds have unequal image counts.
    class_counts = torch.bincount(
        labels["train"],
        minlength=num_classes
    ).float()

    sample_weights = (
        1.0 / class_counts.clamp(min=1)
    )[labels["train"]]

    sampler = WeightedRandomSampler(
        weights=sample_weights.double(),
        num_samples=len(sample_weights),
        replacement=True
    )

    train_loader = DataLoader(
        torch.utils.data.TensorDataset(
            features["train"], labels["train"]
        ),
        batch_size=TRAIN_BATCH_SIZE,
        sampler=sampler
    )

    val_loader = DataLoader(
        torch.utils.data.TensorDataset(
            features["val"], labels["val"]
        ),
        batch_size=TRAIN_BATCH_SIZE,
        shuffle=False
    )

    test_loader = DataLoader(
        torch.utils.data.TensorDataset(
            features["test"], labels["test"]
        ),
        batch_size=TRAIN_BATCH_SIZE,
        shuffle=False
    )

    classifier = nn.Sequential(
        nn.Dropout(0.2),
        nn.Linear(1280, num_classes)
    ).to(DEVICE)

    criterion = nn.CrossEntropyLoss(
        label_smoothing=LABEL_SMOOTHING
    )

    optimizer = torch.optim.AdamW(
        classifier.parameters(),
        lr=LEARNING_RATE,
        weight_decay=WEIGHT_DECAY
    )

    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer,
        mode="max",
        factor=0.5,
        patience=2,
        min_lr=1e-5
    )

    best_val_f1 = -1.0
    best_epoch = 0
    epochs_without_improvement = 0
    history = []

    print("\n========== TRAIN CAT BREEDS ==========")

    for epoch in range(1, MAX_EPOCHS + 1):
        start = time.time()
        classifier.train()

        total_loss = 0.0
        train_true = []
        train_pred = []

        for x, y in train_loader:
            x = x.to(DEVICE)
            y = y.to(DEVICE)

            optimizer.zero_grad(set_to_none=True)

            logits = classifier(x)
            loss = criterion(logits, y)

            loss.backward()
            optimizer.step()

            total_loss += loss.item() * len(y)

            train_true.append(y.detach().cpu())
            train_pred.append(
                logits.argmax(dim=1).detach().cpu()
            )

        train_true = torch.cat(train_true)
        train_pred = torch.cat(train_pred)

        train_acc, train_f1, _ = calculate_metrics(
            train_true, train_pred, num_classes
        )

        classifier.eval()
        val_true = []
        val_pred = []

        with torch.inference_mode():
            for x, y in val_loader:
                logits = classifier(x.to(DEVICE))
                val_true.append(y)
                val_pred.append(logits.argmax(dim=1).cpu())

        val_true = torch.cat(val_true)
        val_pred = torch.cat(val_pred)

        val_acc, val_f1, _ = calculate_metrics(
            val_true, val_pred, num_classes
        )

        scheduler.step(val_f1)
        current_lr = optimizer.param_groups[0]["lr"]
        average_loss = total_loss / len(labels["train"])

        print(
            f"Epoch {epoch:02d}/{MAX_EPOCHS} | "
            f"loss={average_loss:.4f} | "
            f"train_acc={train_acc:.4f} | "
            f"train_F1={train_f1:.4f} | "
            f"val_acc={val_acc:.4f} | "
            f"val_F1={val_f1:.4f} | "
            f"lr={current_lr:.2e} | "
            f"time={time.time() - start:.1f}s"
        )

        history.append({
            "epoch": epoch,
            "loss": average_loss,
            "train_accuracy": train_acc,
            "train_macro_f1": train_f1,
            "val_accuracy": val_acc,
            "val_macro_f1": val_f1,
            "learning_rate": current_lr
        })

        if val_f1 > best_val_f1 + 1e-6:
            best_val_f1 = val_f1
            best_epoch = epoch
            epochs_without_improvement = 0

            torch.save({
                "model_state_dict": classifier.state_dict(),
                "class_names": class_names,
                "num_classes": num_classes,
                "model_name": "efficientnet_b0",
                "task": "cat_breed_classification",
                "image_size": IMAGE_SIZE,
                "resize_size": RESIZE_SIZE,
                "best_epoch": best_epoch,
                "best_val_macro_f1": best_val_f1,
                "cache_version": CACHE_VERSION
            }, MODEL_PATH)

            print(f"  -> Đã lưu model tốt nhất: {MODEL_PATH}")

        else:
            epochs_without_improvement += 1

        if epochs_without_improvement >= PATIENCE:
            print(
                f"\nEarly Stopping: validation Macro F1 "
                f"không cải thiện sau {PATIENCE} epoch."
            )
            break

    # Save training history.
    with open(
        HISTORY_PATH, "w", newline="", encoding="utf-8-sig"
    ) as file:
        writer = csv.DictWriter(
            file,
            fieldnames=history[0].keys()
        )
        writer.writeheader()
        writer.writerows(history)

    # ========================================================
    # 8. FINAL TEST - BEST CHECKPOINT
    # ========================================================

    checkpoint = torch.load(
        MODEL_PATH,
        map_location=DEVICE,
        weights_only=True
    )

    classifier.load_state_dict(checkpoint["model_state_dict"])
    classifier.eval()

    test_true = []
    test_pred = []

    with torch.inference_mode():
        for x, y in test_loader:
            logits = classifier(x.to(DEVICE))
            test_true.append(y)
            test_pred.append(logits.argmax(dim=1).cpu())

    test_true = torch.cat(test_true)
    test_pred = torch.cat(test_pred)

    test_acc, test_f1, matrix = calculate_metrics(
        test_true, test_pred, num_classes
    )

    print("\n========== FINAL TEST RESULT ==========")
    print(f"Best epoch: {best_epoch}")
    print(f"Best validation Macro F1: {best_val_f1:.4f}")
    print(f"Test Accuracy: {test_acc:.4f} ({test_acc * 100:.2f}%)")
    print(f"Test Macro F1: {test_f1:.4f}")

    print("\nConfusion matrix (hàng=nhãn thật, cột=dự đoán):")
    print(" " * 22 + " ".join(
        f"{name[:9]:>9}" for name in class_names
    ))

    for name, row in zip(class_names, matrix.tolist()):
        print(f"{name[:21]:>21} " + " ".join(
            f"{value:9d}" for value in row
        ))

    print(f"\nModel: {MODEL_PATH}")
    print(f"History: {HISTORY_PATH}")
    print(f"Cache: {CACHE_DIR}")


if __name__ == "__main__":
    torch.manual_seed(42)
    train()