from pathlib import Path
import shutil

# =========================
# PATH
# =========================
BASE_DIR = Path(r"D:\DACN2\dataset\dog and cat")

LIST_FILE = BASE_DIR / "annotations" / "annotations" / "list.txt"
IMAGE_DIR = BASE_DIR / "images" / "images"

OUTPUT_DIR = Path(r"D:\DACN2\dataset\dog_breed")

# =========================
# DOG BREED IDs
# =========================
DOG_BREEDS = {
    1: "american_bulldog",
    2: "american_pit_bull_terrier",
    3: "basset_hound",
    4: "beagle",
    5: "boxer",
    8: "english_setter",
    10: "great_pyrenees",
    11: "havanese",
    12: "japanese_chin",
    13: "keeshond",
    14: "leonberger",
    15: "miniature_pinscher",
    16: "newfoundland",
    17: "pomeranian",
    18: "pug",
    19: "saint_bernard",
    20: "samoyed",
    21: "scottish_terrier",
    22: "shiba_inu",
    23: "staffordshire_bull_terrier",
    24: "wheaten_terrier",
    25: "yorkshire_terrier",
    9: "german_shorthaired",
    7: "english_cocker_spaniel",
    6: "chihuahua",
}

# =========================
# CREATE FOLDERS
# =========================
for split in ["train", "val", "test"]:
    for breed in DOG_BREEDS.values():
        (OUTPUT_DIR / split / breed).mkdir(
            parents=True,
            exist_ok=True
        )

# =========================
# READ ORIGINAL SPLITS
# =========================
trainval_file = BASE_DIR / "annotations" / "annotations" / "trainval.txt"
test_file = BASE_DIR / "annotations" / "annotations" / "test.txt"

trainval_names = set()

with open(trainval_file, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()

        if not line or line.startswith("#"):
            continue

        parts = line.split()

        if parts:
            trainval_names.add(parts[0])

test_names = set()

with open(test_file, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()

        if not line or line.startswith("#"):
            continue

        parts = line.split()

        if parts:
            test_names.add(parts[0])

# =========================
# READ LIST.TXT
# =========================
copied = 0
skipped = 0

with open(LIST_FILE, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()

        if not line or line.startswith("#"):
            continue

        parts = line.split()

        if len(parts) < 4:
            continue

        image_name = parts[0]
        species_id = int(parts[2])
        breed_id = int(parts[3])

        # Chỉ lấy DOG
        if species_id != 2:
            continue

        # Chỉ lấy 25 dog breeds
        if breed_id not in DOG_BREEDS:
            continue

        breed_name = DOG_BREEDS[breed_id]

        source = IMAGE_DIR / f"{image_name}.jpg"

        if not source.exists():
            print(f"[SKIP] Không tìm thấy: {source}")
            skipped += 1
            continue

        # Xác định split
        if image_name in test_names:
            split = "test"
        elif image_name in trainval_names:
            # Oxford trainval sẽ được chia lại thành train/val
            # ở bước tiếp theo.
            split = "train"
        else:
            print(f"[SKIP] Không xác định split: {image_name}")
            skipped += 1
            continue

        destination = (
            OUTPUT_DIR
            / split
            / breed_name
            / f"{image_name}.jpg"
        )

        shutil.copy2(source, destination)

        copied += 1

print()
print("=" * 60)
print("HOÀN THÀNH COPY DOG BREED")
print("=" * 60)
print(f"Đã copy: {copied}")
print(f"Bỏ qua:  {skipped}")
print(f"Output:  {OUTPUT_DIR}")
print("=" * 60)