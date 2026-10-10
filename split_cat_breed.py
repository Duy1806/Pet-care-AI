from pathlib import Path
import random
import shutil

DATA_DIR = Path(r"D:\DACN2\dataset\cat_breed")

VAL_RATIO = 0.2
SEED = 42

random.seed(SEED)

train_dir = DATA_DIR / "train"
val_dir = DATA_DIR / "val"

val_dir.mkdir(exist_ok=True)

total_moved = 0

for breed_dir in sorted(train_dir.iterdir()):

    if not breed_dir.is_dir():
        continue

    breed = breed_dir.name

    images = [
        p for p in breed_dir.iterdir()
        if p.suffix.lower() in [".jpg", ".jpeg", ".png", ".webp", ".bmp"]
    ]

    random.shuffle(images)

    val_count = int(len(images) * VAL_RATIO)

    val_breed_dir = val_dir / breed
    val_breed_dir.mkdir(parents=True, exist_ok=True)

    selected = images[:val_count]

    for image in selected:
        shutil.move(
            str(image),
            str(val_breed_dir / image.name)
        )

    total_moved += len(selected)

    print(
        f"{breed:25s} "
        f"train={len(images) - val_count:3d} "
        f"val={val_count:3d}"
    )

print()
print("=" * 60)
print("HOÀN THÀNH CHIA TRAIN / VAL")
print("=" * 60)
print(f"Đã chuyển sang validation: {total_moved}")
print("=" * 60)