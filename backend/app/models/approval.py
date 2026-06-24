from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum
from app.core.database import Base


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    RESCHEDULED = "rescheduled"
    EXPIRED = "expired"


class VisitorApproval(Base):
    __tablename__ = "visitor_approvals"

    id = Column(Integer, primary_key=True, index=True)
    visitor_id = Column(Integer, ForeignKey("visitors.id"), nullable=False, unique=True)
    host_employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(20), default="pending", nullable=False)
    notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    rescheduled_date = Column(DateTime, nullable=True)
    approval_token = Column(String(255), nullable=True, unique=True)
    token_expires_at = Column(DateTime, nullable=True)
    requested_at = Column(DateTime, server_default=func.now())
    responded_at = Column(DateTime, nullable=True)

    visitor = relationship("Visitor", back_populates="approval")
    host_employee = relationship("Employee", back_populates="approvals")
    approver = relationship("User", back_populates="approvals", foreign_keys=[approver_id])
