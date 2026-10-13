"""app/api/v1/__init__.py"""
from fastapi import APIRouter

from app.api.v1.collect import router as collect_router
from app.api.v1.entities import router as entities_router
from app.api.v1.investigations import router as investigations_router
from app.api.v1.sources import router as sources_router
from app.api.v1.search_queries import router as search_queries_router

v1_router = APIRouter(prefix="/api/v1")
v1_router.include_router(investigations_router)
v1_router.include_router(entities_router)
v1_router.include_router(collect_router)
v1_router.include_router(sources_router)
v1_router.include_router(search_queries_router)

__all__ = ["v1_router"]
