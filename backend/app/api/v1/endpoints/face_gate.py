"""
Gate Recognition Endpoints — Entry and Exit via Face Recognition or QR Code.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.core.database import get_db
from app.services.visitor_service import (
    get_all_face_embeddings,
    get_visitor_by_visitor_id,
    record_entry,
    record_exit,
    check_blacklist,
    get_active_visit_log,
)
from app.models.visitor import Visitor, VisitorStatus
from app.models.entry_exit import RecognitionMethod
from app.schemas.visitor import RecognitionRequest, RecognitionResponse
from app.ai.face_recognition.recognizer import get_face_engine
from app.ai.liveness.detector import analyze_static_image
from app.core.config import settings
from sqlalchemy import select
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/gate", tags=["Gate Recognition"])


@router.post("/recognize", response_model=RecognitionResponse)
async def recognize_face(payload: RecognitionRequest, db: AsyncSession = Depends(get_db)):
    """
    Core face recognition endpoint for entry and exit gates.
    1. Detect face in frame
    2. Run liveness check
    3. Match against visitor database
    4. Record entry or exit
    """
    engine = get_face_engine()

    # Decode image
    image = engine.decode_image(payload.image)
    if image is None:
        return RecognitionResponse(matched=False, visitor_id=None, visitor_name=None,
                                   department=None, purpose=None, host_employee=None,
                                   confidence=0.0, message="Invalid image data")

    # Detect & embed
    face_result = engine.detect_and_embed(image)
    if not face_result.detected:
        return RecognitionResponse(matched=False, visitor_id=None, visitor_name=None,
                                   department=None, purpose=None, host_employee=None,
                                   confidence=0.0, message="No face detected in frame")

    if face_result.confidence < settings.MIN_FACE_CONFIDENCE:
        return RecognitionResponse(matched=False, visitor_id=None, visitor_name=None,
                                   department=None, purpose=None, host_employee=None,
                                   confidence=face_result.confidence,
                                   message="Face quality too low. Please face the camera directly.")

    # Liveness check (static analysis for API; real-time video done on frontend)
    if face_result.face_image is not None:
        liveness = analyze_static_image(face_result.face_image, settings.LIVENESS_THRESHOLD)
        if not liveness.is_live:
            return RecognitionResponse(matched=False, visitor_id=None, visitor_name=None,
                                       department=None, purpose=None, host_employee=None,
                                       confidence=0.0, message="Liveness check failed. Please present your face naturally.")

    # Load all embeddings and match
    embeddings_db = await get_all_face_embeddings(db)
    if not embeddings_db:
        return RecognitionResponse(matched=False, visitor_id=None, visitor_name=None,
                                   department=None, purpose=None, host_employee=None,
                                   confidence=0.0, message="Visitor database empty. No registrations found.")

    match_result = engine.match_against_database(face_result.embedding, embeddings_db)

    if not match_result.matched:
        return RecognitionResponse(
            matched=False, visitor_id=None, visitor_name=None,
            department=None, purpose=None, host_employee=None,
            confidence=match_result.confidence,
            message="Visitor not registered. Please register at the reception.",
        )

    # Fetch visitor details
    visitor = await get_visitor_by_visitor_id(db, match_result.visitor_id)
    if not visitor:
        return RecognitionResponse(matched=False, visitor_id=None, visitor_name=None,
                                   department=None, purpose=None, host_employee=None,
                                   confidence=0.0, message="Visitor record not found")

    # Blacklist check — highest priority
    is_blacklisted = await check_blacklist(db, visitor.id)
    if is_blacklisted:
        return RecognitionResponse(
            matched=True,
            visitor_id=visitor.visitor_id,
            visitor_name=visitor.name,
            department=visitor.department_name,
            purpose=visitor.purpose,
            host_employee=visitor.host_employee_name,
            confidence=match_result.confidence,
            is_blacklisted=True,
            message="SECURITY ALERT: This visitor is blacklisted. Do not allow entry.",
        )

    # Approval check for entry
    gate_type = payload.gate_type.lower()
    if gate_type == "entry":
        if visitor.status not in (VisitorStatus.APPROVED, VisitorStatus.EXITED):
            return RecognitionResponse(
                matched=True,
                visitor_id=visitor.visitor_id,
                visitor_name=visitor.name,
                department=visitor.department_name,
                purpose=visitor.purpose,
                host_employee=visitor.host_employee_name,
                confidence=match_result.confidence,
                message=f"Visit not approved yet. Current status: {visitor.status.value}",
            )

        log = await record_entry(
            db, visitor,
            confidence=match_result.confidence,
            method=RecognitionMethod.FACE,
            camera_id=payload.camera_id,
        )
        entry_time_str = log.entry_time.strftime("%I:%M:%S %p") if log.entry_time else "N/A"
        return RecognitionResponse(
            matched=True,
            visitor_id=visitor.visitor_id,
            visitor_name=visitor.name,
            department=visitor.department_name,
            purpose=visitor.purpose,
            host_employee=visitor.host_employee_name,
            confidence=match_result.confidence,
            message="Entry recorded successfully",
            entry_time=entry_time_str,
            log_id=log.log_id,
        )

    elif gate_type == "exit":
        active_log = await get_active_visit_log(db, visitor.id)
        if not active_log:
            return RecognitionResponse(
                matched=True,
                visitor_id=visitor.visitor_id,
                visitor_name=visitor.name,
                department=visitor.department_name,
                purpose=visitor.purpose,
                host_employee=visitor.host_employee_name,
                confidence=match_result.confidence,
                message="No active visit found. Visitor may have already exited.",
            )

        log = await record_exit(
            db, visitor,
            confidence=match_result.confidence,
            method=RecognitionMethod.FACE,
            camera_id=payload.camera_id,
        )
        hours = int(log.duration_minutes // 60)
        mins = int(log.duration_minutes % 60)
        duration_str = f"{hours} Hours {mins} Minutes" if hours > 0 else f"{mins} Minutes"
        return RecognitionResponse(
            matched=True,
            visitor_id=visitor.visitor_id,
            visitor_name=visitor.name,
            department=visitor.department_name,
            purpose=visitor.purpose,
            host_employee=visitor.host_employee_name,
            confidence=match_result.confidence,
            message=f"Exit recorded. Duration: {duration_str}",
            log_id=log.log_id,
        )

    raise HTTPException(status_code=400, detail="gate_type must be 'entry' or 'exit'")


@router.post("/qr-verify")
async def verify_qr(pass_token: str, gate_type: str = "entry", db: AsyncSession = Depends(get_db)):
    """QR code verification at gates."""
    result = await db.execute(select(Visitor).where(Visitor.pass_token == pass_token))
    visitor = result.scalar_one_or_none()
    if not visitor:
        raise HTTPException(status_code=404, detail="Invalid QR code")

    is_blacklisted = await check_blacklist(db, visitor.id)
    if is_blacklisted:
        return {"allowed": False, "message": "BLACKLISTED VISITOR", "visitor": None}

    if gate_type == "entry":
        log = await record_entry(db, visitor, confidence=1.0, method=RecognitionMethod.QR)
        return {
            "allowed": True,
            "message": "Entry via QR recorded",
            "visitor": {
                "visitor_id": visitor.visitor_id,
                "name": visitor.name,
                "department": visitor.department_name,
                "host_employee": visitor.host_employee_name,
                "entry_time": log.entry_time.strftime("%I:%M %p"),
            },
        }
    else:
        log = await record_exit(db, visitor, confidence=1.0, method=RecognitionMethod.QR)
        return {"allowed": True, "message": "Exit via QR recorded", "visitor": {"visitor_id": visitor.visitor_id}}
