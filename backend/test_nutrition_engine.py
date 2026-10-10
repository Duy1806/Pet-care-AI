
from app.schemas.nutrition import NutritionRequest
from app.services.nutrition_engine import evaluate_nutrition_profile


pet = NutritionRequest(
    species="dog",
    breed="beagle",
    age_months=24,
    weight_kg=12,
    life_stage="adult",
    activity_level="moderate",
    body_condition="ideal",
)

result = evaluate_nutrition_profile(pet)

print("=== NUTRITION ENGINE TEST ===")
print(f"Loai: {result['species_vi']}")
print(f"Can nang: {result['weight_kg']} kg")
print(f"Trang thai: {result['recommendation_status']}")

print("\nDanh gia:")
for item in result["assessment"]:
    print("-", item)

print("\nCanh bao:")
for warning in result["warnings"]:
    print("-", warning)
