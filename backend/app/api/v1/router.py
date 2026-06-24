from fastapi import APIRouter
from app.api.v1.endpoints import auth, visitors, face_gate, dashboard, approvals, blacklist, reports, websocket, liveness

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(visitors.router)
api_router.include_router(face_gate.router)
api_router.include_router(liveness.router)
api_router.include_router(dashboard.router)
api_router.include_router(approvals.router)
api_router.include_router(blacklist.router)
api_router.include_router(reports.router)
api_router.include_router(websocket.router)
