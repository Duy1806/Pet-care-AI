import base64
from io import BytesIO

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image, UnidentifiedImageError

from app.schemas.nutrition import NutritionRequest
from app.services.nutrition_engine import evaluate_nutrition_profile
from app.services.pet_classifier import predict_pet


app = FastAPI(
    title="DACN2 Pet Care API",
    description=(
        "API nhan dien thu cung bang model da huan luyen "
        "va danh gia dinh duong theo bo quy tac."
    ),
    version="0.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Base64PredictRequest(BaseModel):
    image_base64: str


@app.get("/")
def home():
    return {
        "message": "DACN2 Pet Care API",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "pet_prediction": "/pet/predict",
            "pet_prediction_base64": "/pet/predict-base64",
            "nutrition_evaluation": "/nutrition/evaluate",
            "documentation": "/docs",
        },
        "supported_species": [
            "dog",
            "cat",
        ],
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "pet-care-api",
    }


@app.post("/nutrition/evaluate")
def evaluate_nutrition(pet: NutritionRequest):
    return evaluate_nutrition_profile(pet)


@app.post("/pet/predict-base64")
async def predict_pet_image_base64(payload: Base64PredictRequest):
    raw_b64 = payload.image_base64.strip()
    if "," in raw_b64:
        raw_b64 = raw_b64.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(raw_b64)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Chuoi base64 khong hop le.",
        )

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="Du lieu anh rong.",
        )

    try:
        with Image.open(BytesIO(image_bytes)) as original:
            original.verify()

        with Image.open(BytesIO(image_bytes)) as original:
            image_format = original.format
            image = original.copy()

        result = predict_pet(image)

        return {
            "image_format": image_format,
            "image_size": {
                "width": image.width,
                "height": image.height,
            },
            "prediction": result,
        }

    except (UnidentifiedImageError, OSError) as e:
        import logging
        logging.warning("File khong phai anh hop le: %s", str(e))
        raise HTTPException(
            status_code=400,
            detail="File khong phai anh hop le hoac anh bi loi.",
        )

    except Exception:
        import logging
        logging.exception("Loi khi nhan dien anh thu cung")
        raise HTTPException(
            status_code=500,
            detail="Khong the nhan dien anh. Kiem tra log backend.",
        )


@app.post("/pet/predict")
async def predict_pet_image(
    file: UploadFile = File(..., description="Anh thu cung can nhan dien"),
):
    max_file_size = 15 * 1024 * 1024  # 15 MB
    image_bytes = await file.read(max_file_size + 1)

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="File anh rong.",
        )

    if len(image_bytes) > max_file_size:
        raise HTTPException(
            status_code=413,
            detail="Anh vuot qua dung luong toi da 15 MB.",
        )

    try:
        with Image.open(BytesIO(image_bytes)) as original:
            original.verify()

        with Image.open(BytesIO(image_bytes)) as original:
            image_format = original.format
            image = original.copy()

        result = predict_pet(image)

        return {
            "filename": file.filename,
            "image_format": image_format,
            "image_size": {
                "width": image.width,
                "height": image.height,
            },
            "prediction": result,
        }

    except (UnidentifiedImageError, OSError) as e:
        import logging
        logging.warning("File khong phai anh hop le: %s", str(e))
        raise HTTPException(
            status_code=400,
            detail="File khong phai anh hop le hoac anh bi loi.",
        )

    except Exception:
        import logging
        logging.exception("Loi khi nhan dien anh thu cung")

        raise HTTPException(
            status_code=500,
            detail="Khong the nhan dien anh. Kiem tra log backend.",
        )

    finally:
        await file.close()
