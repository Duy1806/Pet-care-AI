
from app.schemas.nutrition import NutritionRequest
from app.data.nutrition_rules import get_rules_for_species

SUPPORTED_SPECIES = {
    "dog": "Cho",
    "cat": "Meo",
    "bird": "Chim",
    "rabbit": "Tho",
    "hamster": "Hamster",
}


def evaluate_nutrition_profile(pet: NutritionRequest) -> dict:
    """
    Danh gia dinh duong so bo dua tren thong tin thu cung
    va bo quy tac dinh duong da khai bao.
    """

    species = pet.species

    result = {
        "species": species,
        "species_vi": SUPPORTED_SPECIES[species],
        "breed": pet.breed,
        "age_months": pet.age_months,
        "weight_kg": pet.weight_kg,
        "life_stage": pet.life_stage,
        "activity_level": pet.activity_level,
        "body_condition": pet.body_condition,
        "assessment": [],
        "warnings": [],
        "nutrition_rules": [],
        "sources": [],
        "recommendation_status": "preliminary_assessment",
    }

    # 1. Danh gia theo giai doan song
    if pet.life_stage == "baby":
        result["assessment"].append(
            "Thu cung dang o giai doan con non; "
            "can ap dung huong dan dinh duong theo tang truong."
        )
    elif pet.life_stage == "senior":
        result["assessment"].append(
            "Can xem xet giai doan cao tuoi va tinh trang suc khoe."
        )
    else:
        result["assessment"].append(
            "Can doi chieu nhu cau duy tri cua thu cung truong thanh."
        )

    # 2. Danh gia theo tung loai
    if species == "dog":
        result["assessment"].append(
            "Can danh gia nhu cau nang luong theo can nang, "
            "giai doan song, van dong va tinh trang co the."
        )
    elif species == "cat":
        result["assessment"].append(
            "Can xem xet nhu cau dinh duong dac thu cua meo "
            "va dam bao thuc an dap ung cac chat dinh duong thiet yeu."
        )
    elif species == "bird":
        result["assessment"].append(
            "Can xac dinh loai chim cu the truoc khi chon che do an."
        )
    elif species == "rabbit":
        result["assessment"].append(
            "Can uu tien che do an dac thu cho tho, co kho phu hop "
            "va nuoc sach."
        )
    elif species == "hamster":
        result["assessment"].append(
            "Can chon thuc an phu hop voi loai hamster va "
            "nhu cau cua tung ca the."
        )

    # 3. Ap dung cac quy tac dinh duong phu hop
    available_rules = get_rules_for_species(species)

    for rule in available_rules:
        condition = rule.get("condition", "general")
        should_apply = False

        if condition == "general":
            should_apply = True
        elif condition == "underweight":
            should_apply = pet.body_condition == "underweight"
        elif condition == "overweight":
            should_apply = pet.body_condition == "overweight"
        elif condition == "unknown_breed":
            should_apply = (
                species in ("bird", "hamster")
                and not pet.breed
            )

        if not should_apply:
            continue

        result["nutrition_rules"].append({
            "rule_id": rule.get("rule_id"),
            "condition": condition,
            "recommendation": rule.get("recommendation", ""),
            "warning": rule.get("warning"),
        })

        source_name = rule.get("source_name")
        source_url = rule.get("source_url")

        if source_name or source_url:
            source = {
                "name": source_name,
                "url": source_url,
            }

            if source not in result["sources"]:
                result["sources"].append(source)

        warning = rule.get("warning")
        if warning and warning not in result["warnings"]:
            result["warnings"].append(warning)

    # 4. Canh bao theo tinh trang co the
    if pet.body_condition == "underweight":
        result["warnings"].append(
            "Thu cung duoc khai bao thieu can; "
            "nen danh gia nguyen nhan truoc khi dieu chinh khau phan."
        )
    elif pet.body_condition == "overweight":
        result["warnings"].append(
            "Thu cung duoc khai bao thua can; "
            "khong tu y cat giam thuc an qua muc."
        )
    elif pet.body_condition == "unknown":
        result["warnings"].append(
            "Chua biet tinh trang co the; "
            "ket qua hien tai chi la danh gia so bo."
        )

    # 5. Them canh bao neu co thong tin suc khoe
    if pet.health_notes and pet.health_notes.strip():
        result["warnings"].append(
            "Ho so co ghi chu suc khoe; can xem xet thong tin nay "
            "truoc khi dua ra khuyen nghi ca nhan hoa."
        )

    # Loai bo canh bao trung lap
    result["warnings"] = list(dict.fromkeys(result["warnings"]))

    return result
