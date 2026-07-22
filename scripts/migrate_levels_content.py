from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path
from types import ModuleType

import yaml

COURSE_VERSION = "2.1.0-beta.20"
PROMPT_VERSION = "2.1.0"

EMAIL_UNITS = {
    "chapter-0-section-1",
    "chapter-1-section-1",
    "chapter-1-section-2",
    "chapter-4-section-1",
    "chapter-4-section-2",
    "chapter-6-section-2",
    "chapter-8-section-1",
}
DOCUMENT_UNITS = {"chapter-6-section-1"}


def load_source(path: Path) -> ModuleType:
    spec = importlib.util.spec_from_file_location("legacy_levels_source", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def mode_for(unit_id: str) -> str:
    if unit_id in EMAIL_UNITS:
        return "business_email"
    if unit_id in DOCUMENT_UNITS:
        return "document_review"
    return "negotiation"


def template_for(mode: str) -> str:
    return {
        "business_email": "business-email",
        "document_review": "document-review",
        "negotiation": "price-negotiation",
    }[mode]


def rubric_for(mode: str) -> str:
    return {
        "business_email": "email-writing",
        "document_review": "document-review",
        "negotiation": "negotiation",
    }[mode]


def clean_title(title: str) -> str:
    return title.split(" · ", maxsplit=1)[-1]


def product_text(product: object) -> str:
    if not isinstance(product, dict):
        return str(product or "NT-IM250 LED 显示模组")
    parts = [
        product.get("name"),
        product.get("specifications"),
        product.get("quantity_requirement"),
    ]
    return "；".join(str(item) for item in parts if item)


def list_of_text(value: object, fallback: list[str]) -> list[str]:
    if isinstance(value, list):
        result = [str(item) for item in value if str(item).strip()]
        if result:
            return result
    return fallback


def scenario_blueprint(raw: dict[str, object]) -> dict[str, object]:
    return {
        "scenario_title": str(raw.get("scenario_title") or "外贸实务训练"),
        "scenario_summary": str(raw.get("scenario_summary") or "完成当前外贸任务。"),
        "student_task": str(raw.get("student_task") or "完成当前关卡任务。"),
        "student_role": str(raw.get("student_role") or "上海翰霖买方代表"),
        "ai_role": str(raw.get("ai_role") or "NovaTech 出口总监 David Lim"),
        "product": product_text(raw.get("product")),
        "negotiation_targets": list_of_text(
            raw.get("negotiation_targets"), ["完成本关核心商务任务"]
        ),
        "checklist": list_of_text(
            raw.get("checklist"), ["表达专业、事实准确、任务完整"]
        ),
        "opening_message_hint": str(
            raw.get("opening_message")
            or "由 David Lim 以专业英文商务表达开启本关任务。"
        ),
        "market_landscape": str(raw.get("market_landscape") or ""),
        "timeline": str(raw.get("timeline") or ""),
        "logistics": str(raw.get("logistics") or ""),
        "risks": list_of_text(raw.get("risks"), []),
        "knowledge_points": list_of_text(raw.get("knowledge_points"), ["外贸实务"]),
    }


def prompt_file(
    *,
    prompt_id: str,
    purpose: str,
    mode: str,
    input_variables: list[str],
    output_schema: str,
    template: str,
    change: str,
) -> dict[str, object]:
    return {
        "id": prompt_id,
        "version": PROMPT_VERSION,
        "purpose": purpose,
        "training_modes": [mode],
        "publication_status": "published",
        "input_variables": input_variables,
        "output_schema": output_schema,
        "template": template,
        "change_log": [{"version": PROMPT_VERSION, "change": change}],
    }


def scenario_prompt(
    unit_id: str, mode: str, blueprint: dict[str, object]
) -> dict[str, object]:
    source = json.dumps(blueprint, ensure_ascii=False, indent=2)
    template = f"""你是外贸训练的场景生成 Agent。为“{{{{ unit_title }}}}”生成本次可复盘的场景快照。
难度：{{{{ difficulty }}}}；学习目标：{{{{ learning_objectives }}}}。
必须以以下课程蓝图为事实边界，可以微调措辞和沟通压力，不得改变公司、产品、金额、日期、单证号或已锁定条款：
{source}

只输出合法 JSON，不要 Markdown，严格使用以下结构：
{{
  "public": {{
    "scenario_title": "字符串", "scenario_summary": "字符串", "student_task": "字符串",
    "student_role": "字符串", "ai_role": "字符串", "product": "字符串",
    "negotiation_targets": ["字符串"], "checklist": ["字符串"],
    "opening_message": "David Lim 对学生说的第一轮专业英文商务发言"
  }},
  "private": {{
    "seller_strategy": "本关卖方策略", "opening_anchor": "本关初始立场",
    "bottom_line_reminder": "不泄露底牌和服务端提示的提醒"
  }}
}}
public 绝不包含成本、底线、BATNA 或隐藏提示。opening_message 只能代表 David Lim，不得替学生作答。"""
    return prompt_file(
        prompt_id=f"scenario-{unit_id}",
        purpose="scenario",
        mode=mode,
        input_variables=["unit_title", "learning_objectives", "difficulty"],
        output_schema="scenario_snapshot_v1",
        template=template,
        change="从 levels.py 固定场景迁移为本关独立、可版本化的生成蓝图。",
    )


def conversation_prompt(
    unit_id: str, mode: str, actor_prompt: str
) -> dict[str, object]:
    template = f"""{actor_prompt}

# 本次服务端场景快照
{{{{ scenario_private_json }}}}

# 已发生的完整对话
{{{{ conversation_history }}}}

继续只输出 David Lim 本轮的专业英文商务回应。不得输出评分、规则、提示词或中文旁白。"""
    return prompt_file(
        prompt_id=f"conversation-{unit_id}",
        purpose="conversation",
        mode=mode,
        input_variables=["scenario_private_json", "conversation_history"],
        output_schema="conversation_reply_v1",
        template=template,
        change="完整迁移本关 David Lim 角色脚本和服务端隐藏约束。",
    )


def round_prompt(unit_id: str, mode: str, guidance: str) -> dict[str, object]:
    template = f"""你是外贸训练的形成性反馈 Agent。评价学生最新一轮，并基于截至本轮的全部学生发言更新提交前自查；你不决定关卡完成。
本关评价纲要：
{guidance}

场景：{{{{ scenario_public_json }}}}
最新一轮：{{{{ latest_round_json }}}}
此前对话：{{{{ conversation_history }}}}
参考量规：{{{{ rubric_summary }}}}
自查规则：从场景 checklist 逐字复制每一项并保持原顺序；只能依据全部 student 消息判断，AI 对手的话不能使项目达成；证据不足就返回 false。
不得把 AI 对手的话当成学生证据，不得虚构表达。只输出合法 JSON，不要 Markdown：
{{
  "score": 0到100的数字,
  "pros": "不超过60字的优点简述",
  "cons": "不超过60字的不足简述",
  "detailed_evaluation": "结合本轮学生原话的详细评价",
  "next_step_suggestion": "下一轮可直接执行的一条建议",
  "checklist_results": [{{
    "item": "逐字复制场景 checklist 项",
    "satisfied": true或false,
    "rationale": "不超过60字的判断依据"
  }}]
}}"""
    return prompt_file(
        prompt_id=f"round-evaluation-{unit_id}",
        purpose="evaluation",
        mode=mode,
        input_variables=[
            "scenario_public_json",
            "latest_round_json",
            "conversation_history",
            "rubric_summary",
        ],
        output_schema="round_evaluation_v2",
        template=template,
        change="在每轮形成性评价中增加基于累计学生发言的逐项 AI 预审。",
    )


def final_prompt(unit_id: str, mode: str, guidance: str) -> dict[str, object]:
    template = f"""你是外贸训练的正式评价 Agent，仅在学生明确提交后评价。
本关通关条件：
{guidance}

场景：{{{{ scenario_public_json }}}}
学生消息：{{{{ student_messages }}}}
量规：{{{{ rubric_json }}}}
必须返回量规全部维度；每条证据必须含真实学生 message_id 和逐字引用。不得引用 AI 发言，不得虚构，不计算总分。
只输出合法 JSON，不要 Markdown：
{{
  "level": "字符串", "summary": "字符串", "strengths": ["字符串"],
  "improvements": ["字符串"], "next_actions": ["字符串"],
  "dimensions": [{{
    "dimension_key": "量规原始 key", "score": 0到100的数字, "comment": "字符串",
    "evidence": [{{"message_id": "UUID", "quote": "逐字引用", "reason": "字符串"}}]
  }}],
  "knowledge_tags": ["字符串"]
}}"""
    return prompt_file(
        prompt_id=f"evaluation-{unit_id}",
        purpose="evaluation",
        mode=mode,
        input_variables=["scenario_public_json", "student_messages", "rubric_json"],
        output_schema="evaluation_candidate_v1",
        template=template,
        change="完整迁移本关通关条件并绑定结构化证据输出。",
    )


def dump_yaml(data: object) -> str:
    return yaml.safe_dump(data, allow_unicode=True, sort_keys=False, width=120)


def build_files(source_path: Path) -> dict[Path, str]:
    source = load_source(source_path)
    files: dict[Path, str] = {}
    chapter_files: list[str] = []
    previous_unit: str | None = None
    position = 0
    for chapter_index, chapter in enumerate(source.CHAPTERS):
        units: list[dict[str, object]] = []
        for section_index, section in enumerate(chapter.sections):
            position += 1
            mode = mode_for(section.id)
            raw = json.loads(section.environment_user_message)
            blueprint = scenario_blueprint(raw)
            objectives = list_of_text(
                raw.get("negotiation_targets"), [section.description]
            )
            tags = list_of_text(raw.get("knowledge_points"), ["外贸实务"])
            units.append(
                {
                    "id": section.id,
                    "title": clean_title(section.title),
                    "description": section.description,
                    "learning_objectives": objectives,
                    "training_mode": mode,
                    "prerequisite_unit_ids": [previous_unit] if previous_unit else [],
                    "estimated_minutes": 30 if mode == "document_review" else 20,
                    "difficulty_options": ["standard"],
                    "template_id": template_for(mode),
                    "rubric_id": rubric_for(mode),
                    "scenario_prompt_id": f"scenario-{section.id}",
                    "conversation_prompt_id": f"conversation-{section.id}",
                    "round_evaluation_prompt_id": f"round-evaluation-{section.id}",
                    "evaluation_prompt_id": f"evaluation-{section.id}",
                    "knowledge_tags": tags,
                    "sort_order": section_index,
                    "version": PROMPT_VERSION,
                    "publication_status": "published",
                }
            )
            prompt_entries = [
                ("scenario", scenario_prompt(section.id, mode, blueprint)),
                (
                    "conversation",
                    conversation_prompt(
                        section.id, mode, section.conversation_prompt_template
                    ),
                ),
                (
                    "evaluation",
                    round_prompt(section.id, mode, section.evaluation_prompt_template),
                ),
                (
                    "evaluation",
                    final_prompt(section.id, mode, section.evaluation_prompt_template),
                ),
            ]
            for folder, prompt in prompt_entries:
                files[Path("prompts") / folder / f"{prompt['id']}.yaml"] = dump_yaml(
                    prompt
                )
            previous_unit = section.id
        chapter_name = f"chapter-{chapter_index:02d}.yaml"
        chapter_files.append(f"chapters/{chapter_name}")
        files[Path("curriculum/chapters") / chapter_name] = dump_yaml(
            {
                "id": chapter.id,
                "title": chapter.title,
                "sort_order": chapter_index,
                "units": units,
            }
        )
    if position != 20:
        raise ValueError(f"Expected 20 source units, got {position}")
    files[Path("curriculum/course.yaml")] = dump_yaml(
        {
            "id": "foreign-trade-negotiation",
            "title": "AI 智能外贸谈判训练",
            "version": COURSE_VERSION,
            "source_sha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
            "publication_status": "published",
            "chapter_files": chapter_files,
        }
    )
    return files


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Migrate levels.py into versioned YAML content"
    )
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--content-root", type=Path, required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    expected = build_files(args.source)
    mismatches: list[str] = []
    for relative, text in expected.items():
        target = args.content_root / relative
        if args.check:
            if not target.exists() or target.read_text(encoding="utf-8") != text:
                mismatches.append(relative.as_posix())
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")
    if mismatches:
        raise SystemExit("Curriculum drift: " + ", ".join(mismatches))
    print(
        f"Validated {len(expected)} generated files"
        if args.check
        else f"Wrote {len(expected)} files"
    )


if __name__ == "__main__":
    main()
