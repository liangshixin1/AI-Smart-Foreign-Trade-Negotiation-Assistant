from __future__ import annotations

import json

from app.integrations.llm.prompt_renderer import render_prompt
from app.modules.curriculum.models import PromptTemplate
from app.modules.training.models import Attempt
from app.modules.training.repository import TrainingRepository

ADAPTIVE_CONVERSATION_PROMPT = "adaptive-conversation-zpd"
ROUND_DIAGNOSTIC_PROMPT = "round-learning-diagnostic-zpd"
FINAL_DIAGNOSTIC_PROMPT = "final-learning-diagnostic-zpd"


def conversation_adaptation(
    repository: TrainingRepository, attempt: Attempt
) -> tuple[str, PromptTemplate]:
    template = repository.published_prompt(ADAPTIVE_CONVERSATION_PROMPT)
    latest = repository.latest_learning_diagnostic(attempt.student_id)
    diagnostic = latest.learning_diagnostic if latest and latest.learning_diagnostic else {}
    if not diagnostic:
        diagnostic = _baseline_diagnostic(attempt.difficulty)
    rendered = render_prompt(
        template.body,
        {
            "learner_diagnostic_json": json.dumps(diagnostic, ensure_ascii=False),
            "attempt_difficulty": attempt.difficulty,
        },
    )
    return rendered, template


def round_diagnostic_extension(
    repository: TrainingRepository, attempt: Attempt
) -> tuple[str, PromptTemplate]:
    template = repository.published_prompt(ROUND_DIAGNOSTIC_PROMPT)
    latest = repository.latest_learning_diagnostic(attempt.student_id)
    previous = latest.learning_diagnostic if latest and latest.learning_diagnostic else {}
    return (
        render_prompt(
            template.body,
            {"previous_learning_diagnostic_json": json.dumps(previous, ensure_ascii=False)},
        ),
        template,
    )


def final_diagnostic_extension(
    repository: TrainingRepository, attempt: Attempt
) -> tuple[str, PromptTemplate]:
    template = repository.published_prompt(FINAL_DIAGNOSTIC_PROMPT)
    diagnostics = [
        item.learning_diagnostic
        for item in repository.round_evaluations(attempt.id)
        if item.learning_diagnostic
    ]
    return (
        render_prompt(
            template.body,
            {"round_learning_diagnostics_json": json.dumps(diagnostics, ensure_ascii=False)},
        ),
        template,
    )


def _baseline_diagnostic(difficulty: str) -> dict[str, object]:
    baselines = {
        "easy": ("foundation", 1, "explicit_model"),
        "standard": ("developing", 2, "guided_choice"),
        "hard": ("competent", 3, "implicit_prompt"),
        "advanced": ("competent", 3, "implicit_prompt"),
    }
    stage, challenge, support = baselines.get(difficulty, ("developing", 2, "guided_choice"))
    return {
        "framework_version": "zpd-da-v1",
        "learner_stage": stage,
        "challenge_level": challenge,
        "support_level": support,
        "negotiation_style": "unclear",
        "next_stretch_target": "观察学生的独立表达、业务判断与谈判应变能力。",
        "mediation_strategy": "先以角色内澄清问题提供低显性度支持。",
        "confidence": 0.2,
    }
