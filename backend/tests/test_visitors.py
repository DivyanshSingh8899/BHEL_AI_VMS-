"""
Basic integration tests for visitor registration and gate endpoints.
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.core.database import Base, get_db
from app.core.security import get_password_hash
from app.models.user import User, UserRole

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DB_URL, echo=False)
TestSession = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def override_db():
    async with TestSession() as session:
        yield session


app.dependency_overrides[get_db] = override_db


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with TestSession() as session:
        admin = User(
            username="testadmin",
            email="testadmin@bhel.com",
            full_name="Test Admin",
            password_hash=get_password_hash("Admin@Test1"),
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        )
        session.add(admin)
        await session.commit()
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def auth_headers(client):
    resp = await client.post("/api/v1/auth/login", json={"username": "testadmin", "password": "Admin@Test1"})
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_login_success(client):
    resp = await client.post("/api/v1/auth/login", json={"username": "testadmin", "password": "Admin@Test1"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["role"] == "admin"


@pytest.mark.asyncio
async def test_login_invalid(client):
    resp = await client.post("/api/v1/auth/login", json={"username": "testadmin", "password": "wrongpassword"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_register_visitor(client):
    payload = {
        "name": "Ravi Kumar",
        "mobile": "9876543210",
        "email": "ravi.kumar@example.com",
        "company": "ABC Corp",
        "purpose": "Business meeting with HR department",
        "host_employee_name": "Priya Sharma",
        "department_name": "HR",
        "id_proof_type": "aadhaar",
        "id_proof_number": "1234-5678-9012",
    }
    resp = await client.post("/api/v1/visitors/register", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["visitor_id"].startswith("BHEL-VST-")
    assert data["name"] == "Ravi Kumar"
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_duplicate_registration(client):
    payload = {
        "name": "Duplicate User",
        "mobile": "9999999999",
        "purpose": "Testing duplicate check",
        "host_employee_name": "Test Employee",
        "id_proof_type": "pan",
        "id_proof_number": "ABCDE1234F",
    }
    r1 = await client.post("/api/v1/visitors/register", json=payload)
    assert r1.status_code == 201
    r2 = await client.post("/api/v1/visitors/register", json=payload)
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_list_visitors_requires_auth(client):
    resp = await client.get("/api/v1/visitors")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_visitors_authenticated(client, auth_headers):
    resp = await client.get("/api/v1/visitors", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_dashboard_stats(client, auth_headers):
    resp = await client.get("/api/v1/dashboard/stats", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "total_today" in data
    assert "active_inside" in data


@pytest.mark.asyncio
async def test_pending_approvals(client, auth_headers):
    resp = await client.get("/api/v1/approvals/pending", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
