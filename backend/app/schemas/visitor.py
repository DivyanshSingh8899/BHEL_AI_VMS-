from pydantic import BaseModel, EmailStr, field_validator, model_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


class IDProofType(str, Enum):
    AADHAAR = "aadhaar"
    PAN = "pan"
    PASSPORT = "passport"
    DRIVING_LICENSE = "driving_license"
    VOTER_ID = "voter_id"
    EMPLOYEE_ID = "employee_id"


class VisitorRegisterRequest(BaseModel):
    name: str
    mobile: str
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    company: Optional[str] = None
    purpose: str
    department_name: Optional[str] = None
    host_employee_name: str
    vehicle_number: Optional[str] = None
    id_proof_type: IDProofType
    id_proof_number: str
    photo_base64: Optional[str] = None   # base64-encoded webcam capture
    expected_visit_date: Optional[datetime] = None

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, v: str) -> str:
        digits = v.strip().replace(" ", "").replace("-", "")
        if not digits.isdigit() or len(digits) not in (10, 12):
            raise ValueError("Mobile must be 10 or 12 digits")
        return digits

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name too short")
        return v


class VisitorResponse(BaseModel):
    id: int
    visitor_id: str
    name: str
    mobile: str
    email: Optional[str]
    company: Optional[str]
    purpose: str
    department_name: Optional[str]
    host_employee_name: str
    vehicle_number: Optional[str]
    id_proof_type: str
    photo_path: Optional[str]
    face_enrollment_done: bool
    status: str
    qr_code_path: Optional[str]
    badge_path: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class FaceEnrollRequest(BaseModel):
    visitor_id: str
    images: List[str]   # list of base64-encoded face images


class FaceEnrollResponse(BaseModel):
    success: bool
    visitor_id: str
    message: str
    enrolled_images: int


class RecognitionRequest(BaseModel):
    image: str           # base64 frame from gate camera
    camera_id: Optional[str] = "GATE-001"
    gate_type: str = "entry"   # "entry" or "exit"


class RecognitionResponse(BaseModel):
    matched: bool
    visitor_id: Optional[str]
    visitor_name: Optional[str]
    department: Optional[str]
    purpose: Optional[str]
    host_employee: Optional[str]
    confidence: float
    is_blacklisted: bool = False
    message: str
    entry_time: Optional[str] = None
    log_id: Optional[str] = None


class LivenessRequest(BaseModel):
    image: str  # base64-encoded image (data URL or raw base64)


class LivenessResponse(BaseModel):
    is_live: bool
    confidence: float
    blink_detected: bool
    texture_score: float
    reflection_score: float
    message: str
