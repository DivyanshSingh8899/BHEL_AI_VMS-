"""
BHEL VMS Face Recognition Engine
Gracefully degrades if heavy AI libs (OpenCV, DeepFace, InsightFace) are not installed.
"""
import base64
import numpy as np
from typing import Optional, List, Tuple
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    logger.warning("OpenCV (cv2) not installed. Image processing degraded.")

try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
except ImportError:
    DEEPFACE_AVAILABLE = False

try:
    from insightface.app import FaceAnalysis
    INSIGHTFACE_AVAILABLE = True
except ImportError:
    INSIGHTFACE_AVAILABLE = False


@dataclass
class FaceDetectionResult:
    detected: bool
    confidence: float
    bbox: Optional[Tuple[int, int, int, int]]
    embedding: Optional[List[float]]
    face_image: Optional[object]
    landmarks: Optional[object]
    age: Optional[int] = None
    gender: Optional[str] = None


@dataclass
class RecognitionResult:
    matched: bool
    visitor_id: Optional[str]
    confidence: float
    distance: float
    face_result: FaceDetectionResult


class FaceRecognitionEngine:
    def __init__(self, threshold: float = 0.6):
        self.threshold = threshold
        self._insight_app = None
        self._initialized = False
        self._initialize()

    def _initialize(self):
        if INSIGHTFACE_AVAILABLE:
            try:
                self._insight_app = FaceAnalysis(
                    name="buffalo_l",
                    providers=["CPUExecutionProvider"],
                )
                self._insight_app.prepare(ctx_id=-1, det_size=(640, 640))
                self._initialized = True
                logger.info("InsightFace ready")
            except Exception as e:
                logger.warning(f"InsightFace init failed: {e}")

        if not self._initialized and DEEPFACE_AVAILABLE:
            self._initialized = True
            logger.info("DeepFace ready")

        if not self._initialized:
            logger.warning("No AI face library available — running in stub mode")

    def decode_image(self, image_data: str):
        if not CV2_AVAILABLE:
            return None
        try:
            if image_data.startswith("data:image"):
                image_data = image_data.split(",")[1]
            img_bytes = base64.b64decode(image_data)
            nparr = np.frombuffer(img_bytes, np.uint8)
            return cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except Exception as e:
            logger.error(f"Image decode error: {e}")
            return None

    def detect_and_embed(self, image) -> FaceDetectionResult:
        if image is None or not self._initialized:
            return FaceDetectionResult(False, 0.0, None, None, None, None)

        if self._insight_app:
            return self._detect_insightface(image)
        if DEEPFACE_AVAILABLE:
            return self._detect_deepface(image)
        return FaceDetectionResult(False, 0.0, None, None, None, None)

    def _detect_insightface(self, image) -> FaceDetectionResult:
        try:
            faces = self._insight_app.get(image)
            if not faces:
                return FaceDetectionResult(False, 0.0, None, None, None, None)
            face = max(faces, key=lambda f: f.det_score)
            bbox = face.bbox.astype(int)
            x1, y1, x2, y2 = bbox
            face_crop = image[max(0, y1):y2, max(0, x1):x2]
            return FaceDetectionResult(
                detected=True, confidence=float(face.det_score),
                bbox=(x1, y1, x2 - x1, y2 - y1),
                embedding=face.normed_embedding.tolist(),
                face_image=face_crop, landmarks=None,
            )
        except Exception as e:
            logger.error(f"InsightFace error: {e}")
            return FaceDetectionResult(False, 0.0, None, None, None, None)

    def _detect_deepface(self, image) -> FaceDetectionResult:
        try:
            result = DeepFace.represent(
                img_path=image, model_name="Facenet512",
                detector_backend="opencv", enforce_detection=True, align=True,
            )
            if not result:
                return FaceDetectionResult(False, 0.0, None, None, None, None)
            rep = result[0]
            region = rep.get("facial_area", {})
            x, y, w, h = region.get("x", 0), region.get("y", 0), region.get("w", 0), region.get("h", 0)
            return FaceDetectionResult(
                detected=True, confidence=float(rep.get("face_confidence", 0.9)),
                bbox=(x, y, w, h), embedding=rep["embedding"],
                face_image=image[y:y+h, x:x+w] if w > 0 else image, landmarks=None,
            )
        except Exception as e:
            logger.debug(f"DeepFace detect: {e}")
            return FaceDetectionResult(False, 0.0, None, None, None, None)

    def compute_similarity(self, emb1: List[float], emb2: List[float]) -> float:
        v1 = np.array(emb1, dtype=np.float32)
        v2 = np.array(emb2, dtype=np.float32)
        v1 = v1 / (np.linalg.norm(v1) + 1e-8)
        v2 = v2 / (np.linalg.norm(v2) + 1e-8)
        return float(np.dot(v1, v2))

    def match_against_database(
        self, probe_embedding: List[float],
        database: List[Tuple[str, List[float]]],
    ) -> RecognitionResult:
        best_similarity = -1.0
        best_visitor_id = None
        for visitor_id, stored_embedding in database:
            try:
                sim = self.compute_similarity(probe_embedding, stored_embedding)
                if sim > best_similarity:
                    best_similarity = sim
                    best_visitor_id = visitor_id
            except Exception:
                continue
        matched = best_similarity >= self.threshold
        return RecognitionResult(
            matched=matched,
            visitor_id=best_visitor_id if matched else None,
            confidence=best_similarity,
            distance=1.0 - best_similarity,
            face_result=FaceDetectionResult(True, best_similarity, None, probe_embedding, None, None),
        )

    def save_face_image(self, image, path: str) -> bool:
        if not CV2_AVAILABLE or image is None:
            return False
        try:
            from pathlib import Path
            Path(path).parent.mkdir(parents=True, exist_ok=True)
            return cv2.imwrite(path, image)
        except Exception:
            return False

    def encode_face_image(self, image) -> str:
        if not CV2_AVAILABLE or image is None:
            return ""
        _, buf = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return base64.b64encode(buf).decode("utf-8")


_engine: Optional[FaceRecognitionEngine] = None


def get_face_engine() -> FaceRecognitionEngine:
    global _engine
    if _engine is None:
        from app.core.config import settings
        _engine = FaceRecognitionEngine(threshold=settings.FACE_RECOGNITION_THRESHOLD)
    return _engine
