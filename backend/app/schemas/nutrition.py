
from typing import Literal

from pydantic import BaseModel, Field, model_validator


Species = Literal[
    "dog",
    "cat",
    "bird",
    "rabbit",
    "hamster",
]

ActivityLevel = Literal[
    "low",
    "moderate",
    "high",
]

LifeStage = Literal[
    "baby",
    "adult",
    "senior",
]


class NutritionRequest(BaseModel):
    species: Species = Field(
        description="Loai thu cung"
    )

    breed: str | None = Field(
        default=None,
        max_length=100,
        description="Giong thu cung",
    )

    age_months: int = Field(
        gt=0,
        le=600,
        description="Tuoi tinh theo thang",
    )

    weight_kg: float = Field(
        gt=0,
        le=200,
        description="Can nang tinh theo kg",
    )

    life_stage: LifeStage

    activity_level: ActivityLevel

    body_condition: Literal[
        "underweight",
        "ideal",
        "overweight",
        "unknown",
    ] = "unknown"

    health_notes: str | None = Field(
        default=None,
        max_length=1000,
        description="Thong tin suc khoe do chu nuoi cung cap",
    )

    @model_validator(mode="after")
    def validate_species_input(self):
        if self.species == "hamster" and self.weight_kg > 1:
            raise ValueError(
                "Can kiem tra lai can nang hamster; "
                "gia tri tren 1 kg bat thuong."
            )

        if self.species == "rabbit" and self.weight_kg > 20:
            raise ValueError(
                "Can kiem tra lai can nang tho."
            )

        return self
