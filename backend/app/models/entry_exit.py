from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum
from app.core.database import Base


class GateType(str, Enum):
    ENTRY = "entry"
    EXIT = "exit"


class RecognitionMethod(str, Enum):
    FACE = "face"
    QR = "qr"
    MANUAL = "manual"


class EntryExitLog(Base):
    __tablename__ = "entry_exit_logs"

    id = Column(Integer, primary_key=True, index=True)
    log_id = Column(String(50), unique=True, nullable=False, index=True)
    visitor_id = Column(Integer, ForeignKey("visitors.id"), nullable=False, index=True)

    entry_time = Column(DateTime, nullable=True)
    exit_time = Column(DateTime, nullable=True)
    duration_minutes = Column(Float, nullable=True)

    visit_date = Column(String(12), nullable=False, index=True)
    visit_day = Column(String(10), nullable=False)
    visit_year = Column(Integer, nullable=False, index=True)
    visit_month = Column(Integer, nullable=False, index=True)

    entry_method = Column(String(20), default="face")
    exit_method = Column(String(20), nullable=True)
    entry_confidence = Column(Float, nullable=True)
    exit_confidence = Column(Float, nullable=True)
    entry_camera_id = Column(String(50), nullable=True)
    exit_camera_id = Column(String(50), nullable=True)
    entry_snapshot_path = Column(String(500), nullable=True)
    exit_snapshot_path = Column(String(500), nullable=True)

    is_active = Column(Integer, default=1)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, server_default=func.now())

    visitor = relationship("Visitor", back_populates="entry_exit_logs")
