
# app/services/pet_classifier.py

from functools import lru_cache
from pathlib import Path

import torch
import torch.nn as nn
from PIL import Image, ImageOps
from torchvision import transforms
from torchvision.models import efficientnet_b0, EfficientNet_B0_Weights


# ============================================================
# 1. CAU HINH
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BASE_DIR.parent
MODEL_DIR = PROJECT_DIR / "models"

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
TOP_K = 3

MODEL_PATHS = {
    "species": MODEL_DIR / "pet_5class_efficientnet_b0_best.pth",
    "dog": MODEL_DIR / "dog_breed_efficientnet_b0_best.pth",
    "cat": MODEL_DIR / "cat_breed_efficientnet_b0_best.pth",
    "bird": MODEL_DIR / "bird_efficientnet_b0_best.pth",
}

FALLBACK_CLASSES = {
    "species": ["bird", "cat", "dog", "hamster", "rabbit"],
    "dog": [
        "american_bulldog", "american_pit_bull_terrier",
        "basset_hound", "beagle", "boxer", "chihuahua",
        "english_cocker_spaniel", "english_setter",
        "german_shorthaired", "great_pyrenees", "havanese",
        "japanese_chin", "keeshond", "leonberger",
        "miniature_pinscher", "newfoundland", "pomeranian",
        "pug", "saint_bernard", "samoyed", "scottish_terrier",
        "shiba_inu", "staffordshire_bull_terrier",
        "wheaten_terrier", "yorkshire_terrier",
    ],
    "cat": [
        "abyssinian", "bengal", "birman", "bombay",
        "british_shorthair", "egyptian_mau", "maine_coon",
        "persian", "ragdoll", "russian_blue", "siamese", "sphynx",
    ],
    "bird": [
        "ALEXANDRINE PARAKEET", "CANARY", "COCKATOO",
        "EASTERN ROSELLA", "GOLDEN PARAKEET", "GOULDIAN FINCH",
        "HYACINTH MACAW", "JAVA SPARROW", "RAINBOW LORIKEET",
        "ROSY FACED LOVEBIRD",
    ],
}

SPECIES_VI = {
    "bird": "Chim",
    "cat": "Mèo",
    "dog": "Chó",
    "hamster": "Chuột hamster",
    "rabbit": "Thỏ",
}

DOG_BREED_VI = {
    "american_bulldog": "Bulldog Mỹ",
    "american_pit_bull_terrier": "Pit Bull Terrier Mỹ",
    "basset_hound": "Basset Hound",
    "beagle": "Beagle",
    "boxer": "Boxer",
    "chihuahua": "Chihuahua",
    "english_cocker_spaniel": "Cocker Spaniel Anh",
    "english_setter": "English Setter",
    "german_shorthaired": "Chó lông ngắn Đức",
    "great_pyrenees": "Great Pyrenees",
    "havanese": "Havanese",
    "japanese_chin": "Japanese Chin",
    "keeshond": "Keeshond",
    "leonberger": "Leonberger",
    "miniature_pinscher": "Miniature Pinscher",
    "newfoundland": "Newfoundland",
    "pomeranian": "Phốc sóc",
    "pug": "Pug",
    "saint_bernard": "Saint Bernard",
    "samoyed": "Samoyed",
    "scottish_terrier": "Scottish Terrier",
    "shiba_inu": "Shiba Inu",
    "staffordshire_bull_terrier": "Staffordshire Bull Terrier",
    "wheaten_terrier": "Wheaten Terrier",
    "yorkshire_terrier": "Yorkshire Terrier",
}

CAT_BREED_VI = {
    "abyssinian": "Mèo Abyssinian",
    "bengal": "Mèo Bengal",
    "birman": "Mèo Birman",
    "bombay": "Mèo Bombay",
    "british_shorthair": "Mèo Anh lông ngắn",
    "egyptian_mau": "Mèo Ai Cập Mau",
    "maine_coon": "Mèo Maine Coon",
    "persian": "Mèo Ba Tư",
    "ragdoll": "Mèo Ragdoll",
    "russian_blue": "Mèo Nga xanh",
    "siamese": "Mèo Siamese",
    "sphynx": "Mèo Sphynx",
}

