"""app/models/__init__.py — re-export all models for Alembic discovery."""
from app.models.models import Entity, Investigation, Observation, Source

__all__ = ["Entity", "Investigation", "Observation", "Source"]
