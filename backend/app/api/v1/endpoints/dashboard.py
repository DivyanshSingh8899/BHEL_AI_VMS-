from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, text
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.models.user import User
from app.models.entry_exit import EntryExitLog
from app.models.visitor import Visitor, VisitorStatus
from app.services.visitor_service import get_dashboard_stats

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return await get_dashboard_stats(db)


@router.get("/daily-trend")
async def daily_trend(
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Visitor count per day for last N days."""
    result = await db.execute(
        select(
            EntryExitLog.visit_date,
            func.count(EntryExitLog.id).label("count"),
        )
        .where(EntryExitLog.visit_year == datetime.now(timezone.utc).year)
        .group_by(EntryExitLog.visit_date)
        .order_by(EntryExitLog.visit_date.desc())
        .limit(days)
    )
    rows = result.fetchall()
    return [{"date": r.visit_date, "count": r.count} for r in reversed(rows)]


@router.get("/department-analytics")
async def department_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Visitor distribution by department (current month)."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(
            Visitor.department_name,
            func.count(Visitor.id).label("count"),
        )
        .join(EntryExitLog, EntryExitLog.visitor_id == Visitor.id)
        .where(
            and_(
                EntryExitLog.visit_year == now.year,
                EntryExitLog.visit_month == now.month,
            )
        )
        .group_by(Visitor.department_name)
        .order_by(func.count(Visitor.id).desc())
        .limit(15)
    )
    return [{"department": r.department_name or "Unknown", "count": r.count} for r in result.fetchall()]


@router.get("/hourly-distribution")
async def hourly_distribution(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Entry count by hour of day (today)."""
    today = datetime.now(timezone.utc).strftime("%d-%m-%Y")
    result = await db.execute(
        select(
            func.extract("hour", EntryExitLog.entry_time).label("hour"),
            func.count(EntryExitLog.id).label("count"),
        )
        .where(EntryExitLog.visit_date == today)
        .group_by(func.extract("hour", EntryExitLog.entry_time))
        .order_by(text("hour"))
    )
    rows = {int(r.hour): r.count for r in result.fetchall()}
    # Return all 24 hours with 0 fill
    return [{"hour": h, "label": f"{h:02d}:00", "count": rows.get(h, 0)} for h in range(24)]


@router.get("/monthly-summary")
async def monthly_summary(
    year: int = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if year is None:
        year = datetime.now(timezone.utc).year

    result = await db.execute(
        select(
            EntryExitLog.visit_month,
            func.count(EntryExitLog.id).label("total"),
            func.avg(EntryExitLog.duration_minutes).label("avg_duration"),
        )
        .where(EntryExitLog.visit_year == year)
        .group_by(EntryExitLog.visit_month)
        .order_by(EntryExitLog.visit_month)
    )
    months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return [
        {
            "month": r.visit_month,
            "label": months[r.visit_month],
            "total": r.total,
            "avg_duration_minutes": round(r.avg_duration or 0, 1),
        }
        for r in result.fetchall()
    ]


@router.get("/active-visitors")
async def active_visitors(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List currently active visitors inside campus."""
    today = datetime.now(timezone.utc).strftime("%d-%m-%Y")
    result = await db.execute(
        select(Visitor, EntryExitLog)
        .join(EntryExitLog, EntryExitLog.visitor_id == Visitor.id)
        .where(and_(EntryExitLog.is_active == 1, EntryExitLog.visit_date == today))
        .order_by(EntryExitLog.entry_time.desc())
    )
    rows = result.fetchall()
    return [
        {
            "visitor_id": row.Visitor.visitor_id,
            "name": row.Visitor.name,
            "department": row.Visitor.department_name,
            "host_employee": row.Visitor.host_employee_name,
            "purpose": row.Visitor.purpose,
            "entry_time": row.EntryExitLog.entry_time.strftime("%I:%M %p") if row.EntryExitLog.entry_time else None,
            "duration_so_far": _elapsed(row.EntryExitLog.entry_time),
        }
        for row in rows
    ]


def _elapsed(entry_time) -> str:
    if not entry_time:
        return "N/A"
    now = datetime.now(timezone.utc)
    delta = now - entry_time
    hours = int(delta.total_seconds() // 3600)
    mins = int((delta.total_seconds() % 3600) // 60)
    return f"{hours}h {mins}m"
