import os
import torch
from PIL import Image
from torchvision import models, transforms


# =========================
# CONFIG
# =========================

MODEL_PATH = r"D:\DACN2\models\pet_5class_mobilenetv3_small_best.pth"

CLASS_NAMES = [
    "bird",
    "cat",
    "dog",
    "hamster",
    "rabbit"
]

DEVICE = torch.device("cpu")


# =========================
# PREPROCESSING
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

print("=" * 60)
print("PET IMAGE CLASSIFICATION")
print("=" * 60)

print("\nLoading model...")

model = models.mobilenet_v3_small(weights=None)

# Giống cấu trúc lúc train: 5 classes
in_features = model.classifier[-1].in_features
model.classifier[-1] = torch.nn.Linear(
    in_features,
    len(CLASS_NAMES)
)

checkpoint = torch.load(
    MODEL_PATH,
    map_location=DEVICE,
    weights_only=True
)

model.load_state_dict(checkpoint["model_state_dict"])
model.to(DEVICE)
model.eval()

print("✓ Model loaded successfully")


# =========================
# SELECT IMAGE
# =========================

image_path = input("\nNhập đường dẫn ảnh cần test: ").strip().strip('"')

if not os.path.exists(image_path):
    print("\n❌ Không tìm thấy ảnh!")
    print("Đường dẫn:", image_path)
    exit()


# =========================
# LOAD IMAGE
# =========================

try:
    image = Image.open(image_path).convert("RGB")
except Exception as e:
    print("\n❌ Không thể đọc ảnh:", e)
    exit()


# =========================
# PREDICTION
# =========================

input_tensor = transform(image)
input_tensor = input_tensor.unsqueeze(0).to(DEVICE)

with torch.no_grad():
    output = model(input_tensor)

    probabilities = torch.softmax(output, dim=1)[0]

    top_probs, top_indices = torch.topk(
        probabilities,
        k=len(CLASS_NAMES)
    )


# =========================
# RESULT
# =========================

predicted_index = top_indices[0].item()
predicted_class = CLASS_NAMES[predicted_index]
confidence = top_probs[0].item() * 100

print("\n" + "=" * 60)
print("RESULT")
print("=" * 60)

print(f"\nImage      : {image_path}")
print(f"Prediction : {predicted_class}")
print(f"Confidence : {confidence:.2f}%")

print("\nTop predictions:")

for rank, (prob, index) in enumerate(
    zip(top_probs, top_indices),
    start=1
):
    class_name = CLASS_NAMES[index.item()]
    percentage = prob.item() * 100

    print(
        f"{rank}. {class_name:<10} "
        f"{percentage:>6.2f}%"
    )

print("\n" + "=" * 60)