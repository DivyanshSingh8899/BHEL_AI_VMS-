from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class BlacklistedVisitor(Base):
    __tablename__ = "blacklisted_visitors"

    id = Column(Integer, primary_key=True, index=True)
    blacklist_id = Column(String(50), unique=True, nullable=False, index=True)
    visitor_id = Column(Integer, ForeignKey("visitors.id"), nullable=False)
    reason = Column(Text, nullable=False)
    added_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    removed_at = Column(DateTime, nullable=True)
    removal_reason = Column(Text, nullable=True)

    visitor = relationship("Visitor", back_populates="blacklist_record")
    added_by_user = relationship("User", foreign_keys=[added_by])
