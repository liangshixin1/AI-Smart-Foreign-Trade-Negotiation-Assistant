# [导读] 所属业务: 信用证结构化审改。
# [导读] 业务名词: 信用证是银行按约定单据付款的承诺; MT700 是本项目采用的信用证报文样式; 批注是
# [导读] 学生提出的改证意见。
# [导读] 用途与原因: 为信用证专用训练建立原证、案例、答案和规则的版本快照; 之后重放不应受源文件
# [导读] 更新影响。
# [导读] 结构: create。
# [导读] 提醒: 原证与标准答案以快照保存; 学生只改批注。成绩由版本化本地规则计算, 模型仅生成额外
# [导读] 讲评。
from __future__ import annotations

from sqlalchemy.orm import Session

from app.modules.auth.models import User
from app.modules.curriculum.models import TrainingUnit
from app.modules.document_correction.models import CorrectionSession
from app.modules.document_correction.profile_service import load_assets, require_tables
from app.modules.simulation.models import AttemptCreationRequest
from app.modules.training.hashing import stable_hash
from app.modules.training.models import Attempt, ScenarioSnapshot
from app.modules.training.presenter import present_attempt
from app.modules.training.repository import TrainingRepository
from app.modules.training.schemas import AttemptResponse, CreateAttemptRequest
from app.modules.training.state import transition


# [导读] 将原证、案例和答案资料固化到本次训练, 后续评分与教师回放都读取同一套依据。
def create(
    db: Session,
    student: User,
    unit: TrainingUnit,
    data: CreateAttemptRequest,
    key: str,
    request_hash: str,
) -> AttemptResponse:
    require_tables(db)
    profile, case, document, answers = load_assets()
    bindings = {
        "workspace_kind": "lc_correction",
        "document_profile_id": profile["id"],
        "document_profile_version": profile["version"],
        "document_template_id": profile["template_id"],
        "document_template_version": profile["template_version"],
        "case_snapshot_version": profile["case_snapshot_version"],
        "answer_rules_version": profile["answer_rules_version"],
        "variant_id": profile["variant_id"],
        "course_version": unit.chapter.course_version.version,
        "unit_version": unit.version,
    }
    attempt = Attempt(
        student_id=student.id,
        unit_id=unit.id,
        course_version_id=unit.chapter.course_version_id,
        status="not_started",
        difficulty=data.difficulty,
        experience_mode="chat",
        content_bindings=bindings,
    )
    db.add(attempt)
    db.flush()
    scenario = {
        "scenario_title": "信用证审改模式",
        "scenario_summary": "请以买方单证审核人员身份，核对固定合同和信用证审核副本。",
        "student_task": "标记8处不符点，选择依据并提出改证申请草案。原信用证不会被直接改写。",
        "student_role": "买方单证审核人员",
        "ai_role": "学习支持",
        "product": "NT-IM250",
        "negotiation_targets": ["识别不符点并提出可执行的修改"],
        "checklist": [
            "定位30%、修改50%、依据20%；误报扣3分，损害正确重大字段额外扣5分，总扣分上限15分。",
            "总分至少80，无重大遗漏，未错误修改正确重大字段，提交项结构完整。",
        ],
        "opening_message": "先核对主体和金额，再检查装运、单据与期限关系。",
    }
    attempt.scenario = ScenarioSnapshot(
        public_payload=scenario,
        private_payload={},
        content_hash=stable_hash(scenario),
        provider="local",
        model_name="deterministic",
        prompt_template_id="lc-fixed-briefing",
        prompt_version="1.0.0",
    )
    db.add(
        CorrectionSession(
            attempt_id=attempt.id,
            bindings=bindings,
            case_snapshot=case,
            document_snapshot=document,
            answer_snapshot=answers,
            case_hash=stable_hash(case),
            document_hash=stable_hash(document),
            answer_hash=stable_hash(answers),
        )
    )
    db.add(
        AttemptCreationRequest(
            student_id=student.id,
            idempotency_key=key,
            request_hash=request_hash,
            attempt_id=attempt.id,
            status="completed",
        )
    )
    db.add(transition(attempt, "generating_scenario", "document_assembly_started"))
    db.add(transition(attempt, "in_progress", "document_assembled_locally"))
    db.commit()
    return present_attempt(attempt, unit, None, repository=TrainingRepository(db))
