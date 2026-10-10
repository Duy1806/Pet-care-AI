from pathlib import Path
import copy
import time

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, WeightedRandomSampler
from torchvision import datasets, transforms, models
from torchvision.models import MobileNet_V3_Small_Weights

from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
import numpy as np
import matplotlib.pyplot as plt


# ============================================================
# 1. CONFIG
# ============================================================

DATA_DIR = Path(r"D:\DACN2\dataset\dataset_final")
MODEL_DIR = Path(r"D:\DACN2\models")

MODEL_DIR.mkdir(parents=True, exist_ok=True)

BATCH_SIZE = 16
NUM_EPOCHS = 15

# Giai đoạn 1: chỉ train classifier
LEARNING_RATE = 0.001

NUM_WORKERS = 0
PATIENCE = 4

DEVICE = torch.device("cpu")

print("=" * 60)
print("PET 5-CLASS CLASSIFICATION")
print("=" * 60)
print(f"Device      : {DEVICE}")
print(f"Dataset     : {DATA_DIR}")
print(f"Batch size  : {BATCH_SIZE}")
print(f"Epochs      : {NUM_EPOCHS}")
print("=" * 60)


# ============================================================
# 2. PREPROCESSING
# ============================================================

# Normalize theo ImageNet.
# Đây cũng là normalization được dùng với pretrained
# MobileNetV3-Small của TorchVision.

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


# Train:
# Có augmentation để model học được các biến thể của ảnh.
train_transform = transforms.Compose([
    transforms.RandomResizedCrop(
        224,
        scale=(0.8, 1.0)
    ),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.RandomRotation(10),
    transforms.ColorJitter(
        brightness=0.15,
        contrast=0.15,
        saturation=0.15
    ),
    transforms.ToTensor(),
    transforms.Normalize(
        IMAGENET_MEAN,
        IMAGENET_STD
    )
])


# Validation/Test:
# Không augmentation để đánh giá model công bằng.
eval_transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(
        IMAGENET_MEAN,
        IMAGENET_STD
    )
])


# ============================================================
# 3. LOAD DATASET
# ============================================================

train_dir = DATA_DIR / "train"
val_dir = DATA_DIR / "val"
test_dir = DATA_DIR / "test"


# Dataset của mình đang có:
#
# dataset_final/
# ├── dog/
# │   ├── train
# │   ├── val
# │   └── test
# ├── cat/
# ...
#
# ImageFolder cần cấu trúc:
#
# train/
# ├── dog
# ├── cat
# ...
#
# Vì dataset_final hiện tại đang có class trước split,
# ta tạo Dataset từ từng class rồi ghép lại.

class_names = ["bird", "cat", "dog", "hamster", "rabbit"]


def collect_split(split_name, transform):
    """
    Đọc ảnh từ:
    dataset_final/<class>/<split>
    """

    images = []
    labels = []

    for label, class_name in enumerate(class_names):
        folder = DATA_DIR / class_name / split_name

        if not folder.exists():
            raise FileNotFoundError(
                f"Không tìm thấy thư mục: {folder}"
            )

        # ImageFolder cần một thư mục class.
        # Ở đây dùng ImageFolder với một thư mục tạm logic:
        # thay vào đó tự đọc bằng ImageFolder từng class.
        temp_dataset = datasets.ImageFolder(
            str(DATA_DIR / class_name),
            transform=transform
        )

        # ImageFolder đang đọc:
        # DATA_DIR/class_name/<subfolder>
        #
        # Vì vậy ta lấy đúng split index bằng dataset riêng
        # bên dưới.

        split_folder = folder

        for file in split_folder.iterdir():
            if file.is_file() and file.suffix.lower() in {
                ".jpg", ".jpeg", ".png", ".webp", ".bmp"
            }:
                images.append((file, label))

    return PetDataset(images, transform)


class PetDataset(torch.utils.data.Dataset):

    def __init__(self, samples, transform=None):
        self.samples = samples
        self.transform = transform

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, index):
        path, label = self.samples[index]

        from PIL import Image

        image = Image.open(path).convert("RGB")

        if self.transform:
            image = self.transform(image)

        return image, label


train_dataset = collect_split("train", train_transform)
val_dataset = collect_split("val", eval_transform)
test_dataset = collect_split("test", eval_transform)


print("\nDataset:")
print(f"Train : {len(train_dataset)}")
print(f"Val   : {len(val_dataset)}")
print(f"Test  : {len(test_dataset)}")


# ============================================================
# 4. CLASS BALANCE
# ============================================================

