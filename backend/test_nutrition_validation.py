
import unittest

from pydantic import ValidationError
from app.schemas.nutrition import NutritionRequest


BASE_DATA = {
    "species": "dog",
    "breed": "beagle",
    "age_months": 24,
    "weight_kg": 12,
    "life_stage": "adult",
    "activity_level": "moderate",
    "body_condition": "ideal",
}


class NutritionValidationTests(unittest.TestCase):

    def test_reject_unknown_species(self):
        with self.assertRaises(ValidationError):
            NutritionRequest(**{**BASE_DATA, "species": "tiger"})

    def test_reject_zero_weight(self):
        with self.assertRaises(ValidationError):
            NutritionRequest(**{**BASE_DATA, "weight_kg": 0})

    def test_reject_negative_age(self):
        with self.assertRaises(ValidationError):
            NutritionRequest(**{**BASE_DATA, "age_months": -1})

    def test_reject_invalid_life_stage(self):
        with self.assertRaises(ValidationError):
            NutritionRequest(**{**BASE_DATA, "life_stage": "teenager"})

    def test_reject_invalid_activity_level(self):
        with self.assertRaises(ValidationError):
            NutritionRequest(**{**BASE_DATA, "activity_level": "extreme"})

    def test_reject_hamster_weight_over_one_kg(self):
        with self.assertRaises(ValidationError):
            NutritionRequest(
                **{
                    **BASE_DATA,
                    "species": "hamster",
                    "breed": None,
                    "weight_kg": 1.5,
                }
            )

    def test_accept_valid_cat_profile(self):
        pet = NutritionRequest(
            **{
                **BASE_DATA,
                "species": "cat",
                "breed": "domestic shorthair",
                "weight_kg": 4,
            }
        )
        self.assertEqual(pet.species, "cat")


if __name__ == "__main__":
    unittest.main(verbosity=2)
