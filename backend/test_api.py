
import json
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

test_cases = [
    {
        "name": "Cho",
        "data": {
            "species": "dog",
            "breed": "beagle",
            "age_months": 24,
            "weight_kg": 12,
            "life_stage": "adult",
            "activity_level": "moderate",
            "body_condition": "ideal",
            "health_notes": None,
        },
    },
    {
        "name": "Meo thua can",
        "data": {
            "species": "cat",
            "breed": "domestic shorthair",
            "age_months": 18,
            "weight_kg": 4,
            "life_stage": "adult",
            "activity_level": "moderate",
            "body_condition": "overweight",
            "health_notes": None,
        },
    },
    {
        "name": "Chim chua ro loai",
        "data": {
            "species": "bird",
            "breed": None,
            "age_months": 12,
            "weight_kg": 0.1,
            "life_stage": "adult",
            "activity_level": "moderate",
            "body_condition": "unknown",
            "health_notes": None,
        },
    },
    {
        "name": "Tho",
        "data": {
            "species": "rabbit",
            "breed": None,
            "age_months": 12,
            "weight_kg": 2,
            "life_stage": "adult",
            "activity_level": "moderate",
            "body_condition": "ideal",
            "health_notes": None,
        },
    },
    {
        "name": "Hamster chua ro loai",
        "data": {
            "species": "hamster",
            "breed": None,
            "age_months": 6,
            "weight_kg": 0.1,
            "life_stage": "adult",
            "activity_level": "moderate",
            "body_condition": "ideal",
            "health_notes": None,
        },
    },
]

print("=== KIEM THU API DINH DUONG ===")

for case in test_cases:
    response = client.post(
        "/nutrition/evaluate",
        json=case["data"],
    )

    print(f"\n[{case['name']}] HTTP {response.status_code}")

    if response.status_code == 200:
        result = response.json()
        print("Loai:", result["species_vi"])
        print("Trang thai:", result["recommendation_status"])
        print("So quy tac:", len(result["nutrition_rules"]))
        print("So nguon:", len(result["sources"]))
    else:
        print(response.text)

    assert response.status_code == 200, (
        f"API that bai voi truong hop: {case['name']}"
    )

print("\n=== TAT CA 5 TRUONG HOP THANH CONG ===")
