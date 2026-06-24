from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.security import (
    verify_password, get_password_hash,
    create_access_token, create_refresh_token,
    verify_token, validate_password_strength,
)
from app.core.deps import get_current_active_user, require_admin
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest, UserCreateRequest, UserResponse
from app.ai.face_recognition.recognizer import get_face_engine
import json
from pathlib import Path
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

VALID_ROLES = {"admin", "security_officer", "employee", "receptionist"}


@router.post("/login", response_model=TokenResponse)
async def login(request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(
            (User.username == payload.username) | (User.email == payload.username)
        )
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        log = AuditLog(action="LOGIN_FAILED", description=f"Failed login: {payload.username}",
                       ip_address=request.client.host if request.client else "unknown")
        db.add(log)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    await db.execute(update(User).where(User.id == user.id).values(last_login=datetime.now(timezone.utc)))
    log = AuditLog(user_id=user.id, action="LOGIN_SUCCESS",
                   ip_address=request.client.host if request.client else "unknown")
    db.add(log)

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user_id=user.id,
        username=user.username,
        role=user.role,
        full_name=user.full_name,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    user_id = verify_token(payload.refresh_token, token_type="refresh")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    result = await db.execute(select(User).where(User.id == int(user_id), User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user_id=user.id,
        username=user.username,
        role=user.role,
        full_name=user.full_name,
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    username: str = Form(...),
    email: str = Form(...),
    full_name: str = Form(...),
    password: str = Form(...),
    role: str = Form("employee"),
    department_id: int | None = Form(None),
    employee_id: str | None = Form(None),
    phone: str | None = Form(None),
    photo: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
):
    """Public sign-up — creates a new staff account."""
    if role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Choose from: {list(VALID_ROLES)}")

    if not validate_password_strength(password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be 8+ chars with uppercase, lowercase, digit, and special character (!@#$%...)",
        )

    existing = await db.execute(
        select(User).where((User.username == username) | (User.email == email))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username or email already exists")

    user = User(
        username=username,
        email=email,
        full_name=full_name,
        password_hash=get_password_hash(password),
        role=role,
        phone=phone,
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    await db.flush()
    # Handle photo: detect face, save image and embedding
    if photo is not None:
        try:
            content = await photo.read()
            engine = get_face_engine()
            # decode bytes to cv2 image if possible
            img = None
            if engine and hasattr(engine, 'decode_image'):
                import base64
                b64 = base64.b64encode(content).decode('utf-8')
                img = engine.decode_image(f"data:{photo.content_type};base64,{b64}")
            face_res = engine.detect_and_embed(img) if img is not None else None
            if face_res and face_res.detected and face_res.embedding:
                emb_json = json.dumps(face_res.embedding)
                # save to uploads/faces/{user_id}.jpg
                uploads_dir = Path(settings.UPLOAD_DIR) / "faces"
                uploads_dir.mkdir(parents=True, exist_ok=True)
                img_path = uploads_dir / f"user_{user.id}.jpg"
                saved = engine.save_face_image(face_res.face_image or img, str(img_path))
                if saved:
                    user.face_image = str(img_path)
                user.face_embedding = emb_json
        except Exception:
            pass
    return user


@router.post("/users", response_model=UserResponse, dependencies=[Depends(require_admin)])
async def create_user(
    username: str = Form(...),
    email: str = Form(...),
    full_name: str = Form(...),
    password: str = Form(...),
    role: str = Form("employee"),
    department_id: int | None = Form(None),
    employee_id: str | None = Form(None),
    phone: str | None = Form(None),
    photo: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only user creation."""
    if not validate_password_strength(password):
        raise HTTPException(status_code=422, detail="Weak password")

    existing = await db.execute(
        select(User).where((User.username == username) | (User.email == email))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username or email already exists")

    user = User(
        username=username,
        email=email,
        full_name=full_name,
        password_hash=get_password_hash(password),
        role=role,
        department_id=department_id,
        employee_id=employee_id,
        phone=phone,
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    await db.flush()
    # handle photo same as register
    if photo is not None:
        try:
            content = await photo.read()
            engine = get_face_engine()
            img = None
            if engine and hasattr(engine, 'decode_image'):
                import base64
                b64 = base64.b64encode(content).decode('utf-8')
                img = engine.decode_image(f"data:{photo.content_type};base64,{b64}")
            face_res = engine.detect_and_embed(img) if img is not None else None
            if face_res and face_res.detected and face_res.embedding:
                emb_json = json.dumps(face_res.embedding)
                uploads_dir = Path(settings.UPLOAD_DIR) / "faces"
                uploads_dir.mkdir(parents=True, exist_ok=True)
                img_path = uploads_dir / f"user_{user.id}.jpg"
                saved = engine.save_face_image(face_res.face_image or img, str(img_path))
                if saved:
                    user.face_image = str(img_path)
                user.face_embedding = emb_json
        except Exception:
            pass
    return user


@router.post("/users/{user_id}/photo", dependencies=[Depends(require_admin)])
async def upload_user_photo(user_id: int, photo: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    """Admin: upload or replace a user's face photo; detects face, stores image path and embedding."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        content = await photo.read()
        engine = get_face_engine()
        img = None
        if engine and hasattr(engine, 'decode_image'):
            import base64
            b64 = base64.b64encode(content).decode('utf-8')
            img = engine.decode_image(f"data:{photo.content_type};base64,{b64}")
        face_res = engine.detect_and_embed(img) if img is not None else None
        if face_res and face_res.detected and face_res.embedding:
            emb_json = json.dumps(face_res.embedding)
            uploads_dir = Path(settings.UPLOAD_DIR) / "faces"
            uploads_dir.mkdir(parents=True, exist_ok=True)
            img_path = uploads_dir / f"user_{user.id}.jpg"
            saved = engine.save_face_image(face_res.face_image or img, str(img_path))
            if saved:
                user.face_image = str(img_path)
            user.face_embedding = emb_json
            db.add(user)
            await db.flush()
            return {"message": "Photo uploaded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    raise HTTPException(status_code=422, detail="No face detected in the uploaded image")


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_active_user)):
    return current_user


@router.post("/logout")
async def logout(request: Request, current_user: User = Depends(get_current_active_user),
                 db: AsyncSession = Depends(get_db)):
    log = AuditLog(user_id=current_user.id, action="LOGOUT",
                   ip_address=request.client.host if request.client else "unknown")
    db.add(log)
    return {"message": "Logged out successfully"}
