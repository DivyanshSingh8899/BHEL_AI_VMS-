import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_liveness_endpoint(client: AsyncClient):
    # Use a tiny 1x1 transparent PNG as base64 (valid image but minimal)
    b64_png = (
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
    )
    resp = await client.post("/api/v1/liveness/analyze", json={"image": b64_png})
    assert resp.status_code == 200
    data = resp.json()
    assert "is_live" in data
    assert "confidence" in data