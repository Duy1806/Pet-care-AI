import os
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image


# =========================
# CONFIG
# =========================

MODEL_DIR = r"D:\DACN2\models"

PET_MODEL = os.path.join(
    MODEL_DIR,
    "pet_5class_mobilenetv3_small_best.pth"
)

DOG_MODEL = os.path.join(
    MODEL_DIR,
    "dog_breed_mobilenetv3_small_best.pth"
)

CAT_MODEL = os.path.join(
    MODEL_DIR,
    "cat_breed_mobilenetv3_small_best.pth"
)

BIRD_MODEL = os.path.join(
    MODEL_DIR,
    "bird_mobilenetv3_small_best.pth"
)

DEVICE = torch.device("cpu")


# =========================
# IMAGE TRANSFORM
# =========================

transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])


# =========================
# LOAD MODEL
# =========================

def load_model(model_path, num_classes):
    checkpoint = torch.load(
        model_path,
        map_location=DEVICE,
        weights_only=False
    )

    model = models.mobilenet_v3_small(
        weights=None
    )

    model.classifier[3] = nn.Linear(
        model.classifier[3].in_features,
        num_classes
    )

    model.load_state_dict(
        checkpoint["model_state_dict"]
    )

    model.to(DEVICE)
    model.eval()

    class_names = checkpoint["class_names"]

    return model, class_names


print("Loading models...")

pet_model, pet_classes = load_model(
    PET_MODEL,
    5
)

dog_model, dog_classes = load_model(
    DOG_MODEL,
    25
)

cat_model, cat_classes = load_model(
    CAT_MODEL,
    12
)

bird_model, bird_classes = load_model(
    BIRD_MODEL,
    10
)

print("All models loaded!")


# =========================
# PREDICT
# =========================

def predict(model, class_names, image):
    image = transform(image)
    image = image.unsqueeze(0)
    image = image.to(DEVICE)

    with torch.no_grad():
        output = model(image)
        probabilities = torch.softmax(output, dim=1)

        confidence, predicted = torch.max(
            probabilities,
            dim=1
        )

    class_name = class_names[predicted.item()]
    confidence = confidence.item()

    return class_name, confidence


# =========================
# MAIN PIPELINE
# =========================

def predict_pet(image_path):

    image = Image.open(image_path).convert("RGB")

    # STEP 1
    animal, animal_confidence = predict(
        pet_model,
        pet_classes,
        image
    )

    print("\n==============================")
    print("STEP 1 - ANIMAL")
    print("==============================")

    print(
        f"Animal: {animal}"
    )

    print(
        f"Confidence: {animal_confidence * 100:.2f}%"
    )

    # STEP 2
    if animal == "dog":

        breed, confidence = predict(
            dog_model,
            dog_classes,
            image
        )

        print("\n==============================")
        print("STEP 2 - DOG BREED")
        print("==============================")

        print(f"Breed: {breed}")
        print(f"Confidence: {confidence * 100:.2f}%")

        return {
            "animal": animal,
            "animal_confidence": animal_confidence,
            "breed": breed,
            "breed_confidence": confidence
        }

    elif animal == "cat":

        breed, confidence = predict(
            cat_model,
            cat_classes,
            image
        )

        print("\n==============================")
        print("STEP 2 - CAT BREED")
        print("==============================")

        print(f"Breed: {breed}")
        print(f"Confidence: {confidence * 100:.2f}%")

        return {
            "animal": animal,
            "animal_confidence": animal_confidence,
            "breed": breed,
            "breed_confidence": confidence
        }

    elif animal == "bird":

        species, confidence = predict(
            bird_model,
            bird_classes,
            image
        )

        print("\n==============================")
        print("STEP 2 - BIRD SPECIES")
        print("==============================")

        print(f"Species: {species}")
        print(f"Confidence: {confidence * 100:.2f}%")

        return {
            "animal": animal,
            "animal_confidence": animal_confidence,
            "breed": species,
            "breed_confidence": confidence
        }

    elif animal == "rabbit":

        print("\n==============================")
        print("RESULT")
        print("==============================")

        print("Animal: Rabbit")
        print("No specialist model needed.")

        return {
            "animal": animal,
            "animal_confidence": animal_confidence,
            "breed": None,
            "breed_confidence": None
        }

    elif animal == "hamster":

        print("\n==============================")
        print("RESULT")
        print("==============================")

        print("Animal: Hamster")
        print("No specialist model needed.")

        return {
            "animal": animal,
            "animal_confidence": animal_confidence,
            "breed": None,
            "breed_confidence": None
        }


# =========================
# TEST
# =========================

if __name__ == "__main__":

    image_path = input(
        "Nhap duong dan anh: "
    ).strip()

    if not os.path.exists(image_path):
        print("Khong tim thay anh!")
        exit()

    result = predict_pet(image_path)

    print("\n==============================")
    print("FINAL RESULT")
    print("==============================")

    print(result)