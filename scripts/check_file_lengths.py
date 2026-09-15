from __future__ import annotations

import io
import json
import subprocess
import tokenize
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# tmp 仅放置文档构建器和渲染预览；legacy 是重构前的只读快照。
# 两者都不属于当前可部署业务代码，也不能稀释或阻断新架构的质量门槛。
SKIP_PARTS = {
    "node_modules",
    ".venv",
    "dist",
    "__pycache__",
    ".git",
    "tmp",
    "work",
    "legacy",
}
LINE_LIMIT_TOLERANCE = 1.5


def limit_for(path: Path) -> int | None:
    if path.suffix == ".vue":
        return int(500 * LINE_LIMIT_TOLERANCE)
    if path.suffix in {".ts", ".py"}:
        lowered = {part.lower() for part in path.parts}
        if lowered & {"composables", "services", "stores"}:
            return int(200 * LINE_LIMIT_TOLERANCE)
        return int(500 * LINE_LIMIT_TOLERANCE)
    return None


def python_documentation_lines(source: str) -> int:
    """只豁免独占行的交接注释；字符串、docstring 和原有审计口径保持不变。"""
    rows = set()
    for token in tokenize.generate_tokens(io.StringIO(source).readline):
        if token.type != tokenize.COMMENT or not token.string.startswith("# [导读] "):
            continue
        if not token.line[: token.start[1]].strip():
            rows.add(token.start[0])
    return len(rows)


def documentation_counts(sources: dict[Path, str]) -> dict[Path, int]:
    """用各语言的解析器识别新增注释，不用正则误删模板字符串中的同形文本。"""
    counts = {
        path: python_documentation_lines(source)
        for path, source in sources.items()
        if path.suffix == ".py"
    }
    web_sources = [
        {"path": str(path), "source": source}
        for path, source in sources.items()
        if path.suffix in {".ts", ".vue"}
    ]
    if web_sources:
        completed = subprocess.run(
            ["node", str(ROOT / "scripts/count_handoff_comments.cjs")],
            input=json.dumps(web_sources),
            text=True,
            capture_output=True,
            check=True,
        )
        counts.update(
            {Path(path): count for path, count in json.loads(completed.stdout).items()}
        )
    return counts


def main() -> int:
    violations: list[str] = []
    sources: dict[Path, str] = {}
    for path in ROOT.rglob("*"):
        if not path.is_file() or SKIP_PARTS.intersection(path.parts):
            continue
        limit = limit_for(path)
        if limit is None:
            continue
        sources[path] = path.read_text(encoding="utf-8")
    excluded = documentation_counts(sources)
    for path, source in sources.items():
        limit = limit_for(path)
        assert limit is not None
        line_count = len(source.splitlines()) - excluded.get(path, 0)
        if line_count > limit:
            violations.append(f"{path.relative_to(ROOT)}: {line_count} > {limit}")
    if violations:
        print("File length violations:")
        print("\n".join(violations))
        return 1
    print("File length check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
