from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

db_url = settings.get_database_url()

# SQLite needs check_same_thread=False; Postgres needs pool settings
connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
pool_kwargs = {} if db_url.startswith("sqlite") else {"pool_size": 20, "max_overflow": 0}

engine = create_async_engine(
    db_url,
    pool_pre_ping=True,
    connect_args=connect_args,
    echo=settings.DEBUG,
    **pool_kwargs,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
