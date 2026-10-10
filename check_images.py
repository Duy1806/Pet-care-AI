
# -*- coding: utf-8 -*-
"""
PET AI - KIEM THU MO HINH

Chuc nang:
1. Nhap duong dan anh tu terminal.
2. Nhan dien 5 loai thu cung.
3. Neu la cho, du doan giong cho.
4. Neu la meo, du doan giong meo.
5. Neu la chim, du doan giong chim.
6. Hien thi top 3 ket qua va do tin cay.

Thu muc project: D:\\DACN2
"""

from pathlib import Path
import sys

import torch
import torch.nn as nn
from torchvision.models import (
    efficientnet_b0,
    EfficientNet_B0_Weights,
)
from torchvision import transforms
from PIL import Image, ImageOps


# ============================================================
# 1. CAU HINH
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

IMAGE_SIZE = 160
RESIZE_SIZE = 176
TOP_K = 3


MODEL_PATHS = {
    "species": MODEL_DIR / "pet_5class_efficientnet_b0_best.pth",
    "dog": MODEL_DIR / "dog_breed_efficientnet_b0_best.pth",
    "cat": MODEL_DIR / "cat_breed_efficientnet_b0_best.pth",
    "bird": MODEL_DIR / "bird_efficientnet_b0_best.pth",
}


# Danh sach lop mac dinh.
# Neu checkpoint co class_names/classes thi uu tien metadata trong checkpoint.

FALLBACK_CLASSES = {
    "species": [
        "bird",
        "cat",
        "dog",
        "hamster",
        "rabbit",
    ],

    "dog": [
        "american_bulldog",
        "american_pit_bull_terrier",
        "basset_hound",
        "beagle",
        "boxer",
        "chihuahua",
        "english_cocker_spaniel",
        "english_setter",
        "german_shorthaired",
        "great_pyrenees",
        "havanese",
        "japanese_chin",
        "keeshond",
        "leonberger",
        "miniature_pinscher",
        "newfoundland",
        "pomeranian",
        "pug",
        "saint_bernard",
        "samoyed",
        "scottish_terrier",
        "shiba_inu",
        "staffordshire_bull_terrier",
        "wheaten_terrier",
        "yorkshire_terrier",
    ],

    "cat": [
        "abyssinian",
        "bengal",
        "birman",
        "bombay",
        "british_shorthair",
        "egyptian_mau",
        "maine_coon",
        "persian",
        "ragdoll",
        "russian_blue",
        "siamese",
        "sphynx",
    ],

    "bird": [
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
    ],
}


# ============================================================
# 2. TEN TIENG VIET
# ============================================================

SPECIES_VI = {
    "bird": "Chim",
    "cat": "Meo",
    "dog": "Cho",
    "hamster": "Chuot hamster",
    "rabbit": "Tho",
}


DOG_BREED_VI = {
    "american_bulldog": "Bulldog My",
    "american_pit_bull_terrier": "Pit Bull Terrier My",
    "basset_hound": "Basset Hound",
    "beagle": "Beagle",
    "boxer": "Boxer",
    "chihuahua": "Chihuahua",
    "english_cocker_spaniel": "Cocker Spaniel Anh",
    "english_setter": "English Setter",
    "german_shorthaired": "Cho long ngan Duc",
    "great_pyrenees": "Great Pyrenees",
    "havanese": "Havanese",
    "japanese_chin": "Japanese Chin",
    "keeshond": "Keeshond",
    "leonberger": "Leonberger",
    "miniature_pinscher": "Miniature Pinscher",
    "newfoundland": "Newfoundland",
    "pomeranian": "Phoc soc",
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
    "abyssinian": "Meo Abyssinian",
    "bengal": "Meo Bengal",
    "birman": "Meo Birman",
    "bombay": "Meo Bombay",
    "british_shorthair": "Meo Anh long ngan",
    "egyptian_mau": "Meo Ai Cap Mau",
    "maine_coon": "Meo Maine Coon",
    "persian": "Meo Ba Tu",
    "ragdoll": "Meo Ragdoll",
    "russian_blue": "Meo Nga xanh",
    "siamese": "Meo Siamese",
    "sphynx": "Meo khong long Sphynx",
}


