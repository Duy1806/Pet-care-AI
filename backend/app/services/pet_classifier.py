import json
from functools import lru_cache
from pathlib import Path

import torch
from PIL import Image, ImageOps
from torchvision import transforms
from torchvision.models import efficientnet_b0


# ============================================================
# 1. CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BASE_DIR.parent
MODEL_DIR = PROJECT_DIR / "models"

MODEL_PATH = (
    MODEL_DIR / "37_class" / "efficientnet_b0_37class_best.pth"
)

MAPPING_PATH = (
    MODEL_DIR / "label_mappings"
    / "efficientnet_b0_37class_mapping.json"
)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
TOP_K = 3
IMAGE_SIZE = 224

# ImageNet normalization - same standard used by pretrained EfficientNet-B0
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


# ============================================================
# 2. VIETNAMESE LABELS
# ============================================================

SPECIES_VI = {
    "dog": "Chó",
    "cat": "Mèo",
}

BREED_VI = {
    "Abyssinian": "Mèo Abyssinian",
    "american_bulldog": "Bulldog Mỹ",
    "american_pit_bull_terrier": "Pit Bull Terrier Mỹ",
    "basset_hound": "Basset Hound",
    "beagle": "Beagle",
    "Bengal": "Mèo Bengal",
    "Birman": "Mèo Birman",
    "Bombay": "Mèo Bombay",
    "boxer": "Boxer",
    "British_Shorthair": "Mèo Anh lông ngắn",
    "chihuahua": "Chihuahua",
    "Egyptian_Mau": "Mèo Ai Cập Mau",
    "english_cocker_spaniel": "Cocker Spaniel Anh",
    "english_setter": "English Setter",
    "german_shorthaired": "Chó lông ngắn Đức",
    "great_pyrenees": "Great Pyrenees",
    "havanese": "Havanese",
    "japanese_chin": "Japanese Chin",
    "keeshond": "Keeshond",
    "leonberger": "Leonberger",
    "Maine_Coon": "Mèo Maine Coon",
    "miniature_pinscher": "Miniature Pinscher",
    "newfoundland": "Newfoundland",
    "Persian": "Mèo Ba Tư",
    "pomeranian": "Phốc sóc",
    "pug": "Pug",
    "Ragdoll": "Mèo Ragdoll",
    "Russian_Blue": "Mèo Nga xanh",
    "saint_bernard": "Saint Bernard",
    "samoyed": "Samoyed",
    "scottish_terrier": "Scottish Terrier",
    "shiba_inu": "Shiba Inu",
    "Siamese": "Mèo Siamese",
    "Sphynx": "Mèo Sphynx",
    "staffordshire_bull_terrier": "Staffordshire Bull Terrier",
    "wheaten_terrier": "Wheaten Terrier",
    "yorkshire_terrier": "Yorkshire Terrier",
}


# ============================================================
# 3. LOAD MAPPING
# ============================================================

def load_mapping():
    if not MAPPING_PATH.is_file():
        raise FileNotFoundError(
            f"Không tìm thấy mapping: {MAPPING_PATH}"
        )

    with open(MAPPING_PATH, "r", encoding="utf-8") as f:
        mapping = json.load(f)

    classes = mapping.get("classes")

    if not isinstance(classes, dict) or len(classes) != 37:
        raise ValueError("Mapping phải chứa đúng 37 class.")

    labels = [None] * 37
    species_by_label = {}

    for item in classes.values():
        label = item["breed_name"]
        index = int(item["model_label"])
        species = item["species"].strip().lower()

        if index < 0 or index >= 37:
            raise ValueError(f"Class index không hợp lệ: {index}")

        if species not in ("dog", "cat"):
            raise ValueError(
                f"Loài không hợp lệ của {label}: {species}"
            )

        if labels[index] is not None:
            raise ValueError(f"Trùng class index: {index}")

        labels[index] = label
        species_by_label[label] = species

    if any(label is None for label in labels):
        raise ValueError("Mapping thiếu class index.")

    return labels, species_by_label


# ============================================================
# 4. LOAD MODEL
# ============================================================

