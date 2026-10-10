"""Desktop-only HTTP composition, guarded independently from business authentication."""

from __future__ import annotations

import secrets
from pathlib import Path
from typing import Annotated, Literal

from fastapi import Depends, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import model_validator
from pydantic_settings import BaseSettings, PydanticBaseSettingsSource
from sqlalchemy.orm import Session

from app.application import create_app
from app.core.config import Settings
from app.core.resources import resource_root
from app.db.session import build_engine, build_session_factory, get_db
from app.desktop.bootstrap import identity, migrate, seed
from app.desktop.runtime import BoundedProvider, DemoCredential, PublicCredential
from app.integrations.knowledge_graph.sqlite import SQLiteGraphStore
from app.integrations.llm import build_llm_provider
from app.integrations.llm.base import LLMMessage, LLMProviderError, LLMRequest
from app.modules.auth.repository import AuthRepository
from app.modules.auth.service import AuthService


class DesktopSettings(Settings):
    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        # Ignore inherited process variables as well as both source-tree .env files.
        return (init_settings,)


class PublicDesktopSettings(DesktopSettings):
    @model_validator(mode="after")
    def validate_deepseek_agents(self) -> PublicDesktopSettings:
        if self.llm_provider == "deepseek":
            for role in ("scenario", "conversation", "evaluation"):
                key = getattr(self, f"deepseek_{role}_api_key")
                if not key or not key.get_secret_value().strip():
                    raise ValueError("Public mode requires a configured key")
        return self


def desktop_app(
    data_dir: Path,
    token: str,
    origin: str,
    credential: DemoCredential | PublicCredential | None = None,
    public_edition: bool = False,
):
    if len(token) < 32:
        raise ValueError("A fresh local launch token is required")
    data_dir.mkdir(parents=True, exist_ok=True)
    local = identity(data_dir)
    options = {}
    if credential:
        for role in ("scenario", "conversation", "evaluation"):
            options[f"deepseek_{role}_api_key"] = getattr(credential, role)
            options[f"deepseek_{role}_model"] = credential.model
    settings_type = PublicDesktopSettings if public_edition else DesktopSettings
    settings = settings_type(
        app_env="production",
        database_url="sqlite:///" + str(data_dir / "expert.db"),
        auth_token_pepper=local["pepper"],
        llm_provider="deepseek" if credential else "mock",
        deepseek_base_url="https://api.deepseek.com",
        llm_max_retries=1,
        llm_timeout_seconds=60,
        simulation_enabled=True,
        document_correction_enabled=True,
        document_correction_skip_prerequisite=False,
        cors_origins=[],
        **options,
    )
    migrate(settings, data_dir)
    engine = build_engine(settings)
    factory = build_session_factory(engine)
    graph = SQLiteGraphStore(data_dir / "graph.sqlite3")
    version = seed(factory, graph, local["password"], public_edition)
    provider = BoundedProvider(
        build_llm_provider(settings), credential if isinstance(credential, DemoCredential) else None
    )
    app = create_app(
        settings=settings, session_factory=factory, graph_store=graph, llm_provider=provider
    )
    app.router.add_event_handler("shutdown", engine.dispose)
    host = origin.removeprefix("http://")

    @app.middleware("http")
    async def protect(request: Request, call_next):
        supplied = request.headers.get("x-desktop-token", "")
        if (
            request.headers.get("host") != host
            or request.headers.get("origin", origin) != origin
            or request.headers.get("sec-fetch-site") == "cross-site"
            or not secrets.compare_digest(supplied, token)
        ):
            return JSONResponse({"error": "Local application access required"}, status_code=403)
        # Desktop reviewers cannot rewrite credentials into a source-tree .env.
        if request.url.path.startswith(("/api/v1/technician", "/openapi.json")):
            return JSONResponse({"error": "Managed by the private build"}, status_code=403)
        response = await call_next(request)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; "
            "connect-src 'self'; worker-src 'self' blob:; object-src 'none'; "
            "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/desktop/status")
    def status():
        return {
            "ready": graph.health(),
            "mode": settings.llm_provider,
            "graph_version": version,
            "graph_backend": "sqlite",
            "stages": 10,
            "edition": "public" if public_edition else "expert",
            "expires_at": credential.expires_at.isoformat()
            if isinstance(credential, DemoCredential)
            else None,
        }

    @app.post("/desktop/login/{role}")
    def login(role: Literal["student", "teacher"], db: Annotated[Session, Depends(get_db)]):
        return AuthService(AuthRepository(db), settings).login(
            f"{role}@expert.invalid", local["password"]
        )

    @app.post("/desktop/connectivity")
    def connectivity():
        results = []
        for role in ("scenario", "conversation", "evaluation"):
            try:
                response = provider.complete(
                    LLMRequest(
                        purpose=role,
                        prompt_template_id="desktop-connectivity",
                        prompt_version="1",
                        correlation_id="desktop-connectivity",
                        messages=[LLMMessage(role="user", content="Reply only OK.")],
                        max_output_tokens=256,
                    )
                )
                results.append(
                    {
                        "role": role,
                        "status": "ok",
                        "model": response.model,
                        "mode": settings.llm_provider,
                    }
                )
            except LLMProviderError as exc:
                results.append({"role": role, "status": "failed", "category": exc.category})
        return {"results": results, "mode": settings.llm_provider}

    web = resource_root() / "apps/web/dist"

    @app.get("/{path:path}")
    def frontend(path: str):
        if path.startswith(("api/", "desktop/", "docs", "openapi")):
            return JSONResponse({"error": "Not found"}, status_code=404)
        candidate = (web / path).resolve()
        if not candidate.is_relative_to(web.resolve()):
            return JSONResponse({"error": "Not found"}, status_code=404)
        if candidate.is_file():
            return FileResponse(candidate)
        if "." in Path(path).name or not (web / "index.html").exists():
            return JSONResponse({"error": "Resource missing"}, status_code=404)
        return FileResponse(web / "index.html")

    return app