BIRD_BREED_VI = {
    "ALEXANDRINE PARAKEET": "Vet co Alexandrine",
    "CANARY": "Chim hoang yen",
    "COCKATOO": "Vet Cockatoo",
    "EASTERN ROSELLA": "Vet Eastern Rosella",
    "GOLDEN PARAKEET": "Vet vang",
    "GOULDIAN FINCH": "Chim Gouldian Finch",
    "HYACINTH MACAW": "Vet Hyacinth Macaw",
    "JAVA SPARROW": "Chim se Java",
    "RAINBOW LORIKEET": "Vet cau vong",
    "ROSY FACED LOVEBIRD": "Vet mat hong",
}


# ============================================================
# 3. TIEN XU LY ANH
# ============================================================

TRANSFORM = transforms.Compose([
    transforms.Resize(RESIZE_SIZE),
    transforms.CenterCrop(IMAGE_SIZE),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])


# ============================================================
# 4. MO HINH CLASSIFIER
# ============================================================

class FeatureClassifier(nn.Module):
    """
    Classifier nhan vector dac trung 1280 chieu tu EfficientNet-B0.
    """

    def __init__(self, num_classes):
        super().__init__()

        self.classifier = nn.Sequential(
            nn.Dropout(p=0.2),
            nn.Linear(1280, num_classes),
        )

    def forward(self, x):
        return self.classifier(x)


# ============================================================
# 5. DOC CHECKPOINT
# ============================================================

def get_checkpoint_state(checkpoint, model_path):
    """
    Ho tro checkpoint luu theo cac dang pho bien:
    - {"model_state_dict": ...}
    - {"state_dict": ...}
    - state_dict duoc luu truc tiep
    """

    if not isinstance(checkpoint, dict):
        raise TypeError(
            f"Checkpoint khong phai dict: {model_path.name}"
        )

    if "model_state_dict" in checkpoint:
        state_dict = checkpoint["model_state_dict"]

    elif "state_dict" in checkpoint:
        state_dict = checkpoint["state_dict"]

    else:
        # Truong hop checkpoint la state_dict truc tiep
        state_dict = checkpoint

    if not isinstance(state_dict, dict):
        raise TypeError(
            f"State dict khong hop le: {model_path.name}"
        )

    return state_dict


def get_class_names(checkpoint, fallback_classes):
    """
    Lay thu tu class tu checkpoint neu co.
    Neu khong co thi su dung danh sach mac dinh.
    """

    class_names = None

    if isinstance(checkpoint, dict):
        for key in ("class_names", "classes"):
            if key in checkpoint:
                class_names = checkpoint[key]
                break

    if class_names is None:
        return list(fallback_classes)

    # Ho tro metadata dang dict: ten lop -> index
    if isinstance(class_names, dict):
        return [
            name
            for name, index in sorted(
                class_names.items(),
                key=lambda item: item[1],
            )
        ]

    if isinstance(class_names, (list, tuple)):
        return list(class_names)

    raise ValueError(
        "Dinh dang class_names trong checkpoint khong hop le."
    )


def normalize_classifier_keys(state_dict, model_path):
    """
    Chuan hoa ten khoa ve:
        classifier.1.weight
        classifier.1.bias

    Ho tro cac dang da gap trong cac checkpoint:
        classifier.1.weight
        layers.1.weight
        1.weight

    Dong thoi xu ly prefix 'module.' neu co.
    """

    normalized = {}

    for key, value in state_dict.items():
        new_key = key

        if new_key.startswith("module."):
            new_key = new_key[len("module."):]

        if new_key in ("1.weight", "layers.1.weight"):
            new_key = "classifier.1.weight"

        elif new_key in ("1.bias", "layers.1.bias"):
            new_key = "classifier.1.bias"

        normalized[new_key] = value

    required_keys = {
        "classifier.1.weight",
        "classifier.1.bias",
    }

    missing = required_keys - set(normalized.keys())

    if missing:
        raise KeyError(
            f"Khong tim thay cac khoa classifier {missing} "
            f"trong {model_path.name}. "
            f"Cac khoa hien co: {list(state_dict.keys())}"
        )

    # Checkpoint nay chi duoc ky vong luu classifier.
    # Neu co tham so khong mong doi, dung lai de tranh nap sai.
    unexpected = set(normalized.keys()) - required_keys

    if unexpected:
        raise KeyError(
            f"Checkpoint {model_path.name} co cac khoa "
            f"khong mong doi: {sorted(unexpected)}"
        )

    return normalized


