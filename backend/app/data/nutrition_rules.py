
"""
Nutrition rules for DACN2 Pet Care.
Each rule includes a source for traceability.

These are general educational rules, not a veterinary diagnosis
or a personalized feeding prescription.
"""

NUTRITION_RULES = [
    # DOG
    {
        "rule_id": "DOG-001",
        "species": "dog",
        "condition": "general",
        "recommendation": (
            "Chon thuc an hoan chinh va can doi, phu hop voi "
            "giai doan song cua cho."
        ),
        "warning": (
            "Nhu cau thuc te con phu thuoc vao tinh trang co the, "
            "van dong va suc khoe."
        ),
        "source_name": "WSAVA Global Nutrition Guidelines",
        "source_url": (
            "https://wsava.org/Global-Guidelines/"
            "Global-Nutrition-Guidelines/"
        ),
    },
    {
        "rule_id": "DOG-002",
        "species": "dog",
        "condition": "underweight",
        "recommendation": (
            "Can danh gia tinh trang dinh duong va nguyen nhan "
            "truoc khi dieu chinh khau phan."
        ),
        "warning": (
            "Neu sut can khong ro nguyen nhan hoac kem dau hieu "
            "bat thuong, nen lien he bac si thu y."
        ),
        "source_name": "WSAVA Global Nutrition Guidelines",
        "source_url": (
            "https://wsava.org/Global-Guidelines/"
            "Global-Nutrition-Guidelines/"
        ),
    },

    # CAT
    {
        "rule_id": "CAT-001",
        "species": "cat",
        "condition": "general",
        "recommendation": (
            "Chon thuc an hoan chinh, can doi va phu hop voi "
            "giai doan song cua meo; dam bao nhu cau dinh duong "
            "dac thu cua meo."
        ),
        "warning": (
            "Khong dung quy tac dinh duong cua cho de thay the "
            "cho nhu cau rieng cua meo."
        ),
        "source_name": "Merck Veterinary Manual",
        "source_url": (
            "https://www.merckvetmanual.com/management-and-nutrition/"
            "nutrition-small-animals/nutritional-requirements-of-small-animals"
        ),
    },
    {
        "rule_id": "CAT-002",
        "species": "cat",
        "condition": "overweight",
        "recommendation": (
            "Can danh gia tinh trang co the va khau phan hien tai "
            "truoc khi lap ke hoach kiem soat can nang."
        ),
        "warning": (
            "Khong tu y cat giam thuc an qua muc; thay doi che do "
            "an cua meo can duoc thuc hien than trong."
        ),
        "source_name": "WSAVA Global Nutrition Guidelines",
        "source_url": (
            "https://wsava.org/Global-Guidelines/"
            "Global-Nutrition-Guidelines/"
        ),
    },

    # BIRD
    {
        "rule_id": "BIRD-001",
        "species": "bird",
        "condition": "general",
        "recommendation": (
            "Can xac dinh loai chim cu the truoc khi dua ra "
            "khuyen nghi ve che do an chuyen biet."
        ),
        "warning": (
            "Khong ap dung mot cong thuc khau phan chung cho "
            "tat ca cac loai chim canh."
        ),
        "source_name": "Merck Veterinary Manual - Nutrition in Birds",
        "source_url": (
            "https://www.merckvetmanual.com/management-and-nutrition/"
            "nutrition-exotic-and-zoo-animals/nutrition-in-birds"
        ),
    },
    {
        "rule_id": "BIRD-002",
        "species": "bird",
        "condition": "unknown_breed",
        "recommendation": (
            "Bo sung thong tin loai chim de co the tim huong dan "
            "dinh duong phu hop hon."
        ),
        "warning": (
            "Chua du thong tin de dua ra khau phan rieng cho loai chim."
        ),
        "source_name": "Merck Veterinary Manual - Nutrition in Birds",
        "source_url": (
            "https://www.merckvetmanual.com/management-and-nutrition/"
            "nutrition-exotic-and-zoo-animals/nutrition-in-birds"
        ),
    },

    # RABBIT
    {
        "rule_id": "RABBIT-001",
        "species": "rabbit",
        "condition": "general",
        "recommendation": (
            "Khau phan tho can co co kho hoac co tuoi phu hop, "
            "nuoc sach va cac thanh phan thuc an phu hop voi tho."
        ),
        "warning": (
            "Can thay doi thuc an tu tu; neu tho bo an hoac thay doi "
            "luong phan bat thuong, can lien he bac si thu y som."
        ),
        "source_name": "RSPCA - Rabbit Diet",
        "source_url": (
            "https://www.rspca.org.uk/adviceandwelfare/pets/rabbits/diet"
        ),
    },
    {
        "rule_id": "RABBIT-002",
        "species": "rabbit",
        "condition": "overweight",
        "recommendation": (
            "Danh gia tinh trang co the, loai thuc an va khau phan "
            "hien tai truoc khi dieu chinh."
        ),
        "warning": (
            "Khong cat bo co kho hoac tu y han che thuc an cuc doan "
            "de giam can."
        ),
        "source_name": "RSPCA - Rabbit Diet",
        "source_url": (
            "https://www.rspca.org.uk/adviceandwelfare/pets/rabbits/diet"
        ),
    },

    # HAMSTER
    {
        "rule_id": "HAMSTER-001",
        "species": "hamster",
        "condition": "general",
        "recommendation": (
            "Su dung thuc an hoan chinh danh cho hamster, cung cap "
            "nuoc sach va chi bo sung thuc pham phu hop."
        ),
        "warning": (
            "Theo doi viec an uong va tinh trang co the; khong tu "
            "y dua ra khau phan chinh xac chi tu can nang."
        ),
        "source_name": "UC Davis School of Veterinary Medicine",
        "source_url": (
            "https://healthtopics.vetmed.ucdavis.edu/health-topics/"
            "exotics/hamster-care"
        ),
    },
    {
        "rule_id": "HAMSTER-002",
        "species": "hamster",
        "condition": "unknown_breed",
        "recommendation": (
            "Neu biet, hay bo sung loai hamster de viec tham khao "
            "huong dan cham soc duoc cu the hon."
        ),
        "warning": (
            "Khong the suy ra day du nhu cau dinh duong chi tu ten "
            "hamster hoac can nang."
        ),
        "source_name": "RSPCA - Hamster Diet",
        "source_url": (
            "https://www.rspca.org.uk/adviceandwelfare/pets/rodents/"
            "hamsters/diet"
        ),
    },
]


def get_rules_for_species(species: str) -> list[dict]:
    """Return all nutrition rules belonging to a species."""
    normalized_species = species.strip().lower()
    return [
        rule for rule in NUTRITION_RULES
        if rule["species"] == normalized_species
    ]


def get_rule_by_id(rule_id: str) -> dict | None:
    """Find one nutrition rule by its unique ID."""
    for rule in NUTRITION_RULES:
        if rule["rule_id"] == rule_id:
            return rule
    return None
