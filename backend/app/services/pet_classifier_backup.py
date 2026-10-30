
from functools import lru_cache
from pathlib import Path

import torch
import torch.nn as nn
from PIL import Image, ImageOps
from torchvision import transforms
from torchvision.models import efficientnet_b0

# ============================================================
# 1. CAU HINH DUONG DAN
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[2]  # D:/DACN2/backend
PROJECT_DIR = BASE_DIR.parent                  # D:/DACN2
MODEL_DIR = PROJECT_DIR / "models"

STAGE1_PATH = (
    MODEL_DIR / "stage 1" / "efficientnet_b0_species_best.pth"
)

STAGE2_DIR = MODEL_DIR / "stage 2"

SPECIES_LIST = ["dog", "cat", "bird", "rabbit", "hamster"]

STAGE2_PATHS = {
    species: STAGE2_DIR / species
    / f"efficientnet_b0_{species}_best.pth"
    for species in SPECIES_LIST
}

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
TOP_K = 3

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

RABBIT_BREED_VI = {
    "californian": "Thỏ Californian",
    "holland-lop": "Thỏ Holland Lop",
    "lionhead": "Thỏ Lionhead",
    "new-zealand": "Thỏ New Zealand",
}

HAMSTER_BREED_VI = {
    "Syrian": "Hamster Syrian",
    "Winter": "Hamster Winter White",
}


# ============================================================
# 2. DOC CHECKPOINT AN TOAN
# ============================================================

def load_checkpoint(path: Path) -> dict:
    if not path.is_file():
        raise FileNotFoundError(f"Không tìm thấy checkpoint: {path}")

    try:
        checkpoint = torch.load(
            path,
            map_location="cpu",
            weights_only=True,
        )
    except TypeError:
        # Hỗ trợ phiên bản PyTorch cũ không có weights_only.
        checkpoint = torch.load(path, map_location="cpu")

    if not isinstance(checkpoint, dict):
        raise TypeError(f"Checkpoint không hợp lệ: {path}")

    if "model_state_dict" not in checkpoint:
        raise KeyError(f"Thiếu model_state_dict trong {path.name}")

    return checkpoint


def labels_from_mapping(mapping: dict) -> list[str]:
    """Chuyển idx_to_* hoặc *_to_idx thành list theo đúng chỉ số train."""

    if not isinstance(mapping, dict) or not mapping:
        raise ValueError("Mapping nhãn không hợp lệ hoặc bị rỗng.")

    # Trường hợp {"0": "bird", "1": "cat", ...}
    if all(str(key).isdigit() for key in mapping):
        return [
            str(mapping[key] if key in mapping else mapping[str(key)])
            for key in range(len(mapping))
        ]

    # Trường hợp {"bird": 0, "cat": 1, ...}
    if all(isinstance(value, int) for value in mapping.values()):
        ordered = sorted(mapping.items(), key=lambda item: item[1])

        if [idx for _, idx in ordered] != list(range(len(ordered))):
            raise ValueError("Chỉ số nhãn không liên tục trong mapping.")

        return [str(label) for label, _ in ordered]

    raise ValueError("Không nhận diện được định dạng mapping nhãn.")


# ============================================================
# 3. KHOI TAO DUNG KIEN TRUC EFFICIENTNET-B0
# ============================================================

def build_model(checkpoint: dict, path: Path, kind: str):
    if kind == "species":
        mapping_key = "idx_to_species"
        fallback_mapping_key = "species_to_idx"
    else:
        mapping_key = "idx_to_breed"
        fallback_mapping_key = "breed_to_idx"

    if mapping_key in checkpoint:
        labels = labels_from_mapping(checkpoint[mapping_key])
    elif fallback_mapping_key in checkpoint:
        labels = labels_from_mapping(checkpoint[fallback_mapping_key])
    else:
        raise KeyError(f"Checkpoint {path.name} không có mapping nhãn.")

    num_classes = len(labels)

    if kind != "species":
        saved_num_classes = checkpoint.get("num_classes")
        if saved_num_classes is not None and saved_num_classes != num_classes:
            raise ValueError(f"Số lớp không khớp trong {path.name}")

    dropout = float(checkpoint.get("dropout", 0.2))

    # Khởi tạo kiến trúc, không tải ImageNet pretrained weights.
    model = efficientnet_b0(weights=None)
    model.classifier = nn.Sequential(
        nn.Dropout(p=dropout),
        nn.Linear(1280, num_classes),
    )

    model.load_state_dict(checkpoint["model_state_dict"], strict=True)
    model.to(DEVICE)
    model.eval()

    return model, labels, checkpoint