def load_model(model_path, fallback_classes):
    """
    Tai classifier tu checkpoint.
    Backbone EfficientNet-B0 duoc dung de trich xuat dac trung.
    """

    print(f"Dang nap model: {model_path.name}")

    if not model_path.is_file():
        raise FileNotFoundError(
            f"Khong tim thay checkpoint: {model_path}"
        )

    # Checkpoint cua project la cac tensor va metadata co ban.
    try:
        checkpoint = torch.load(
            model_path,
            map_location="cpu",
            weights_only=True,
        )
    except TypeError:
        # Tuong thich voi phien ban PyTorch cu hon.
        checkpoint = torch.load(
            model_path,
            map_location="cpu",
        )

    raw_state_dict = get_checkpoint_state(
        checkpoint,
        model_path,
    )

    class_names = get_class_names(
        checkpoint,
        fallback_classes,
    )

    state_dict = normalize_classifier_keys(
        raw_state_dict,
        model_path,
    )

    weight = state_dict["classifier.1.weight"]

    if weight.ndim != 2 or weight.shape[1] != 1280:
        raise ValueError(
            f"Kich thuoc classifier khong dung trong "
            f"{model_path.name}: {tuple(weight.shape)}"
        )

    checkpoint_num_classes = weight.shape[0]

    if checkpoint_num_classes != len(class_names):
        raise ValueError(
            f"So lop khong khop trong {model_path.name}: "
            f"classifier co {checkpoint_num_classes} lop, "
            f"nhung danh sach class co {len(class_names)} lop. "
            "Can kiem tra metadata va thu tu class khi train."
        )

    model = FeatureClassifier(
        num_classes=checkpoint_num_classes
    )

    model.load_state_dict(
        state_dict,
        strict=True,
    )

    model.to(DEVICE)
    model.eval()

    print(
        f"  OK: {len(class_names)} lop "
        f"| classifier da nap dung"
    )

    return model, class_names


# ============================================================
# 6. TAI BACKBONE EFFICIENTNET-B0
# ============================================================

def load_backbone():
    """
    Tai backbone EfficientNet-B0 voi ImageNet pretrained weights.
    Can co weights trong cache hoac ket noi Internet lan dau.
    """

    print("\nDang tai EfficientNet-B0...")

    backbone = efficientnet_b0(
        weights=EfficientNet_B0_Weights.DEFAULT
    )

    backbone.eval()
    backbone.to(DEVICE)

    for param in backbone.parameters():
        param.requires_grad = False

    print("Da tai backbone.")

    return backbone


# ============================================================
# 7. DU DOAN
# ============================================================

@torch.inference_mode()
def extract_features(backbone, image_tensor):
    image_tensor = image_tensor.to(DEVICE)

    features = backbone.features(image_tensor)
    features = backbone.avgpool(features)
    features = torch.flatten(features, 1)

    return features


@torch.inference_mode()
def predict_top_k(backbone, model, class_names, image_tensor):
    features = extract_features(
        backbone,
        image_tensor,
    )

    logits = model(features)
    probabilities = torch.softmax(logits, dim=1)[0]

    k = min(TOP_K, len(class_names))

    values, indices = torch.topk(
        probabilities,
        k=k,
    )

    results = []

    for probability, index in zip(
        values.cpu().tolist(),
        indices.cpu().tolist(),
    ):
        results.append({
            "label": str(class_names[index]),
            "confidence": float(probability),
        })

    return results


def translate_label(label, category):
    """
    Chuyen nhan sang tieng Viet.
    Neu khong co ban dich, giu nguyen nhan goc.
    """

    if category == "species":
        return SPECIES_VI.get(label.lower(), label)

    if category == "dog":
        return DOG_BREED_VI.get(label.lower(), label)

    if category == "cat":
        return CAT_BREED_VI.get(label.lower(), label)

    if category == "bird":
        return BIRD_BREED_VI.get(label.upper(), label)

    return label


def print_results(title, results, category):
    print(f"\n{title}")

    for rank, result in enumerate(results, start=1):
        label = result["label"]
        confidence = result["confidence"] * 100
        vietnamese_label = translate_label(
            label,
            category,
        )

        print(
            f"  {rank}. {vietnamese_label} "
            f"({label}) - {confidence:.2f}%"
        )


# ============================================================
# 8. DOC ANH
# ============================================================

