"""Allowlisted source kit: never include source .env, databases, private keys or user uploads."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "release/windows-x64"
ROOTS = (
    "apps/api/app",
    "apps/api/alembic",
    "apps/web/dist",
    "apps/web/src",
    "apps/web/public",
    "content",
    "desktop",
    "scripts/desktop",
    "docs/handoff/windows-expert",
    "docs/handoff/windows-public",
)
EXCLUDED_PARTS = {
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
}
EXCLUDED_SUFFIXES = {".pyc", ".db", ".sqlite", ".sqlite3", ".pem", ".key", ".log"}


def main() -> None:
    global OUT
    parser = argparse.ArgumentParser()
    parser.add_argument("--public", action="store_true")
    args = parser.parse_args()
    if args.public:
        OUT = ROOT / "public-release/windows-x64"
    OUT.mkdir(parents=True, exist_ok=True)
    if not (ROOT / "apps/web/dist/index.html").exists():
        raise RuntimeError("Build the desktop frontend first")
    build = json.loads((ROOT / "apps/web/dist/desktop-build.json").read_text())
    if build.get("desktop") is not True or build.get("apiBase") != "same-origin":
        raise RuntimeError("Desktop frontend build attestation missing")
    for asset in build["assets"]:
        data = (ROOT / "apps/web/dist" / asset["path"]).read_bytes()
        if hashlib.sha256(data).hexdigest() != asset["sha256"]:
            raise RuntimeError("Frontend asset hash mismatch")
    entries = []
    for folder in ROOTS:
        for source in (ROOT / folder).rglob("*"):
            relative = source.relative_to(ROOT)
            if (
                not source.is_file()
                or source.is_symlink()
                or any(part in EXCLUDED_PARTS for part in relative.parts)
                or (args.public and relative.as_posix().startswith("content/simulation/assets/"))
                or source.name.startswith(".env")
                or source.name == "demo-credential.json"
                or source.suffix in EXCLUDED_SUFFIXES
            ):
                continue
            entries.append(source)
    entries.extend(
        ROOT / name
        for name in (
            "LICENSE",
            "apps/api/pyproject.toml",
            "apps/web/package.json",
            "package.json",
            "pnpm-lock.yaml",
            "pnpm-workspace.yaml",
        )
    )
    entries = sorted(set(entries))
    manifest = {
        "git_head": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
        ).strip(),
        "includes_uncommitted_changes": True,
        "credential_mode": "none",
        "files": [
            {
                "path": str(p.relative_to(ROOT)),
                "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
            }
            for p in entries
        ],
    }
    package = OUT / "windows-build-source.zip"
    with zipfile.ZipFile(package, "w", zipfile.ZIP_DEFLATED) as archive:
        for source in entries:
            archive.write(source, str(source.relative_to(ROOT)))
        archive.writestr(
            "source-manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2)
        )
    digest = hashlib.sha256(package.read_bytes()).hexdigest()
    package.with_suffix(".zip.sha256").write_text(f"{digest}  {package.name}\n")
    (OUT / "source-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2)
    )
    wheels = OUT / "wheelhouse"
    if wheels.exists():
        (wheels / "manifest.json").write_text(
            json.dumps(
                {
                    "files": [
                        {
                            "name": p.name,
                            "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
                        }
                        for p in sorted(wheels.glob("*.whl"))
                    ]
                },
                indent=2,
            )
        )
    print(f"Source kit: {len(entries)} files; SHA-256 {digest}")


if __name__ == "__main__":
    main()
