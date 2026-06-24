"""
WebSocket endpoint for real-time dashboard updates.
"""
import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.services.visitor_service import get_dashboard_stats
import logging

logger = logging.getLogger(__name__)
router = APIRouter(tags=["WebSocket"])


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WS connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"WS disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        dead = []
        for ws in self.active_connections:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active_connections.remove(ws)


manager = ConnectionManager()


async def push_stats_loop():
    """Background task — push dashboard stats every 10 seconds."""
    while True:
        try:
            if manager.active_connections:
                async with AsyncSessionLocal() as db:
                    stats = await get_dashboard_stats(db)
                await manager.broadcast({"type": "stats_update", "data": stats})
        except Exception as e:
            logger.error(f"Stats push error: {e}")
        await asyncio.sleep(10)


@router.websocket("/ws/dashboard")
async def dashboard_ws(websocket: WebSocket, token: str = Query(...)):
    from app.core.security import verify_token
    user_id = verify_token(token)
    if not user_id:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await manager.connect(websocket)
    try:
        # Send initial stats immediately
        async with AsyncSessionLocal() as db:
            stats = await get_dashboard_stats(db)
        await websocket.send_text(json.dumps({"type": "stats_update", "data": stats}))

        # Keep connection alive
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                if data == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"type": "heartbeat"}))
    except WebSocketDisconnect:
        manager.disconnect(websocket)


async def broadcast_event(event_type: str, data: dict):
    """Call this from other modules to push real-time events."""
    await manager.broadcast({"type": event_type, "data": data})