BIRD_BREED_VI = {
    "ALEXANDRINE PARAKEET": "Vẹt Alexandrine",
    "CANARY": "Chim hoàng yến",
    "COCKATOO": "Vẹt Cockatoo",
    "EASTERN ROSELLA": "Vẹt Eastern Rosella",
    "GOLDEN PARAKEET": "Vẹt vàng",
    "GOULDIAN FINCH": "Chim Gouldian Finch",
    "HYACINTH MACAW": "Vẹt Hyacinth Macaw",
    "JAVA SPARROW": "Chim sẻ Java",
    "RAINBOW LORIKEET": "Vẹt cầu vồng",
    "ROSY FACED LOVEBIRD": "Vẹt mặt hồng",
}

TRANSFORM = transforms.Compose([
    transforms.Resize(176),
    transforms.CenterCrop(160),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])


# ============================================================
# 2. CLASSIFIER
# ============================================================

class FeatureClassifier(nn.Module):
    def __init__(self, num_classes: int):
        super().__init__()
        self.classifier = nn.Sequential(
            nn.Dropout(p=0.2),
            nn.Linear(1280, num_classes),
        )

    def forward(self, x):
        return self.classifier(x)


def get_checkpoint_state(checkpoint, model_path: Path):
    if not isinstance(checkpoint, dict):
        raise TypeError(f"Checkpoint không hợp lệ: {model_path.name}")

    if "model_state_dict" in checkpoint:
        state_dict = checkpoint["model_state_dict"]
    elif "state_dict" in checkpoint:
        state_dict = checkpoint["state_dict"]
    else:
        state_dict = checkpoint

    if not isinstance(state_dict, dict):
        raise TypeError(f"State dict không hợp lệ: {model_path.name}")

    return state_dict


def get_class_names(checkpoint, fallback_classes):
    if isinstance(checkpoint, dict):
        for key in ("class_names", "classes"):
            if key in checkpoint:
                names = checkpoint[key]

                if isinstance(names, dict):
                    return [
                        name for name, _ in sorted(
                            names.items(), key=lambda item: item[1]
                        )
                    ]

                if isinstance(names, (list, tuple)):
                    return list(names)

                raise ValueError(
                    f"Metadata {key} không hợp lệ trong checkpoint."
                )

    return list(fallback_classes)


def load_classifier(model_path: Path, fallback_classes):
    if not model_path.is_file():
        raise FileNotFoundError(f"Không tìm thấy model: {model_path}")

    checkpoint = torch.load(
        model_path,
        map_location="cpu",
        weights_only=True,
    )

    class_names = get_class_names(checkpoint, fallback_classes)
    raw_state = get_checkpoint_state(checkpoint, model_path)

    state_dict = {}

    for key, value in raw_state.items():
        key = key.removeprefix("module.")

        if key in ("1.weight", "layers.1.weight"):
            key = "classifier.1.weight"
        elif key in ("1.bias", "layers.1.bias"):
            key = "classifier.1.bias"

        state_dict[key] = value

    required = {"classifier.1.weight", "classifier.1.bias"}
    if set(state_dict.keys()) != required:
        raise ValueError(
            f"Các key classifier không khớp trong {model_path.name}: "
            f"{list(state_dict.keys())}"
        )

    weight = state_dict["classifier.1.weight"]

    if weight.ndim != 2 or weight.shape[1] != 1280:
        raise ValueError(f"Kích thước classifier sai: {tuple(weight.shape)}")

    if weight.shape[0] != len(class_names):
        raise ValueError(
            f"Số lớp trong checkpoint {model_path.name} không khớp "
            "danh sách class. Hãy kiểm tra thứ tự nhãn khi train."
        )

    model = FeatureClassifier(num_classes=len(class_names))
    model.load_state_dict(state_dict, strict=True)
    model.to(DEVICE)
    model.eval()

    return model, class_names


# ============================================================
# 3. NAP MODEL MOT LAN
# ============================================================

