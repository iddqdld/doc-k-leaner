from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from redis import asyncio as aioredis

from app.api.files import router as files_router
from app.api.news import router as news_router
from app.api.stats import router as stats_router
from app.api.news import router as news_router
from app.db.postgres import init_db
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Redis cache
    redis = aioredis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True
    )
    FastAPICache.init(RedisBackend(redis), prefix="dockcleaner-cache")
    await init_db()
    yield
    # Shutdown: Close Redis connection
    await redis.close()


app = FastAPI(
    title="Doc(k)leaner API",
    description="Security Audit Platform API",
    version="0.1.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routers
app.include_router(files_router)
app.include_router(news_router)
app.include_router(stats_router)
app.include_router(news_router)


@app.get("/")
async def root():
    return {"message": "Doc(k)leaner API", "status": "running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}

