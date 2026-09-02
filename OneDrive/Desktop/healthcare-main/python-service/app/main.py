from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import get_settings
from app.routers import analytics, reports
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"🚀 Starting {settings.APP_NAME} v{settings.VERSION}")
    logger.info(f"📊 Analytics Service configured")
    logger.info(f"🔗 NestJS Backend URL: {settings.NESTJS_API_URL}")
    logger.info(f"💾 Database: {settings.DATABASE_URL.split('@')[1] if '@' in settings.DATABASE_URL else 'PostgreSQL'}")
    yield
    logger.info(f"🛑 Shutting down {settings.APP_NAME}")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.CORS_ORIGIN] if settings.CORS_ORIGIN != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analytics.router)
app.include_router(reports.router)


@app.get("/api/health")
def health_check():
    return {
        "ok": True,
        "service": "FastAPI Analytics",
        "version": settings.VERSION,
        "database": "PostgreSQL",
        "nestjsBackend": settings.NESTJS_API_URL,
    }


@app.get("/")
def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "nestjsBackend": settings.NESTJS_API_URL,
    }
