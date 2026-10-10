from pathlib import Path
import shutil

# =========================
# PATH
# =========================
BASE_DIR = Path(r"D:\DACN2\dataset\dog and cat")

LIST_FILE = BASE_DIR / "annotations" / "annotations" / "list.txt"
IMAGE_DIR = BASE_DIR / "images" / "images"

OUTPUT_DIR = Path(r"D:\DACN2\dataset\cat_breed")

# =========================
# CAT BREED IDs
# =========================
CAT_BREEDS = {
    1: "abyssinian",
    2: "bengal",
    3: "birman",
    4: "bombay",
    5: "british_shorthair",
    6: "egyptian_mau",
    7: "maine_coon",
    8: "persian",
    9: "ragdoll",
    10: "russian_blue",
    11: "siamese",
    12: "sphynx",
}

# =========================
# CREATE FOLDERS
# =========================
for split in ["train", "val", "test"]:
    for breed in CAT_BREEDS.values():
        (OUTPUT_DIR / split / breed).mkdir(
            parents=True,
            exist_ok=True
        )

# =========================
# ORIGINAL SPLITS
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

        # Chỉ lấy CAT
        if species_id != 1:
            continue

        # Chỉ lấy 12 cat breeds
        if breed_id not in CAT_BREEDS:
            continue

        breed_name = CAT_BREEDS[breed_id]

        source = IMAGE_DIR / f"{image_name}.jpg"

        if not source.exists():
            print(f"[SKIP] Không tìm thấy: {source}")
            skipped += 1
            continue

        # Xác định split
        if image_name in test_names:
            split = "test"
        elif image_name in trainval_names:
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
print("HOÀN THÀNH COPY CAT BREED")
print("=" * 60)
print(f"Đã copy: {copied}")
print(f"Bỏ qua:  {skipped}")
print(f"Output:  {OUTPUT_DIR}")
print("=" * 60)