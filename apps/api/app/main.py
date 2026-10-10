"""ASGI entry point for ordinary web deployments."""
from app.application import create_app

__all__ = ["app", "create_app"]
app = create_app()