def read_image(image_path):
    image_path = Path(image_path).expanduser()

    if not image_path.is_absolute():
        image_path = Path.cwd() / image_path

    if not image_path.is_file():
        raise FileNotFoundError(
            f"Khong tim thay anh: {image_path}"
        )

    with Image.open(image_path) as original:
        # Xu ly anh co EXIF orientation
        image = ImageOps.exif_transpose(original).convert("RGB")
        image_size = image.size
        image_tensor = TRANSFORM(image).unsqueeze(0)

    return image_path, image_size, image_tensor


# ============================================================
# 9. CHAY KIEM THU
# ============================================================

def main():
    print("=" * 54)
    print("           PET AI - KIEM THU MO HINH")
    print("=" * 54)

    print(f"Thiet bi: {DEVICE}")
    print(f"Thu muc model: {MODEL_DIR}")

    image_input = input(
        "\nNhap duong dan anh can test: "
    ).strip().strip('"').strip("'")

    if not image_input:
        print("Ban chua nhap duong dan anh.")
        return

    # Doc anh
    image_path, image_size, image_tensor = read_image(
        image_input
    )

    print(f"\nAnh dau vao: {image_path.name}")
    print(f"Duong dan: {image_path}")
    print(f"Kich thuoc anh: {image_size}")

    # Tai backbone
    backbone = load_backbone()

    # Tai cac classifier
    print("\nDang tai cac model da train...")

    models_loaded = {}

    for key, model_path in MODEL_PATHS.items():
        models_loaded[key] = load_model(
            model_path,
            FALLBACK_CLASSES[key],
        )

    # Buoc 1: Nhan dien loai
    species_model, species_classes = models_loaded["species"]

    species_results = predict_top_k(
        backbone,
        species_model,
        species_classes,
        image_tensor,
    )

    print("\n" + "=" * 54)
    print("KET QUA NHAN DIEN LOAI THU CUNG")
    print("=" * 54)

    print_results(
        "Top ket qua loai:",
        species_results,
        "species",
    )

    predicted_species = species_results[0]["label"].lower()
    species_confidence = species_results[0]["confidence"]

    print("\nLOAI DU DOAN:")
    print(
        f"{translate_label(predicted_species, 'species')} "
        f"({predicted_species})"
    )
    print(f"Do tin cay: {species_confidence * 100:.2f}%")

    # Buoc 2: Chon classifier giong phu hop
    breed_model_key = {
        "dog": "dog",
        "cat": "cat",
        "bird": "bird",
    }.get(predicted_species)

    print("\n" + "=" * 54)
    print("KET QUA NHAN DIEN GIONG")
    print("=" * 54)

    if breed_model_key is None:
        print(
            "Hien chua co model nhan dien giong cho loai "
            f"{translate_label(predicted_species, 'species')}."
        )
        print("Da hoan tat nhan dien loai.")
        return

    breed_model, breed_classes = models_loaded[breed_model_key]

    breed_results = predict_top_k(
        backbone,
        breed_model,
        breed_classes,
        image_tensor,
    )

    print_results(
        "Top ket qua giong:",
        breed_results,
        breed_model_key,
    )

    best_breed = breed_results[0]
    best_breed_vi = translate_label(
        best_breed["label"],
        breed_model_key,
    )

    # Tong ket
    print("\n" + "=" * 54)
    print("                 TONG KET")
    print("=" * 54)

    print(
        f"Loai: {translate_label(predicted_species, 'species')} "
        f"({species_confidence * 100:.2f}%)"
    )

    print(
        f"Giong du doan: {best_breed_vi} "
        f"({best_breed['label']})"
    )

    print(
        f"Do tin cay giong: "
        f"{best_breed['confidence'] * 100:.2f}%"
    )

    print("\nLuu y:")
    print("- Do tin cay la xac suat softmax cua model.")
    print("- Ket qua la du doan cua AI, khong phai xac nhan "
          "chac chan ve giong thu cung.")
    print("- Neu model loai du doan sai, model giong duoc chon "
          "cung co the khong phu hop voi anh.")

    print("\nKiem thu hoan tat.")


if __name__ == "__main__":
    try:
        main()

    except KeyboardInterrupt:
        print("\nDa huy kiem thu.")

    except Exception as error:
        print(
            f"\nLOI KHI CHAY MODEL: "
            f"{type(error).__name__}: {error}"
        )
        print("\nChi tiet loi:")
        import traceback
        traceback.print_exc()

        sys.exit(1)