# Đếm số ảnh từng class trong TRAIN.

train_labels = [label for _, label in train_dataset.samples]

class_counts = np.bincount(
    train_labels,
    minlength=len(class_names)
)

print("\nTraining class distribution:")

for name, count in zip(class_names, class_counts):
    print(f"{name:8s}: {count}")


# ------------------------------------------------------------
# WeightedRandomSampler
#
# Class ít ảnh sẽ được lấy thường xuyên hơn.
# Không tạo/copy thêm ảnh trên ổ đĩa.
# ------------------------------------------------------------

class_weights = 1.0 / class_counts

sample_weights = [
    class_weights[label]
    for label in train_labels
]

sample_weights = torch.DoubleTensor(sample_weights)

sampler = WeightedRandomSampler(
    weights=sample_weights,
    num_samples=len(sample_weights),
    replacement=True
)


# ============================================================
# 5. DATALOADER
# ============================================================

train_loader = DataLoader(
    train_dataset,
    batch_size=BATCH_SIZE,
    sampler=sampler,
    num_workers=NUM_WORKERS
)

val_loader = DataLoader(
    val_dataset,
    batch_size=BATCH_SIZE,
    shuffle=False,
    num_workers=NUM_WORKERS
)

test_loader = DataLoader(
    test_dataset,
    batch_size=BATCH_SIZE,
    shuffle=False,
    num_workers=NUM_WORKERS
)


# ============================================================
# 6. LOAD PRETRAINED MOBILENETV3-SMALL
# ============================================================

print("\nLoading MobileNetV3-Small...")

weights = MobileNet_V3_Small_Weights.DEFAULT

model = models.mobilenet_v3_small(
    weights=weights
)


# ============================================================
# 7. FREEZE BACKBONE
# ============================================================

# Giai đoạn đầu chỉ train classifier.
# Backbone pretrained được giữ nguyên.

for parameter in model.features.parameters():
    parameter.requires_grad = False


# ============================================================
# 8. CHANGE CLASSIFIER
# ============================================================

# MobileNetV3-Small classifier cuối có dạng:
#
# Linear(..., 1000)
#
# ImageNet có 1000 classes.
#
# Bài toán của mình chỉ có 5 classes.

in_features = model.classifier[-1].in_features

model.classifier[-1] = nn.Linear(
    in_features,
    len(class_names)
)

model = model.to(DEVICE)


print("\nModel:")
print(model.classifier)


# ============================================================
# 9. LOSS + OPTIMIZER
# ============================================================

criterion = nn.CrossEntropyLoss()

optimizer = torch.optim.AdamW(
    model.classifier.parameters(),
    lr=LEARNING_RATE,
    weight_decay=1e-4
)


# ============================================================
# 10. TRAIN / VALIDATION
# ============================================================

best_val_accuracy = 0.0
best_model_weights = copy.deepcopy(model.state_dict())

epochs_without_improvement = 0

history = {
    "train_loss": [],
    "train_acc": [],
    "val_loss": [],
    "val_acc": []
}


