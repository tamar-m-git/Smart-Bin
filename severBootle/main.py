from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import tensorflow as tf
from keras import layers
import numpy as np
from PIL import Image
import uvicorn
import io
import requests
import os
import time

from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
PREDICT_DIR = Path("image_predict")
PREDICT_DIR.mkdir(exist_ok=True)
IMAGE_PATH = PREDICT_DIR / "last.jpg"
LABEL_PATH = PREDICT_DIR / "prediction.txt"
ESP_CAM_IP = "http://192.168.55.9"

# הוספת middleware של CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# טעינת המודל
model_path = "model"
model = tf.keras.Sequential([
    layers.TFSMLayer(model_path, call_endpoint="serving_default", name="saved_model")
])
print("מודל נטען בהצלחה")

# טעינת שמות התוויות-סיווגים
with open("labels.txt", "r", encoding="utf-8") as f:
    labels = [line.strip().split(" ", 1)[-1] for line in f.readlines()]


def predict_from_bytes(image_bytes: bytes) -> str:
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image = image.resize((224, 224))
        image_array = np.asarray(image).astype(np.float32)
        normalized_image_array = (image_array / 127.5) - 1
        input_data = np.expand_dims(normalized_image_array, axis=0)

        outputs = model(input_data, training=False)
        prediction = list(outputs.values())[0].numpy()[0]  # צורה: (num_labels,)

        # הדפסה של ההסתברויות לכל תווית
        for i, prob in enumerate(prediction):
            print(f"{labels[i]}: {prob * 100:.2f}%")

        index = int(np.argmax(prediction))
        label = labels[index]
        return label

    except Exception as e:
        raise RuntimeError(f"שגיאה בחיזוי: {e}")


@app.get('/first')
async def check_connection():
    return {"status": "✅ השרת פועל והתקשורת תקינה"}

# @app.post("/predict")
# async def predict(image: UploadFile = File(...)):
#     if not image.content_type.startswith("image/"):
#         raise HTTPException(status_code=400, detail="הקובץ ששלחת אינו תמונה")
#     try:
#         image_bytes = await image.read()
#         label = predict_from_bytes(image_bytes)
#         return JSONResponse(content={"prediction": label})
#     except Exception as e:
#         return JSONResponse(content={"error": str(e)}, status_code=500)

#בקשה חדשה ונכונה


@app.get("/auto-predict")
async def auto_predict():
    try:
        #  בקשת תמונה מהמצלמה
        timestamp = int(time.time() * 1000)
        capture_url = f"{ESP_CAM_IP}/capture?t={timestamp}"
        response = requests.get(capture_url)
        if response.status_code != 200:
            raise RuntimeError("שגיאה בקבלת תמונה מהמצלמה")

        image_bytes = response.content
        with open(IMAGE_PATH, "wb") as f:
            f.write(image_bytes)
        #חיזוי
        label = predict_from_bytes(image_bytes)
        with open(LABEL_PATH, "w", encoding="utf-8") as f:
            f.write(label)

        #  החזרת תוצאה ל־ESP
        return {"prediction": label}

    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


from fastapi.responses import FileResponse

@app.get("/last-image")
async def get_last_image():
    if IMAGE_PATH.exists():
        return FileResponse(IMAGE_PATH, media_type="image/jpeg")
    else:
        raise HTTPException(status_code=404, detail="No image found")

@app.get("/last-prediction")
async def get_last_prediction():
    if LABEL_PATH.exists():
        with open(LABEL_PATH, "r", encoding="utf-8") as f:
            label = f.read().strip()
        return {"prediction": label}
    else:
        return {"prediction": None}
# להרצה ישירה עם uvicorn
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8888, reload=True)
    print("success!")