# ============================================================
# 4. NAP CA 6 MODEL MOT LAN
# ============================================================

@lru_cache(maxsize=1)
def get_predictor():
    print(f"[Pet AI] Đang nạp model trên {DEVICE}...")

    species_model, species_labels, species_ckpt = build_model(
        load_checkpoint(STAGE1_PATH),
        STAGE1_PATH,
        "species",
    )

    classifiers = {}

    for species, path in STAGE2_PATHS.items():
        checkpoint = load_checkpoint(path)
        model, labels, _ = build_model(checkpoint, path, species)

        classifiers[species] = (model, labels)
        print(f"[Pet AI] {species}: {len(labels)} lớp")

    input_size = int(species_ckpt.get("input_size", 224))

    mean = species_ckpt.get("mean", [0.485, 0.456, 0.406])
    std = species_ckpt.get("std", [0.229, 0.224, 0.225])

    preprocess = transforms.Compose([
        transforms.Resize((input_size, input_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=mean, std=std),
    ])

    print(
        f"[Pet AI] Đã nạp 6 model. "
        f"Input={input_size}x{input_size}, device={DEVICE}"
    )

    return species_model, species_labels, classifiers, preprocess


# ============================================================
# 5. DU DOAN TOP-K
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

    if category == "rabbit":
        return RABBIT_BREED_VI.get(label.lower(), label)

    if category == "hamster":
        return HAMSTER_BREED_VI.get(label, label)

    return label


def predict_top_k(model, labels: list[str], image_tensor, category: str):
    with torch.inference_mode():
        logits = model(image_tensor.to(DEVICE))
        probabilities = torch.softmax(logits, dim=1)[0]

        values, indices = torch.topk(
            probabilities,
            k=min(TOP_K, len(labels)),
        )

    results = []

    for probability, index in zip(
        values.cpu().tolist(),
        indices.cpu().tolist(),
    ):
        label = labels[index]

        results.append({
            "label": label,
            "label_vi": translate_label(label, category),
            "confidence": round(float(probability), 6),
            "confidence_percent": round(float(probability) * 100, 2),
        })

    return results


# ============================================================
# 6. API PREDICTION ENTRY POINT
# ============================================================

def predict_pet(image: Image.Image) -> dict:
    """
    Nhận ảnh PIL; phân loại loài trước, sau đó dùng model
    giống tương ứng với loài được dự đoán.
    """

    species_model, species_labels, classifiers, preprocess = get_predictor()

    image = ImageOps.exif_transpose(image).convert("RGB")
    image_tensor = preprocess(image).unsqueeze(0)

    species_results = predict_top_k(
        species_model,
        species_labels,
        image_tensor,
        "species",
    )

    predicted_species = species_results[0]["label"].lower()
    species_confidence = species_results[0]["confidence"]

    result = {
        "species": predicted_species,
        "species_vi": SPECIES_VI.get(predicted_species, predicted_species),
        "species_confidence": species_confidence,
        "species_confidence_percent": species_results[0]["confidence_percent"],
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

    if predicted_species not in classifiers:
        result["message"] = "Chưa có model nhận diện giống cho loài này."
        return result

    breed_model, breed_labels = classifiers[predicted_species]

    breed_results = predict_top_k(
        breed_model,
        breed_labels,
        image_tensor,
        predicted_species,
    )

    best_breed = breed_results[0]

    result.update({
        "breed": best_breed["label"],
        "breed_vi": best_breed["label_vi"],
        "breed_confidence": best_breed["confidence"],
        "breed_confidence_percent": best_breed["confidence_percent"],
        "breed_top3": breed_results,
        "message": "Đã nhận diện loài và dự đoán giống.",
    })

    return result