for epoch in range(NUM_EPOCHS):

    start_time = time.time()

    # --------------------------------------------------------
    # TRAIN
    # --------------------------------------------------------

    model.train()

    running_loss = 0.0
    correct = 0
    total = 0

    for images, labels in train_loader:

        images = images.to(DEVICE)
        labels = labels.to(DEVICE)

        optimizer.zero_grad()

        outputs = model(images)

        loss = criterion(
            outputs,
            labels
        )

        loss.backward()

        optimizer.step()

        running_loss += loss.item() * images.size(0)

        _, predictions = torch.max(
            outputs,
            1
        )

        total += labels.size(0)

        correct += (
            predictions == labels
        ).sum().item()

    train_loss = running_loss / total
    train_accuracy = correct / total


    # --------------------------------------------------------
    # VALIDATION
    # --------------------------------------------------------

    model.eval()

    val_loss_total = 0.0
    val_correct = 0
    val_total = 0

    with torch.no_grad():

        for images, labels in val_loader:

            images = images.to(DEVICE)
            labels = labels.to(DEVICE)

            outputs = model(images)

            loss = criterion(
                outputs,
                labels
            )

            val_loss_total += (
                loss.item() * images.size(0)
            )

            _, predictions = torch.max(
                outputs,
                1
            )

            val_total += labels.size(0)

            val_correct += (
                predictions == labels
            ).sum().item()

    val_loss = val_loss_total / val_total
    val_accuracy = val_correct / val_total


    # --------------------------------------------------------
    # SAVE HISTORY
    # --------------------------------------------------------

    history["train_loss"].append(train_loss)
    history["train_acc"].append(train_accuracy)

    history["val_loss"].append(val_loss)
    history["val_acc"].append(val_accuracy)


    elapsed = time.time() - start_time

    print(
        f"\nEpoch [{epoch + 1}/{NUM_EPOCHS}]"
    )

    print(
        f"Train Loss: {train_loss:.4f} | "
        f"Train Acc: {train_accuracy:.4f}"
    )

    print(
        f"Val Loss  : {val_loss:.4f} | "
        f"Val Acc  : {val_accuracy:.4f}"
    )

    print(
        f"Time      : {elapsed:.1f}s"
    )


    # --------------------------------------------------------
    # BEST MODEL
    # --------------------------------------------------------

    if val_accuracy > best_val_accuracy:

        best_val_accuracy = val_accuracy

        best_model_weights = copy.deepcopy(
            model.state_dict()
        )

        torch.save(
            {
                "model_state_dict": model.state_dict(),
                "class_names": class_names,
                "val_accuracy": val_accuracy
            },
            MODEL_DIR / "pet_5class_mobilenetv3_small_best.pth"
        )

        print(
            f"✓ Saved best model "
            f"(Val Acc: {val_accuracy:.4f})"
        )

        epochs_without_improvement = 0

    else:

        epochs_without_improvement += 1

        print(
            f"No improvement: "
            f"{epochs_without_improvement}/{PATIENCE}"
        )


    # --------------------------------------------------------
    # EARLY STOPPING
    # --------------------------------------------------------

    if epochs_without_improvement >= PATIENCE:

        print("\nEarly stopping.")

        break


# ============================================================
# 11. LOAD BEST MODEL
# ============================================================

model.load_state_dict(best_model_weights)

print(
    f"\nBest validation accuracy: "
    f"{best_val_accuracy:.4f}"
)


# ============================================================
# 12. TEST
# ============================================================

print("\nTesting best model...")

model.eval()

all_labels = []
all_predictions = []

with torch.no_grad():

    for images, labels in test_loader:

        images = images.to(DEVICE)

        outputs = model(images)

        _, predictions = torch.max(
            outputs,
            1
        )

        all_labels.extend(
            labels.numpy()
        )

        all_predictions.extend(
            predictions.numpy()
        )


# ============================================================
# 13. METRICS
# ============================================================

test_accuracy = accuracy_score(
    all_labels,
    all_predictions
)

print("\n" + "=" * 60)
print("TEST RESULT")
print("=" * 60)

print(
    f"Test Accuracy: {test_accuracy:.4f}"
)

print("\nClassification Report:")

print(
    classification_report(
        all_labels,
        all_predictions,
        target_names=class_names,
        digits=4
    )
)


# ============================================================
# 14. CONFUSION MATRIX
# ============================================================

cm = confusion_matrix(
    all_labels,
    all_predictions
)

print("\nConfusion Matrix:")
print(cm)


plt.figure(figsize=(7, 6))

plt.imshow(cm)

plt.title("Confusion Matrix - 5 Class Pet Classification")

plt.xlabel("Predicted")
plt.ylabel("Actual")

plt.xticks(
    range(len(class_names)),
    class_names,
    rotation=45
)

plt.yticks(
    range(len(class_names)),
    class_names
)

for i in range(len(class_names)):
    for j in range(len(class_names)):
        plt.text(
            j,
            i,
            cm[i, j],
            ha="center",
            va="center"
        )

plt.tight_layout()

cm_path = MODEL_DIR / "confusion_matrix.png"

plt.savefig(cm_path)

plt.close()


# ============================================================
# 15. TRAINING CURVES
# ============================================================

plt.figure(figsize=(8, 5))

plt.plot(
    history["train_acc"],
    label="Train Accuracy"
)

plt.plot(
    history["val_acc"],
    label="Validation Accuracy"
)

plt.xlabel("Epoch")
plt.ylabel("Accuracy")

plt.title("Training / Validation Accuracy")

plt.legend()

plt.tight_layout()

acc_path = MODEL_DIR / "accuracy_curve.png"

plt.savefig(acc_path)

plt.close()


# ============================================================
# 16. FINAL
# ============================================================

print("\n" + "=" * 60)
print("DONE")
print("=" * 60)

print(
    f"Best model: "
    f"{MODEL_DIR / 'pet_5class_mobilenetv3_small_best.pth'}"
)

print(
    f"Confusion matrix: {cm_path}"
)

print(
    f"Accuracy curve: {acc_path}"
)