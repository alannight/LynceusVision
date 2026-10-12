"""LynceusVision FastAPI application entry point."""
from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select

from app.api.v1 import v1_router
from app.config import get_settings
from app.connectors.registry import CONNECTOR_METADATA
from app.database import AsyncSessionLocal
from app.models.models import Source
from app.security import SSRFBlockedError

logger = logging.getLogger("lynceusvision")
settings = get_settings()


async def _seed_sources() -> None:
    """Seed connector metadata into the sources table if not already present."""
    try:
        async with AsyncSessionLocal() as session:
            for meta in CONNECTOR_METADATA:
                res = await session.execute(select(Source).where(Source.id == meta["id"]))
                if res.scalar_one_or_none() is None:
                    src = Source(
                        id=meta["id"],
                        display_name=meta["display_name"],
                        description=meta.get("description"),
                        source_url=meta.get("source_url"),
                        enabled=True,
                        status="active",
                    )
                    session.add(src)
            await session.commit()
            logger.info("Successfully seeded sources registry")
    except Exception as exc:
        logger.warning("Failed to seed sources during startup: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifecycle management."""
    settings.configure_logging()
    logger.info("Starting LynceusVision backend (env=%s)", settings.app_env)
    await _seed_sources()
    yield
    logger.info("Shutting down LynceusVision backend")


app = FastAPI(
    title="LynceusVision API",
    version="0.1.0",
    description="OSINT Investigation Platform — Source Attribution & Correlation",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Exception Handlers ─────────────────────────────────────────────────────────


@app.exception_handler(SSRFBlockedError)
async def ssrf_blocked_handler(request: Request, exc: SSRFBlockedError) -> JSONResponse:
    logger.warning("SSRF blocked on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"error": str(exc), "code": "SSRF_BLOCKED"},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "code": "HTTP_ERROR"},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled server exception on %s: %s", request.url.path, exc)
    # Sanitized response: never leak internal stack traces to clients (Rule 2.5)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "An internal server error occurred", "code": "INTERNAL_SERVER_ERROR"},
    )


# ── Health & Info Endpoints ───────────────────────────────────────────────────


@app.get("/", tags=["Health"])
async def root() -> dict[str, str]:
    return {
        "name": "LynceusVision API",
        "version": "0.1.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "app": "LynceusVision",
        "version": "0.1.0",
        "timestamp": datetime.now(UTC).isoformat(),
    }


# Include API Routers
app.include_router(v1_router)
