
from io import BytesIO

from fastapi import FastAPI, File, HTTPException, UploadFile
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


@app.get("/")
def home():
    return {
        "message": "DACN2 Pet Care API",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "pet_prediction": "/pet/predict",
            "nutrition_evaluation": "/nutrition/evaluate",
            "documentation": "/docs",
        },
        "supported_species": [
            "dog",
            "cat",
            "bird",
            "rabbit",
            "hamster",
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


@app.post("/pet/predict")
async def predict_pet_image(
    file: UploadFile = File(..., description="Anh thu cung can nhan dien"),
):
    allowed_content_types = {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/bmp",
    }

    if file.content_type not in allowed_content_types:
        raise HTTPException(
            status_code=415,
            detail="Chi chap nhan anh JPEG, PNG, WEBP hoac BMP.",
        )

    max_file_size = 10 * 1024 * 1024  # 10 MB
    image_bytes = await file.read(max_file_size + 1)

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="File anh rong.",
        )

    if len(image_bytes) > max_file_size:
        raise HTTPException(
            status_code=413,
            detail="Anh vuot qua dung luong toi da 10 MB.",
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

    except (UnidentifiedImageError, OSError):
        raise HTTPException(
            status_code=400,
            detail="File khong phai anh hop le hoac anh bi loi.",
        )

    except Exception:
        # Ghi loi chi tiet o terminal server; khong tra traceback cho client.
        import logging
        logging.exception("Loi khi nhan dien anh thu cung")

        raise HTTPException(
            status_code=500,
            detail="Khong the nhan dien anh. Kiem tra log backend.",
        )

    finally:
        await file.close()
