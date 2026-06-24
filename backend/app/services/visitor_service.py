"""
Visitor Service — core business logic for visitor lifecycle management.
"""
import uuid
import secrets
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.orm import selectinload

from app.models.visitor import Visitor, VisitorStatus
from app.models.entry_exit import EntryExitLog, RecognitionMethod
from app.models.approval import VisitorApproval, ApprovalStatus
from app.models.blacklist import BlacklistedVisitor
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


async def generate_visitor_id(db: AsyncSession) -> str:
    """Generate sequential visitor ID in format BHEL-VST-YYYY-XXXX."""
    year = datetime.now(timezone.utc).year
    result = await db.execute(
        select(func.count(Visitor.id)).where(
            func.extract("year", Visitor.created_at) == year
        )
    )
    count = result.scalar() or 0
    return f"{settings.VISITOR_ID_PREFIX}-{year}-{count + 1:04d}"


async def create_visitor(db: AsyncSession, data: Dict[str, Any]) -> Visitor:
    visitor_id = await generate_visitor_id(db)
    pass_token = secrets.token_urlsafe(32)

    visitor = Visitor(
        visitor_id=visitor_id,
        name=data["name"],
        mobile=data["mobile"],
        email=data.get("email"),
        address=data.get("address"),
        company=data.get("company"),
        purpose=data["purpose"],
        department_name=data.get("department_name"),
        host_employee_name=data["host_employee_name"],
        vehicle_number=data.get("vehicle_number"),
        id_proof_type=data["id_proof_type"],
        id_proof_number=data["id_proof_number"],
        photo_path=data.get("photo_path"),
        expected_visit_date=data.get("expected_visit_date"),
        status=VisitorStatus.PENDING,
        pass_token=pass_token,
    )
    db.add(visitor)
    await db.flush()

    # Create approval record
    approval = VisitorApproval(
        visitor_id=visitor.id,
        status=ApprovalStatus.PENDING,
        approval_token=secrets.token_urlsafe(48),
    )
    db.add(approval)
    await db.flush()

    return visitor


async def get_visitor_by_visitor_id(db: AsyncSession, visitor_id: str) -> Optional[Visitor]:
    result = await db.execute(
        select(Visitor)
        .options(selectinload(Visitor.entry_exit_logs), selectinload(Visitor.approval))
        .where(Visitor.visitor_id == visitor_id)
    )
    return result.scalar_one_or_none()


async def get_active_visit_log(db: AsyncSession, visitor_db_id: int) -> Optional[EntryExitLog]:
    """Get the current active (inside campus) visit log for a visitor."""
    result = await db.execute(
        select(EntryExitLog).where(
            and_(EntryExitLog.visitor_id == visitor_db_id, EntryExitLog.is_active == 1)
        ).order_by(desc(EntryExitLog.entry_time)).limit(1)
    )
    return result.scalar_one_or_none()


async def record_entry(
    db: AsyncSession,
    visitor: Visitor,
    confidence: float,
    method: RecognitionMethod = RecognitionMethod.FACE,
    camera_id: Optional[str] = None,
    snapshot_path: Optional[str] = None,
) -> EntryExitLog:
    """Record visitor entry. Prevents duplicate active entries."""
    # Check for duplicate
    existing = await get_active_visit_log(db, visitor.id)
    if existing:
        return existing  # already inside

    now = datetime.now(timezone.utc)
    log_id = f"LOG-{now.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"

    log = EntryExitLog(
        log_id=log_id,
        visitor_id=visitor.id,
        entry_time=now,
        visit_date=now.strftime("%d-%m-%Y"),
        visit_day=now.strftime("%A"),
        visit_year=now.year,
        visit_month=now.month,
        entry_method=method,
        entry_confidence=confidence,
        entry_camera_id=camera_id,
        entry_snapshot_path=snapshot_path,
        is_active=1,
    )
    db.add(log)

    visitor.status = VisitorStatus.INSIDE
    await db.flush()
    return log


async def record_exit(
    db: AsyncSession,
    visitor: Visitor,
    confidence: float,
    method: RecognitionMethod = RecognitionMethod.FACE,
    camera_id: Optional[str] = None,
    snapshot_path: Optional[str] = None,
) -> Optional[EntryExitLog]:
    """Record visitor exit and compute duration."""
    log = await get_active_visit_log(db, visitor.id)
    if not log:
        return None

    now = datetime.now(timezone.utc)
    duration = (now - log.entry_time).total_seconds() / 60  # minutes

    log.exit_time = now
    log.exit_method = method
    log.exit_confidence = confidence
    log.exit_camera_id = camera_id
    log.exit_snapshot_path = snapshot_path
    log.duration_minutes = round(duration, 2)
    log.is_active = 0

    visitor.status = VisitorStatus.EXITED
    await db.flush()
    return log


async def check_blacklist(db: AsyncSession, visitor_db_id: int) -> bool:
    result = await db.execute(
        select(BlacklistedVisitor).where(
            and_(BlacklistedVisitor.visitor_id == visitor_db_id, BlacklistedVisitor.is_active == True)
        )
    )
    return result.scalar_one_or_none() is not None


async def get_all_face_embeddings(db: AsyncSession) -> List[tuple]:
    """Return all active visitor face embeddings for matching."""
    result = await db.execute(
        select(Visitor.visitor_id, Visitor.face_embedding).where(
            and_(
                Visitor.face_enrollment_done == True,
                Visitor.face_embedding.isnot(None),
                Visitor.is_blacklisted == False,
                Visitor.status.notin_([VisitorStatus.REJECTED, VisitorStatus.BLACKLISTED]),
            )
        )
    )
    return [(row.visitor_id, row.face_embedding) for row in result.fetchall()]


async def get_dashboard_stats(db: AsyncSession) -> Dict[str, Any]:
    """Aggregate real-time dashboard metrics."""
    today = datetime.now(timezone.utc).strftime("%d-%m-%Y")

    total_today = await db.scalar(
        select(func.count(EntryExitLog.id)).where(EntryExitLog.visit_date == today)
    )
    active_inside = await db.scalar(
        select(func.count(EntryExitLog.id)).where(
            and_(EntryExitLog.visit_date == today, EntryExitLog.is_active == 1)
        )
    )
    exited_today = await db.scalar(
        select(func.count(EntryExitLog.id)).where(
            and_(EntryExitLog.visit_date == today, EntryExitLog.is_active == 0)
        )
    )
    pending_approvals = await db.scalar(
        select(func.count(VisitorApproval.id)).where(
            VisitorApproval.status == ApprovalStatus.PENDING
        )
    )

    # Monthly count
    now = datetime.now(timezone.utc)
    monthly_count = await db.scalar(
        select(func.count(EntryExitLog.id)).where(
            and_(
                EntryExitLog.visit_year == now.year,
                EntryExitLog.visit_month == now.month,
            )
        )
    )

    return {
        "total_today": total_today or 0,
        "active_inside": active_inside or 0,
        "exited_today": exited_today or 0,
        "pending_approvals": pending_approvals or 0,
        "monthly_count": monthly_count or 0,
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }
