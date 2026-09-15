# [导读] 所属业务: 教学知识图谱、学习内容与证据。
# [导读] 业务名词: 图谱用节点与关系表达阶段、商务现象、知识点和策略; Scaffold 是本次训练固定的学
# [导读] 习支持库。
# [导读] 用途与原因: 对上传工作簿做版本选择、解析、校验与编译, 并保存导入任务和变更集; 校验不通
# [导读] 过的内容不能直接发布。
# [导读] 结构: KnowledgeImportService。
# [导读] 提醒: graph_version 与 node_key 一起定位内容; 显示短名不等于稳定编号, 历史证据不能随当
# [导读] 前图谱重写。
from __future__ import annotations

import hashlib
import uuid

from app.core.errors import AppError
from app.modules.knowledge_graph.compiler import COMPILER_VERSION, compile_teacher_workbook
from app.modules.knowledge_graph.models import KnowledgeGraphChangeSet, KnowledgeImportJob
from app.modules.knowledge_graph.pi_stages import (
    PI_COMPILER_VERSION,
    normalize_pi_source,
    pi_scenarios,
    validate_pi_baseline,
)
from app.modules.knowledge_graph.repository import KnowledgeGraphRepository
from app.modules.knowledge_graph.v2_compiler import (
    COMPILER_VERSION_V2,
    compile_teacher_workbook_v2,
)
from app.modules.knowledge_graph.v2_validation import validate_teacher_workbook_v2
from app.modules.knowledge_graph.v3_compiler import (
    COMPILER_VERSION_V3,
    compile_expert_workbook_v3,
    load_translation_payload,
)
from app.modules.knowledge_graph.v3_validation import validate_expert_workbook_v3
from app.modules.knowledge_graph.v21_compiler import (
    COMPILER_VERSION_V21,
    compile_teacher_workbook_v21,
)
from app.modules.knowledge_graph.v21_validation import validate_teacher_workbook_v21
from app.modules.knowledge_graph.validation import validate_teacher_workbook
from app.modules.knowledge_graph.xlsx_parser import (
    WorkbookRejected,
    parse_expert_workbook_v3,
    parse_teacher_workbook,
    parse_teacher_workbook_v2,
    parse_teacher_workbook_v21,
)