@lru_cache(maxsize=1)
def get_predictor():
    print(f"[Pet AI] Đang nạp model trên {DEVICE}...")

    # Dùng weights đã có trong cache ImageNet.
    backbone = efficientnet_b0(weights=EfficientNet_B0_Weights.DEFAULT)
    backbone.to(DEVICE)
    backbone.eval()

    for parameter in backbone.parameters():
        parameter.requires_grad = False

    classifiers = {}

    for key, path in MODEL_PATHS.items():
        classifiers[key] = load_classifier(path, FALLBACK_CLASSES[key])
        print(f"[Pet AI] Đã nạp {key}: {len(classifiers[key][1])} lớp")

    print("[Pet AI] Nạp model hoàn tất.")
    return backbone, classifiers


# ============================================================
# 4. DU DOAN
# ============================================================

def translate_label(label: str, category: str) -> str:
    if category == "species":
        return SPECIES_VI.get(label.lower(), label)
    if category == "dog":
        return DOG_BREED_VI.get(label.lower(), label)
    if category == "cat":
        return CAT_BREED_VI.get(label.lower(), label)
    if category == "bird":
        return BIRD_BREED_VI.get(label.upper(), label)
    return label


def predict_top_k(backbone, classifier, class_names, image_tensor):
    with torch.inference_mode():
        image_tensor = image_tensor.to(DEVICE)

        features = backbone.features(image_tensor)
        features = backbone.avgpool(features)
        features = torch.flatten(features, 1)

        logits = classifier(features)
        probabilities = torch.softmax(logits, dim=1)[0]

        values, indices = torch.topk(
            probabilities, k=min(TOP_K, len(class_names))
        )

    results = []

    for probability, index in zip(values.cpu().tolist(), indices.cpu().tolist()):
        label = str(class_names[index])
        results.append({
            "label": label,
            "label_vi": translate_label(label, "species")
            if label.lower() in SPECIES_VI
            else label,
            "confidence": round(float(probability), 6),
            "confidence_percent": round(float(probability) * 100, 2),
        })

    return results


def predict_pet(image: Image.Image) -> dict:
    """
    Nhận ảnh PIL đã mở; trả kết quả nhận diện loài và giống (nếu có).
    """
    backbone, classifiers = get_predictor()

    image = ImageOps.exif_transpose(image).convert("RGB")
    image_tensor = TRANSFORM(image).unsqueeze(0)

    species_model, species_classes = classifiers["species"]
    species_results = predict_top_k(
        backbone, species_model, species_classes, image_tensor
    )

    predicted_species = species_results[0]["label"].lower()
    species_confidence = species_results[0]["confidence"]

    result = {
        "species": predicted_species,
        "species_vi": SPECIES_VI.get(predicted_species, predicted_species),
        "species_confidence": species_confidence,
        "species_confidence_percent": round(species_confidence * 100, 2),
        "species_top3": species_results,
        "breed": None,
        "breed_vi": None,
        "breed_confidence": None,
        "breed_confidence_percent": None,
        "breed_top3": [],
        "message": None,
        "device": str(DEVICE),
        "note": (
            "Đây là kết quả dự đoán của AI, không phải xác nhận chắc chắn "
            "về loài hoặc giống thú cưng."
        ),
    }

    breed_model_key = {
        "dog": "dog",
        "cat": "cat",
        "bird": "bird",
    }.get(predicted_species)

    if breed_model_key is None:
        result["message"] = (
            "Hiện chưa có model nhận diện giống cho loài này."
        )
        return result

    breed_model, breed_classes = classifiers[breed_model_key]
    breed_results = predict_top_k(
        backbone, breed_model, breed_classes, image_tensor
    )

    best_breed = breed_results[0]
    result.update({
        "breed": best_breed["label"],
        "breed_vi": translate_label(best_breed["label"], breed_model_key),
        "breed_confidence": best_breed["confidence"],
        "breed_confidence_percent": best_breed["confidence_percent"],
        "breed_top3": [
            {
                **item,
                "label_vi": translate_label(item["label"], breed_model_key),
            }
            for item in breed_results
        ],
        "message": "Đã nhận diện loài và dự đoán giống.",
    })

    return result
