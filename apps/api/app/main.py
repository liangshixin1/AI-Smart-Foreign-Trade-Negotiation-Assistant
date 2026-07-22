from __future__ import annotations

import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings, get_settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging
from app.db.session import build_engine, build_session_factory
from app.integrations.knowledge_graph import GraphStore, build_graph_store
from app.integrations.llm import LLMProvider, build_llm_provider
from app.modules.auth.router import router as auth_router
from app.modules.curriculum.router import router as curriculum_router
from app.modules.knowledge_graph.router import router as knowledge_graph_router
from app.modules.progress.router import router as progress_router
from app.modules.teacher_analytics.router import router as teacher_router
from app.modules.technician.router import router as technician_router
from app.modules.training.router import router as training_router
from app.modules.workspaces.router import router as workspaces_router


class HealthResponse(BaseModel):
    status: str
    service: str


def create_app(
    settings: Settings | None = None,
    session_factory: sessionmaker[Session] | None = None,
    llm_provider: LLMProvider | None = None,
    graph_store: GraphStore | None = None,
) -> FastAPI:
    resolved_settings = settings or get_settings()
    resolved_factory = session_factory or build_session_factory(build_engine(resolved_settings))
    configure_logging()

    application = FastAPI(
        title=resolved_settings.app_name,
        version="0.1.0",
        docs_url="/docs" if resolved_settings.app_env != "production" else None,
        redoc_url=None,
    )
    application.state.settings = resolved_settings
    application.state.session_factory = resolved_factory
    application.state.llm_provider = llm_provider or build_llm_provider(resolved_settings)
    application.state.graph_store = graph_store or build_graph_store(resolved_settings)
    application.router.add_event_handler("shutdown", application.state.graph_store.close)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "Idempotency-Key",
            "X-File-Name",
            "X-Request-Id",
            "X-Template-Version",
        ],
    )

    @application.middleware("http")
    async def request_context(request: Request, call_next):  # type: ignore[no-untyped-def]
        request.state.request_id = request.headers.get("X-Request-Id", str(uuid.uuid4()))
        response = await call_next(request)
        response.headers["X-Request-Id"] = request.state.request_id
        return response

    @application.get("/health", response_model=HealthResponse, tags=["system"])
    def health() -> HealthResponse:
        return HealthResponse(status="ok", service=resolved_settings.app_name)

    application.include_router(auth_router)
    application.include_router(curriculum_router)
    application.include_router(knowledge_graph_router)
    application.include_router(training_router)
    application.include_router(progress_router)
    application.include_router(teacher_router)
    application.include_router(technician_router)
    application.include_router(workspaces_router)
    register_error_handlers(application)
    return application


app = create_app()
