"""Idempotent synthetic desktop initialization and migration backup."""

from __future__ import annotations

import json
import secrets
import sqlite3
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import cast

import yaml
from alembic.config import Config
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from alembic import command
from app.core.config import Settings
from app.core.resources import content_root, resource_root
from app.core.security import hash_password
from app.integrations.knowledge_graph.base import GraphStore
from app.modules.auth.models import Role, User, UserRole
from app.modules.classrooms.models import Classroom, Enrollment
from app.modules.curriculum.import_service import CurriculumImporter
from app.modules.curriculum.models import CourseVersion
from app.modules.knowledge_graph.import_service import KnowledgeImportService
from app.modules.knowledge_graph.repository import KnowledgeGraphRepository
from app.modules.knowledge_graph.review_service import KnowledgeReviewService


def import_expert_curriculum(db: Session, public_edition: bool = False) -> CourseVersion:
    """Create a separately versioned, open-navigation demo; never fabricate completions."""
    with tempfile.TemporaryDirectory(prefix="expert-curriculum-") as directory:
        root = Path(directory)
        for source in content_root().rglob("*.yaml"):
            destination = root / source.relative_to(content_root())
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(source.read_bytes())
        course_path = root / "curriculum/course.yaml"
        course = yaml.safe_load(course_path.read_text(encoding="utf-8"))
        course["version"] += "-public-open-1" if public_edition else "-expert-open-1"
        course["title"] += "（公开体验：关卡开放）" if public_edition else "（专家体验：关卡开放）"
        course_path.write_text(yaml.safe_dump(course, allow_unicode=True), encoding="utf-8")
        for relative in course["chapter_files"]:
            path = root / "curriculum" / relative
            chapter = yaml.safe_load(path.read_text(encoding="utf-8"))
            for unit in chapter["units"]:
                unit["prerequisite_unit_ids"] = []
            path.write_text(yaml.safe_dump(chapter, allow_unicode=True), encoding="utf-8")
        return CurriculumImporter(db, root).import_slice()


def identity(data_dir: Path) -> dict[str, str]:
    path = data_dir / "identity.json"
    if path.exists():
        return dict(json.loads(path.read_text(encoding="utf-8")))
    value = {"pepper": secrets.token_urlsafe(48), "password": secrets.token_urlsafe(32)}
    with path.open("x", encoding="utf-8") as output:
        json.dump(value, output)
    path.chmod(0o600)
    return value


def migrate(settings: Settings, data_dir: Path) -> None:
    database = data_dir / "expert.db"
    backup: Path | None = None
    if database.exists():
        # SQLite backup API includes committed WAL data; a byte copy may not.
        backups = data_dir / "backups"
        backups.mkdir(exist_ok=True)
        stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S%f")
        backup = backups / f"before-migration-{stamp}.db"
        with (
            sqlite3.connect(database) as source,
            sqlite3.connect(backup) as target,
        ):
            source.backup(target)
    config = Config()
    config.set_main_option("script_location", str(resource_root() / "apps/api/alembic"))
    config.attributes["database_url"] = settings.database_url
    try:
        command.upgrade(config, "head")
    except Exception:
        if backup is not None:
            with sqlite3.connect(backup) as source, sqlite3.connect(database) as target:
                source.backup(target)
        raise


def seed(
    factory: sessionmaker[Session], graph: GraphStore, password: str, public_edition: bool = False
) -> str:
    with factory() as db:
        users: dict[str, User] = {}
        for code, label in (
            ("student", "学生体验"),
            ("teacher", "教师体验"),
            ("technician", "演示初始化维护者"),
        ):
            role = db.scalar(select(Role).where(Role.code == code))
            if role is None:
                role = Role(code=code, name=label)
                db.add(role)
                db.flush()
            user = db.scalar(select(User).where(User.email == f"{code}@expert.invalid"))
            if user is None:
                user = User(
                    email=f"{code}@expert.invalid",
                    display_name=label,
                    student_no="DEMO001" if code == "student" else None,
                    password_hash=hash_password(password),
                )
                db.add(user)
                db.flush()
                db.add(UserRole(user=user, role=role))
            users[code] = user
        db.commit()
        # The importer resolves the exact separately versioned expert edition. Picking
        # an arbitrary published version can silently re-lock a previously used database.
        version = import_expert_curriculum(db, public_edition)
        room_name = "公开体验班（合成数据）" if public_edition else "专家体验班（合成数据）"
        room = db.scalar(select(Classroom).where(Classroom.name == room_name))
        if room is None:
            room = Classroom(
                name=room_name,
                course_version_id=version.id,
                owner_teacher_id=users["teacher"].id,
            )
            db.add(room)
            db.flush()
        elif room.course_version_id != version.id:
            room.course_version_id = version.id
            db.flush()
        if (
            db.scalar(
                select(Enrollment).where(
                    Enrollment.classroom_id == room.id, Enrollment.student_id == users["student"].id
                )
            )
            is None
        ):
            db.add(Enrollment(classroom_id=room.id, student_id=users["student"].id))
        db.commit()
        repository = KnowledgeGraphRepository(db)
        publication = repository.active_publication()
        if publication is None:
            template = content_root() / "knowledge-graph/templates/expert-knowledge-graph-v3.xlsx"
            importer = KnowledgeImportService(repository)
            job, _ = importer.import_workbook(
                actor_id=users["teacher"].id,
                filename=template.name,
                content=template.read_bytes(),
                template_version="3.1",
            )
            change = importer.change_set_for_import(
                job.id, users["technician"].id, is_technician=True
            )
            review = KnowledgeReviewService(repository, graph)
            review.submit_review(change, users["teacher"].id)
            review.decide(change, users["technician"].id, "approve", None)
            publication = review.publish(change, users["technician"].id)
        # Repair a missing graph adapter file using its versioned SQL source of truth.
        payload = publication.graph_payload
        nodes, edges = payload["nodes"], payload["relationships"]
        if not isinstance(nodes, list) or not isinstance(edges, list):
            raise ValueError("Published graph payload is invalid")
        graph.publish(
            publication.graph_version,
            cast(list[dict[str, object]], nodes),
            cast(list[dict[str, object]], edges),
        )
        return publication.graph_version
