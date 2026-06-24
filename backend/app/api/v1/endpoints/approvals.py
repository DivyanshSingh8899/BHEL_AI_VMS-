from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.models.approval import VisitorApproval, ApprovalStatus
from app.models.visitor import Visitor, VisitorStatus
from app.models.user import User
from app.services.notification_service import notify_approval

router = APIRouter(prefix="/approvals", tags=["Approvals"])


class ApprovalAction(BaseModel):
    action: str           # "approve" | "reject" | "reschedule"
    notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    rescheduled_date: Optional[datetime] = None


@router.get("/pending")
async def get_pending_approvals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(VisitorApproval, Visitor)
        .join(Visitor, Visitor.id == VisitorApproval.visitor_id)
        .where(VisitorApproval.status == ApprovalStatus.PENDING)
        .order_by(VisitorApproval.requested_at.desc())
    )
    rows = result.fetchall()
    return [
        {
            "approval_id": row.VisitorApproval.id,
            "visitor_id": row.Visitor.visitor_id,
            "visitor_name": row.Visitor.name,
            "mobile": row.Visitor.mobile,
            "purpose": row.Visitor.purpose,
            "department": row.Visitor.department_name,
            "host_employee": row.Visitor.host_employee_name,
            "company": row.Visitor.company,
            "expected_date": row.Visitor.expected_visit_date.isoformat() if row.Visitor.expected_visit_date else None,
            "requested_at": row.VisitorApproval.requested_at.isoformat(),
        }
        for row in rows
    ]


@router.post("/{approval_id}/action")
async def process_approval(
    approval_id: int,
    payload: ApprovalAction,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(VisitorApproval).where(VisitorApproval.id == approval_id)
    )
    approval = result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval record not found")

    if approval.status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Approval already {approval.status.value}")

    # Get visitor
    v_result = await db.execute(select(Visitor).where(Visitor.id == approval.visitor_id))
    visitor = v_result.scalar_one_or_none()

    action = payload.action.lower()
    now = datetime.now(timezone.utc)

    if action == "approve":
        approval.status = ApprovalStatus.APPROVED
        visitor.status = VisitorStatus.APPROVED
        # Generate QR and badge
        import asyncio
        asyncio.create_task(_generate_visitor_pass(visitor))
        asyncio.create_task(notify_approval({
            "name": visitor.name,
            "mobile": visitor.mobile,
            "email": visitor.email,
            "visitor_id": visitor.visitor_id,
        }))

    elif action == "reject":
        approval.status = ApprovalStatus.REJECTED
        approval.rejection_reason = payload.rejection_reason
        visitor.status = VisitorStatus.REJECTED

    elif action == "reschedule":
        if not payload.rescheduled_date:
            raise HTTPException(status_code=400, detail="rescheduled_date required for reschedule action")
        approval.status = ApprovalStatus.RESCHEDULED
        approval.rescheduled_date = payload.rescheduled_date
        visitor.expected_visit_date = payload.rescheduled_date

    else:
        raise HTTPException(status_code=400, detail="action must be 'approve', 'reject', or 'reschedule'")

    approval.approver_id = current_user.id
    approval.notes = payload.notes
    approval.responded_at = now
    await db.flush()

    return {"message": f"Visitor {action}d successfully", "visitor_id": visitor.visitor_id}


async def _generate_visitor_pass(visitor: Visitor):
    """Generate QR code and visitor badge after approval."""
    import qrcode
    import os
    from app.core.config import settings

    try:
        qr_dir = f"{settings.UPLOAD_DIR}/qr"
        os.makedirs(qr_dir, exist_ok=True)
        qr_path = f"{qr_dir}/{visitor.visitor_id}.png"

        qr = qrcode.QRCode(version=2, box_size=10, border=4)
        qr.add_data(visitor.pass_token)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        img.save(qr_path)

        # Update visitor record in separate DB session
        from app.core.database import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            from sqlalchemy import update
            from app.models.visitor import Visitor as V
            await session.execute(
                update(V).where(V.id == visitor.id).values(qr_code_path=qr_path)
            )
            await session.commit()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"QR generation failed: {e}")
