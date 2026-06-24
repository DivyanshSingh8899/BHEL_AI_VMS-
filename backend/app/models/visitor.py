from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum
from app.core.database import Base


class VisitorStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    INSIDE = "inside"
    EXITED = "exited"
    BLACKLISTED = "blacklisted"


class IDProofType(str, Enum):
    AADHAAR = "aadhaar"
    PAN = "pan"
    PASSPORT = "passport"
    DRIVING_LICENSE = "driving_license"
    VOTER_ID = "voter_id"
    EMPLOYEE_ID = "employee_id"


class Visitor(Base):
    __tablename__ = "visitors"

    id = Column(Integer, primary_key=True, index=True)
    visitor_id = Column(String(30), unique=True, nullable=False, index=True)

    name = Column(String(255), nullable=False, index=True)
    mobile = Column(String(15), nullable=False, index=True)
    email = Column(String(255), nullable=True, index=True)
    address = Column(Text, nullable=True)

    company = Column(String(255), nullable=True)
    purpose = Column(Text, nullable=False)

    department_id = Column(Integer, nullable=True)
    department_name = Column(String(255), nullable=True)
    host_employee_id = Column(Integer, nullable=True)
    host_employee_name = Column(String(255), nullable=False)
    vehicle_number = Column(String(20), nullable=True)
    expected_visit_date = Column(DateTime, nullable=True)

    id_proof_type = Column(String(30), nullable=False)
    id_proof_number = Column(String(100), nullable=False)

    photo_path = Column(String(500), nullable=True)
    face_embedding = Column(JSON, nullable=True)
    face_enrollment_done = Column(Boolean, default=False)
    face_enrolled_at = Column(DateTime, nullable=True)

    status = Column(String(20), default="pending", nullable=False, index=True)
    is_blacklisted = Column(Boolean, default=False, nullable=False)
    qr_code_path = Column(String(500), nullable=True)
    badge_path = Column(String(500), nullable=True)
    pass_token = Column(String(255), nullable=True, unique=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    entry_exit_logs = relationship("EntryExitLog", back_populates="visitor")
    approval = relationship("VisitorApproval", back_populates="visitor", uselist=False)
    blacklist_record = relationship("BlacklistedVisitor", back_populates="visitor", uselist=False)