class KnowledgeImportService:
    def __init__(self, repository: KnowledgeGraphRepository) -> None:
        self.repository = repository

    # [导读] 按文件摘要、上传者和模板版本识别重复导入; 先校验再编译, 保留源工作簿与问题定位供复
    # [导读] 核。
    def import_workbook(
        self,
        *,
        actor_id: uuid.UUID,
        filename: str,
        content: bytes,
        template_version: str,
    ) -> tuple[KnowledgeImportJob, bool]:
        if template_version not in {"1.0", "2.0", "2.1", "3.0", "3.1"}:
            raise AppError(
                code="knowledge_graph.template_version_unsupported",
                message="支持 DSL 1.0/2.0、专家图谱 2.1/3.0 与 PI 十阶段 3.1。",
                status_code=422,
            )
        if not filename.lower().endswith(".xlsx"):
            raise AppError(
                code="knowledge_graph.file_type_invalid",
                message="请上传 .xlsx 教学案例表。",
                status_code=422,
            )
        source_hash = hashlib.sha256(content).hexdigest()
        existing = self.repository.find_import(actor_id, source_hash, template_version)
        if existing is not None:
            existing_change = self.repository.change_set_for_import(existing.id)
            compiler_is_current = not (
                template_version in {"3.0", "3.1"}
                and existing_change is not None
                and existing_change.compiler_version
                != (PI_COMPILER_VERSION if template_version == "3.1" else COMPILER_VERSION_V3)
            )
            if compiler_is_current:
                return existing, True
        try:
            if template_version in {"3.0", "3.1"}:
                parsed = parse_expert_workbook_v3(content)
            elif template_version == "2.1":
                parsed = parse_teacher_workbook_v21(content)
            elif template_version == "2.0":
                parsed = parse_teacher_workbook_v2(content)
            else:
                parsed = parse_teacher_workbook(content)
        except WorkbookRejected as exc:
            raise AppError(
                code="knowledge_graph.workbook_rejected",
                message=str(exc),
                status_code=422,
            ) from exc

        job = self.repository.add_import(
            owner_id=actor_id,
            filename=filename[:255],
            source_hash=source_hash,
            content=content,
            template_version=template_version,
        )
        if template_version in {"3.0", "3.1"}:
            issues = validate_expert_workbook_v3(parsed)
        elif template_version == "2.1":
            issues = validate_teacher_workbook_v21(parsed)
        elif template_version == "2.0":
            issues = validate_teacher_workbook_v2(parsed)
        else:
            issues = validate_teacher_workbook(parsed)
        if template_version == "3.1":
            issues.extend(validate_pi_baseline(parsed))
        self.repository.add_issues(job.id, issues)
        job.error_count = sum(issue.severity == "error" for issue in issues)
        job.warning_count = sum(issue.severity == "warning" for issue in issues)
        if job.error_count:
            job.status = "validation_failed"
        else:
            if template_version in {"3.0", "3.1"}:
                translations = load_translation_payload()
                if template_version == "3.1":
                    parsed, translations = normalize_pi_source(parsed, translations)
                from app.modules.knowledge_graph.v3_extensions import V3_SCENARIOS

                scenarios = pi_scenarios() if template_version == "3.1" else V3_SCENARIOS
                compiled = compile_expert_workbook_v3(
                    parsed,
                    self.repository.active_node_keys(),
                    translation_payload=translations,
                    scenarios=scenarios,
                )
                compiler_version = (
                    PI_COMPILER_VERSION if template_version == "3.1" else COMPILER_VERSION_V3
                )
            elif template_version == "2.1":
                compiled = compile_teacher_workbook_v21(parsed, self.repository.active_node_keys())
                compiler_version = COMPILER_VERSION_V21
            elif template_version == "2.0":
                compiled = compile_teacher_workbook_v2(parsed, self.repository.active_node_keys())
                compiler_version = COMPILER_VERSION_V2
            else:
                compiled = compile_teacher_workbook(parsed, self.repository.active_node_keys())
                compiler_version = COMPILER_VERSION
            change_set = self.repository.add_change_set(
                job.id,
                compiler_version=compiler_version,
                teaching_preview=compiled.teaching_preview,
                nodes=compiled.nodes,
                relationships=compiled.relationships,
                summary=compiled.summary,
            )
            if template_version in {"3.0", "3.1"}:
                self.repository.add_expert_v3_snapshots(
                    change_set.id,
                    parsed,
                    translations,
                    scenarios,
                )
            job.status = "review_ready"
        self.repository.audit(
            actor_id,
            "workbook.imported",
            "knowledge_import_job",
            job.id,
            {"source_hash": source_hash, "errors": job.error_count, "warnings": job.warning_count},
        )
        self.repository.commit()
        self.repository.refresh(job)
        return job, False

    def require_import(
        self, job_id: uuid.UUID, actor_id: uuid.UUID, *, is_technician: bool
    ) -> KnowledgeImportJob:
        job = self.repository.get_import(job_id)
        if job is None:
            raise AppError(
                code="knowledge_graph.import_not_found",
                message="找不到该导入任务。",
                status_code=404,
            )
        if not is_technician and job.uploaded_by_user_id != actor_id:
            raise AppError(code="auth.forbidden", message="你无权查看该导入任务。", status_code=403)
        return job

    def change_set_for_import(
        self, job_id: uuid.UUID, actor_id: uuid.UUID, *, is_technician: bool
    ) -> KnowledgeGraphChangeSet:
        self.require_import(job_id, actor_id, is_technician=is_technician)
        change_set = self.repository.change_set_for_import(job_id)
        if change_set is None:
            raise AppError(
                code="knowledge_graph.change_set_unavailable",
                message="该工作簿未通过校验，尚无可评审变更集。",
                status_code=409,
            )
        return change_set
