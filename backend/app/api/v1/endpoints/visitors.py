import os
import base64
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_active_user, require_admin_or_receptionist
from app.models.visitor import Visitor, VisitorStatus
from app.models.user import User
from app.schemas.visitor import VisitorRegisterRequest, VisitorResponse, FaceEnrollRequest, FaceEnrollResponse
from app.services.visitor_service import create_visitor, get_visitor_by_visitor_id
from app.services.notification_service import notify_registration
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/visitors", tags=["Visitors"])


@router.post("/register", response_model=VisitorResponse, status_code=status.HTTP_201_CREATED)
async def register_visitor(
    payload: VisitorRegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint — register a new visitor."""
    # Duplicate check by mobile + same-day
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).strftime("%d-%m-%Y")

    dup_check = await db.execute(
        select(Visitor).where(
            and_(
                Visitor.mobile == payload.mobile,
                Visitor.status.notin_([VisitorStatus.EXITED, VisitorStatus.REJECTED]),
            )
        )
    )
    if dup_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A visitor with this mobile number already has an active registration.",
        )

    # Save photo if provided
    photo_path = None
    if payload.photo_base64:
        try:
            img_data = payload.photo_base64
            if img_data.startswith("data:image"):
                img_data = img_data.split(",")[1]
            img_bytes = base64.b64decode(img_data)
            os.makedirs(f"{settings.UPLOAD_DIR}/photos", exist_ok=True)
            filename = f"{uuid.uuid4().hex}.jpg"
            photo_path = f"{settings.UPLOAD_DIR}/photos/{filename}"
            with open(photo_path, "wb") as f:
                f.write(img_bytes)
        except Exception as e:
            logger.warning(f"Failed to save visitor photo: {e}")

    data = payload.model_dump()
    data["photo_path"] = photo_path
    visitor = await create_visitor(db, data)

    # Fire notifications asynchronously
    import asyncio
    asyncio.create_task(notify_registration({
        "name": visitor.name,
        "mobile": visitor.mobile,
        "email": visitor.email,
        "visitor_id": visitor.visitor_id,
        "purpose": visitor.purpose,
        "host_employee_name": visitor.host_employee_name,
        "department_name": visitor.department_name,
    }))

    return visitor


@router.post("/enroll-face", response_model=FaceEnrollResponse)
async def enroll_face(
    payload: FaceEnrollRequest,
    db: AsyncSession = Depends(get_db),
):
    """Enroll visitor face after registration."""
    from app.ai.face_recognition.recognizer import get_face_engine
    import numpy as np
    from datetime import datetime, timezone

    visitor = await get_visitor_by_visitor_id(db, payload.visitor_id)
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")

    engine = get_face_engine()
    embeddings = []

    for img_b64 in payload.images[:5]:  # max 5 enrollment images
        image = engine.decode_image(img_b64)
        if image is None:
            continue
        result = engine.detect_and_embed(image)
        if result.detected and result.embedding:
            embeddings.append(result.embedding)
            # Save enrollment image
            if result.face_image is not None:
                os.makedirs(f"{settings.UPLOAD_DIR}/faces/{visitor.visitor_id}", exist_ok=True)
                save_path = f"{settings.UPLOAD_DIR}/faces/{visitor.visitor_id}/face_{len(embeddings)}.jpg"
                engine.save_face_image(result.face_image, save_path)

    if not embeddings:
        raise HTTPException(status_code=400, detail="No valid face detected in provided images")

    # Average embedding for robustness
    avg_embedding = np.mean(embeddings, axis=0).tolist()

    visitor.face_embedding = avg_embedding
    visitor.face_enrollment_done = True
    visitor.face_enrolled_at = datetime.now(timezone.utc)
    await db.flush()

    return FaceEnrollResponse(
        success=True,
        visitor_id=visitor.visitor_id,
        message="Face enrolled successfully",
        enrolled_images=len(embeddings),
    )


@router.get("", response_model=List[VisitorResponse])
async def list_visitors(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    search: Optional[str] = Query(None, description="Search by name, mobile, or visitor ID"),
    status_filter: Optional[str] = Query(None, alias="status"),
    department: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    query = select(Visitor).order_by(desc(Visitor.created_at))

    if search:
        query = query.where(
            or_(
                Visitor.name.ilike(f"%{search}%"),
                Visitor.mobile.ilike(f"%{search}%"),
                Visitor.visitor_id.ilike(f"%{search}%"),
                Visitor.host_employee_name.ilike(f"%{search}%"),
            )
        )
    if status_filter:
        query = query.where(Visitor.status == VisitorStatus(status_filter))
    if department:
        query = query.where(Visitor.department_name.ilike(f"%{department}%"))

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{visitor_id}", response_model=VisitorResponse)
async def get_visitor(
    visitor_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    visitor = await get_visitor_by_visitor_id(db, visitor_id)
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")
    return visitor


@router.get("/{visitor_id}/entry-exit-logs")
async def get_visitor_logs(
    visitor_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    visitor = await get_visitor_by_visitor_id(db, visitor_id)
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")

    from app.models.entry_exit import EntryExitLog
    result = await db.execute(
        select(EntryExitLog)
        .where(EntryExitLog.visitor_id == visitor.id)
        .order_by(desc(EntryExitLog.entry_time))
    )
    logs = result.scalars().all()
    return [
        {
            "log_id": log.log_id,
            "entry_time": log.entry_time.isoformat() if log.entry_time else None,
            "exit_time": log.exit_time.isoformat() if log.exit_time else None,
            "duration_minutes": log.duration_minutes,
            "visit_date": log.visit_date,
            "visit_day": log.visit_day,
            "entry_method": log.entry_method,
            "exit_method": log.exit_method,
            "is_active": log.is_active,
        }
        for log in logs
    ]
