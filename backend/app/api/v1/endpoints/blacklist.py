import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.deps import require_admin_or_security
from app.models.blacklist import BlacklistedVisitor
from app.models.visitor import Visitor, VisitorStatus
from app.models.user import User

router = APIRouter(prefix="/blacklist", tags=["Blacklist"])


class BlacklistAddRequest(BaseModel):
    visitor_id: str
    reason: str


class BlacklistRemoveRequest(BaseModel):
    removal_reason: str


@router.get("")
async def list_blacklisted(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_security),
):
    result = await db.execute(
        select(BlacklistedVisitor, Visitor)
        .join(Visitor, Visitor.id == BlacklistedVisitor.visitor_id)
        .where(BlacklistedVisitor.is_active == True)
        .order_by(BlacklistedVisitor.created_at.desc())
    )
    return [
        {
            "blacklist_id": row.BlacklistedVisitor.blacklist_id,
            "visitor_id": row.Visitor.visitor_id,
            "name": row.Visitor.name,
            "mobile": row.Visitor.mobile,
            "reason": row.BlacklistedVisitor.reason,
            "created_at": row.BlacklistedVisitor.created_at.isoformat(),
        }
        for row in result.fetchall()
    ]


@router.post("", status_code=status.HTTP_201_CREATED)
async def add_to_blacklist(
    payload: BlacklistAddRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_security),
):
    v_result = await db.execute(select(Visitor).where(Visitor.visitor_id == payload.visitor_id))
    visitor = v_result.scalar_one_or_none()
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")

    # Check if already blacklisted
    existing = await db.execute(
        select(BlacklistedVisitor).where(
            and_(BlacklistedVisitor.visitor_id == visitor.id, BlacklistedVisitor.is_active == True)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Visitor is already blacklisted")

    blacklist_entry = BlacklistedVisitor(
        blacklist_id=f"BL-{uuid.uuid4().hex[:8].upper()}",
        visitor_id=visitor.id,
        reason=payload.reason,
        added_by=current_user.id,
        is_active=True,
    )
    db.add(blacklist_entry)

    visitor.is_blacklisted = True
    visitor.status = VisitorStatus.BLACKLISTED
    await db.flush()

    return {"message": "Visitor added to blacklist", "blacklist_id": blacklist_entry.blacklist_id}


@router.delete("/{blacklist_id}")
async def remove_from_blacklist(
    blacklist_id: str,
    payload: BlacklistRemoveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_security),
):
    result = await db.execute(
        select(BlacklistedVisitor).where(
            and_(BlacklistedVisitor.blacklist_id == blacklist_id, BlacklistedVisitor.is_active == True)
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Blacklist entry not found")

    entry.is_active = False
    entry.removed_at = datetime.now(timezone.utc)
    entry.removal_reason = payload.removal_reason

    # Restore visitor status
    v_result = await db.execute(select(Visitor).where(Visitor.id == entry.visitor_id))
    visitor = v_result.scalar_one_or_none()
    if visitor:
        visitor.is_blacklisted = False
        visitor.status = VisitorStatus.PENDING

    return {"message": "Visitor removed from blacklist"}
