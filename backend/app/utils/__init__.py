"""Shared utility helpers used across api / services."""
from app.utils.time import utcnow_naive

# Re-export for convenience
__all__ = ["utcnow_naive"]
