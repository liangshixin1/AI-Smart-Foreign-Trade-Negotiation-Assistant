from __future__ import annotations

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
    "legacy",
}


def limit_for(path: Path) -> int | None:
    if path.suffix == ".vue":
        return 500
    if path.suffix in {".ts", ".py"}:
        lowered = {part.lower() for part in path.parts}
        if lowered & {"composables", "services", "stores"}:
            return 200
        return 500
    return None


def main() -> int:
    violations: list[str] = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or SKIP_PARTS.intersection(path.parts):
            continue
        limit = limit_for(path)
        if limit is None:
            continue
        line_count = len(path.read_text(encoding="utf-8").splitlines())
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
