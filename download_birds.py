from datasets import load_dataset
from pathlib import Path
from PIL import Image

# 10 class cần lấy
TARGET_CLASSES = {
    "ALEXANDRINE PARAKEET",
    "CANARY",
    "COCKATOO",
    "EASTERN ROSELLA",
    "GOLDEN PARAKEET",
    "GOULDIAN FINCH",
    "HYACINTH MACAW",
    "JAVA SPARROW",
    "RAINBOW LORIKEET",
    "ROSY FACED LOVEBIRD",
}

# Số ảnh tối đa mỗi class
MAX_IMAGES_PER_CLASS = 150

OUTPUT_DIR = Path(r"D:\DACN2\bird_dataset")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

counts = {name: 0 for name in TARGET_CLASSES}

print("Đang mở Birds-525 ở chế độ streaming...")

dataset = load_dataset(
    "yashikota/birds-525-species-image-classification",
    split="train",
    streaming=True,
)

for item in dataset:
    label = item["label"]

    # Nếu label trả về số thì lấy tên class
    if isinstance(label, int):
        label = dataset.features["label"].names[label]

    if label not in TARGET_CLASSES:
        continue

    if counts[label] >= MAX_IMAGES_PER_CLASS:
        if all(count >= MAX_IMAGES_PER_CLASS for count in counts.values()):
            break
        continue

    class_dir = OUTPUT_DIR / label
    class_dir.mkdir(parents=True, exist_ok=True)

    image = item["image"]

    file_path = class_dir / f"{counts[label] + 1:04d}.jpg"
    image.convert("RGB").save(file_path, quality=95)

    counts[label] += 1

    print(f"{label}: {counts[label]}/{MAX_IMAGES_PER_CLASS}")

print("\n===== HOÀN TẤT =====")

for label, count in counts.items():
    print(f"{label}: {count} ảnh")