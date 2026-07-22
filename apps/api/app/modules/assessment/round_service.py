from __future__ import annotations

import json
import uuid

from sqlalchemy.orm import Session

from app.integrations.knowledge_graph.base import GraphStore
from app.integrations.llm.base import LLMMessage, LLMProvider, LLMRequest
from app.integrations.llm.prompt_renderer import render_prompt
from app.integrations.llm.structured_output import parse_structured_output
from app.modules.assessment.diagnostic import bind_diagnostic_evidence
from app.modules.assessment.models import RoundEvaluation
from app.modules.assessment.schemas import RoundEvaluationCandidate
from app.modules.curriculum.models import TrainingUnit
from app.modules.knowledge_graph.recommendation_service import GraphRecommendationService
from app.modules.training.adaptive_learning import round_diagnostic_extension
from app.modules.training.invocations import invoke_and_record
from app.modules.training.models import Attempt, Message
from app.modules.training.repository import TrainingRepository


class RoundAssessmentService:
    def __init__(self, db: Session, provider: LLMProvider, graph_store: GraphStore) -> None:
        self.db = db
        self.provider = provider
        self.recommendations = GraphRecommendationService(db, graph_store)
        self.repository = TrainingRepository(db)

    def evaluate(
        self,
        attempt: Attempt,
        unit: TrainingUnit,
        student_message: Message,
        assistant_message: Message,
    ) -> RoundEvaluation:
        if attempt.scenario is None:
            raise ValueError("Round evaluation requires a scenario snapshot")
        excluded_ids = {student_message.id, assistant_message.id}
        history = [
            {"message_id": str(item.id), "role": item.role, "content": item.content}
            for item in attempt.messages
            if item.status == "completed" and item.id not in excluded_ids
        ]
        latest_round = {
            "student": {
                "message_id": str(student_message.id),
                "content": student_message.content,
            },
            "assistant": {
                "message_id": str(assistant_message.id),
                "content": assistant_message.content,
            },
        }
        prompt = render_prompt(
            unit.round_evaluation_prompt.body,
            {
                "scenario_public_json": json.dumps(
                    attempt.scenario.public_payload, ensure_ascii=False
                ),
                "latest_round_json": json.dumps(latest_round, ensure_ascii=False),
                "conversation_history": json.dumps(history, ensure_ascii=False),
                "rubric_summary": json.dumps(unit.rubric.dimensions, ensure_ascii=False),
            },
        )
        graph_candidates = self.recommendations.candidates(attempt, unit)
        diagnostic_instruction, diagnostic_template = round_diagnostic_extension(
            self.repository, attempt
        )
        recommendation_instruction = (
            "\n\n你还必须从下列图谱候选中按本轮学生实际表达选择最多 3 个知识资源和最多 3 个策略。"
            "不得编造候选外 ID。若本轮不需要推荐则返回空数组。"
            "输出字段 knowledge_recommendations 与 strategy_recommendations；每项严格包含 "
            "node_id、confidence(0-1)、reason、reveal_level(1-3)。候选如下：\n"
            + json.dumps(graph_candidates, ensure_ascii=False)
        )
        request = LLMRequest(
            purpose="evaluation",
            prompt_template_id=unit.round_evaluation_prompt.prompt_key,
            prompt_version=unit.round_evaluation_prompt.version,
            correlation_id=str(uuid.uuid4()),
            messages=[
                LLMMessage(
                    role="system",
                    content=prompt + diagnostic_instruction + recommendation_instruction,
                )
            ],
            json_output=True,
            max_output_tokens=4096,
            metadata={
                "attempt_id": str(attempt.id),
                "evaluation_kind": "round",
                "checklist_json": json.dumps(
                    attempt.scenario.public_payload.get("checklist", []), ensure_ascii=False
                ),
                "graph_candidates_json": json.dumps(graph_candidates, ensure_ascii=False),
                "diagnostic_prompt_template_id": diagnostic_template.prompt_key,
                "diagnostic_prompt_version": diagnostic_template.version,
            },
        )
        response = invoke_and_record(self.db, self.provider, request)
        candidate = parse_structured_output(response.content, RoundEvaluationCandidate)
        self._validate_checklist(candidate, attempt.scenario.public_payload)
        student_messages = [
            item
            for item in attempt.messages
            if item.role == "student" and item.status == "completed"
        ]
        bind_diagnostic_evidence(candidate.learning_diagnostic, student_messages)
        recommendations = self.recommendations.validate_selection(
            graph_candidates,
            candidate.knowledge_recommendations,
            candidate.strategy_recommendations,
        )
        evaluation = RoundEvaluation(
            attempt_id=attempt.id,
            student_message_id=student_message.id,
            assistant_message_id=assistant_message.id,
            status="completed",
            score=candidate.score,
            pros=candidate.pros,
            cons=candidate.cons,
            detailed_evaluation=candidate.detailed_evaluation,
            next_step_suggestion=candidate.next_step_suggestion,
            checklist_results=[item.model_dump() for item in candidate.checklist_results],
            recommendations=recommendations,
            learning_diagnostic=candidate.learning_diagnostic.model_dump(mode="json"),
            provider=response.provider,
            model_name=response.model,
            prompt_template_id=unit.round_evaluation_prompt.prompt_key,
            prompt_version=unit.round_evaluation_prompt.version,
            raw_output_reference=f"llm-invocation:{request.correlation_id}",
        )
        self.db.add(evaluation)
        self.db.commit()
        return evaluation

    @staticmethod
    def _validate_checklist(
        candidate: RoundEvaluationCandidate, scenario_public: dict[str, object]
    ) -> None:
        """保证 AI 只能逐项判断场景已有清单, 不能增删或改写教学标准."""
        if not candidate.checklist_results:
            # 兼容升级前已发布的旧提示词; 新提示词会强制返回完整清单.
            return
        expected = scenario_public.get("checklist", [])
        if not isinstance(expected, list) or not all(isinstance(item, str) for item in expected):
            raise ValueError("Scenario checklist is invalid")
        returned = [item.item for item in candidate.checklist_results]
        if returned != expected:
            raise ValueError("Round evaluation checklist does not match scenario")
