from fastapi import APIRouter, HTTPException
import base64
import numpy as np
from app.ai.liveness.detector import analyze_static_image
from app.schemas.visitor import LivenessRequest, LivenessResponse
try:
    import cv2
    CV2 = True
except Exception:
    CV2 = False

router = APIRouter(prefix="/liveness", tags=["Liveness"])


@router.post("/analyze", response_model=LivenessResponse)
async def analyze(payload: LivenessRequest):
    """Analyze a static image for liveness (accepts data URL or raw base64)."""
    img_b64 = payload.image
    if not img_b64:
        raise HTTPException(status_code=400, detail="No image provided")

    # strip data url prefix if present
    if img_b64.startswith("data:"):
        try:
            img_b64 = img_b64.split(",", 1)[1]
        except Exception:
            pass

    image = None
    if CV2:
        try:
            img_bytes = base64.b64decode(img_b64)
            arr = np.frombuffer(img_bytes, dtype=np.uint8)
            image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        except Exception:
            image = None

    result = analyze_static_image(image)

    return LivenessResponse(
        is_live=result.is_live,
        confidence=result.confidence,
        blink_detected=result.blink_detected,
        texture_score=result.texture_score,
        reflection_score=result.reflection_score,
        message=result.message,
    )
