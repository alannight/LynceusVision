"""app/models/__init__.py — re-export all models for Alembic discovery."""
from app.models.models import Entity, Investigation, Observation, SearchQuery, Source

__all__ = ["Entity", "Investigation", "Observation", "SearchQuery", "Source"]