@lru_cache(maxsize=1)
def get_predictor():
    if not MODEL_PATH.is_file():
        raise FileNotFoundError(
            f"Không tìm thấy model: {MODEL_PATH}"
        )

    try:
        checkpoint = torch.load(
            MODEL_PATH,
            map_location="cpu",
            weights_only=True,
        )
    except TypeError:
        checkpoint = torch.load(
            MODEL_PATH,
            map_location="cpu",
        )

    if not isinstance(checkpoint, dict):
        raise TypeError("Checkpoint không hợp lệ.")

    if "model_state_dict" not in checkpoint:
        raise KeyError("Checkpoint thiếu model_state_dict.")

    labels, species_by_label = load_mapping()

    # Đối chiếu mapping với checkpoint để tránh sai thứ tự nhãn
    checkpoint_mapping = checkpoint.get("class_to_idx")

    if checkpoint_mapping is None:
        raise KeyError("Checkpoint thiếu class_to_idx.")

    json_mapping = {
        label: index for index, label in enumerate(labels)
    }

    if json_mapping != checkpoint_mapping:
        raise ValueError(
            "Mapping JSON không khớp class_to_idx trong checkpoint."
        )

    if int(checkpoint.get("img_size", 0)) != IMAGE_SIZE:
        raise ValueError("Kích thước ảnh không khớp checkpoint.")

    model = efficientnet_b0(weights=None)
    model.classifier[1] = torch.nn.Linear(
        model.classifier[1].in_features,
        37,
    )

    model.load_state_dict(checkpoint["model_state_dict"])
    model.to(DEVICE)
    model.eval()

    preprocess = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=IMAGENET_MEAN,
            std=IMAGENET_STD,
        ),
    ])

    print(
        f"[PetClassifier] Loaded EfficientNet-B0 37 classes | "
        f"Device={DEVICE} | Input={IMAGE_SIZE}x{IMAGE_SIZE}"
    )

    return model, labels, species_by_label, preprocess


# ============================================================
# 5. PREDICTION
# ============================================================

def predict_pet(image: Image.Image) -> dict:
    """
    Nhận ảnh PIL và dự đoán một trong 37 giống chó/mèo.
    """

    model, labels, species_by_label, preprocess = get_predictor()

    image = ImageOps.exif_transpose(image).convert("RGB")
    image_tensor = preprocess(image).unsqueeze(0).to(DEVICE)

    with torch.inference_mode():
        logits = model(image_tensor)
        probabilities = torch.softmax(logits, dim=1)[0]

    # Top 3 giống trên toàn bộ 37 class
    top_values, top_indices = torch.topk(
        probabilities,
        k=min(TOP_K, len(labels)),
    )

    breed_results = []

    for probability, index in zip(
        top_values.cpu().tolist(),
        top_indices.cpu().tolist(),
    ):
        label = labels[index]

        breed_results.append({
            "label": label,
            "label_vi": BREED_VI.get(label, label),
            "confidence": round(float(probability), 6),
            "confidence_percent": round(
                float(probability) * 100, 2
            ),
        })

    best_breed = breed_results[0]
    predicted_species = species_by_label[best_breed["label"]]

    # Tính xác suất tổng hợp của từng loài từ 37 class
    species_probabilities = {
        "dog": 0.0,
        "cat": 0.0,
    }

    for index, probability in enumerate(
        probabilities.cpu().tolist()
    ):
        label = labels[index]
        species = species_by_label[label]
        species_probabilities[species] += float(probability)

    species_results = []

    for species, probability in sorted(
        species_probabilities.items(),
        key=lambda item: item[1],
        reverse=True,
    ):
        species_results.append({
            "label": species,
            "label_vi": SPECIES_VI[species],
            "confidence": round(probability, 6),
            "confidence_percent": round(probability * 100, 2),
        })

    species_confidence = species_probabilities[predicted_species]

    return {
        "species": predicted_species,
        "species_vi": SPECIES_VI[predicted_species],
        "species_confidence": round(species_confidence, 6),
        "species_confidence_percent": round(
            species_confidence * 100, 2
        ),
        "species_top3": species_results,

        "breed": best_breed["label"],
        "breed_vi": best_breed["label_vi"],
        "breed_confidence": best_breed["confidence"],
        "breed_confidence_percent": best_breed[
            "confidence_percent"
        ],
        "breed_top3": breed_results,

        "message": "Đã nhận diện giống chó/mèo bằng EfficientNet-B0 37 class.",
        "device": str(DEVICE),
        "note": (
            "Đây là kết quả dự đoán của AI, không phải xác nhận "
            "chắc chắn về loài hoặc giống thú cưng."
        ),
    }
