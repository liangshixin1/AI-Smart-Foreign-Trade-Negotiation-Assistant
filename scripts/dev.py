#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import os
import secrets
import shutil
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import IO

ROOT = Path(__file__).resolve().parents[1]
TMP_DIR = ROOT / "tmp" / "dev"
BOOTSTRAP_DIR = ROOT / "tmp" / "bootstrap"
ENV_FILE = ROOT / ".env"
ENV_EXAMPLE = ROOT / "apps" / "api" / ".env.example"
IS_WINDOWS = os.name == "nt"
LOCAL_HTTP = urllib.request.build_opener(urllib.request.ProxyHandler({}))


class DevStartupError(RuntimeError):
    """一键启动过程中可直接展示给开发者的错误。"""


def log(message: str) -> None:
    print(f"[dev] {message}", flush=True)


def run(
    command: list[str],
    *,
    check: bool = True,
    capture: bool = False,
) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        command,
        cwd=ROOT,
        check=False,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.STDOUT if capture else None,
    )
    if check and result.returncode != 0:
        detail = f"\n{result.stdout.strip()}" if capture and result.stdout else ""
        raise DevStartupError(f"命令执行失败：{' '.join(command)}{detail}")
    return result


def executable(name: str) -> str:
    path = shutil.which(name)
    if path is None and IS_WINDOWS:
        path = shutil.which(f"{name}.cmd") or shutil.which(f"{name}.exe")
    if path is None:
        raise DevStartupError(
            f"未找到 {name}。请使用对应平台的 start-dev 包装脚本自动准备系统工具。"
        )
    return path


def venv_python() -> Path:
    return ROOT / ".venv" / ("Scripts/python.exe" if IS_WINDOWS else "bin/python")


def signature(paths: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in paths:
        digest.update(path.relative_to(ROOT).as_posix().encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def marker_matches(marker: Path, expected: str) -> bool:
    return marker.exists() and marker.read_text(encoding="utf-8").strip() == expected


def write_marker(marker: Path, value: str) -> None:
    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.write_text(f"{value}\n", encoding="utf-8")


def replace_env_value(content: str, key: str, value: str) -> str:
    prefix = f"{key}="
    lines = content.splitlines()
    for index, line in enumerate(lines):
        if line.startswith(prefix):
            lines[index] = f"{prefix}{value}"
            break
    else:
        lines.append(f"{prefix}{value}")
    return "\n".join(lines) + "\n"


def parse_env(content: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def ensure_env() -> None:
    created = False
    if not ENV_FILE.exists():
        content = ENV_EXAMPLE.read_text(encoding="utf-8")
        created = True
    else:
        content = ENV_FILE.read_text(encoding="utf-8")

    generated_defaults = {
        "AUTH_TOKEN_PEPPER": secrets.token_urlsafe(48),
        "DEV_SEED_PASSWORD": f"LocalDev-{secrets.token_urlsafe(12)}",
        "NEO4J_PASSWORD": f"Neo4j-{secrets.token_urlsafe(18)}",
    }
    values = parse_env(content)
    added: list[str] = []
    for key, generated_value in generated_defaults.items():
        if not values.get(key):
            content = replace_env_value(content, key, generated_value)
            values[key] = generated_value
            added.append(key)

    if created or added:
        ENV_FILE.write_text(content, encoding="utf-8")
        if not IS_WINDOWS:
            ENV_FILE.chmod(0o600)
        if created:
            log("已从安全模板创建 .env，并生成本地随机密码；文件不会进入 Git。")
        else:
            log(
                "已补齐 .env 缺失的本地开发字段："
                f"{', '.join(added)}；已有配置均保持不变。"
            )

    required = tuple(generated_defaults)
    missing = [key for key in required if not values.get(key)]
    if missing:
        raise DevStartupError(
            f".env 中缺少必要配置：{', '.join(missing)}。请检查文件权限后重试。"
        )
    if values.get("LLM_PROVIDER") == "deepseek":
        deepseek_keys = (
            "DEEPSEEK_SCENARIO_API_KEY",
            "DEEPSEEK_CONVERSATION_API_KEY",
            "DEEPSEEK_EVALUATION_API_KEY",
        )
        missing_keys = [key for key in deepseek_keys if not values.get(key)]
        if missing_keys:
            raise DevStartupError(
                "LLM_PROVIDER=deepseek 时必须配置三把独立 Key："
                + ", ".join(missing_keys)
            )


def ensure_backend_dependencies() -> None:
    python = executable("python3") if not IS_WINDOWS else sys.executable
    target_python = venv_python()
    if not target_python.exists():
        log("首次运行：创建 Python 虚拟环境……")
        run([python, "-m", "venv", str(ROOT / ".venv")])

    backend_signature = signature([ROOT / "apps" / "api" / "pyproject.toml"])
    marker = BOOTSTRAP_DIR / "backend.sha256"
    if not marker_matches(marker, backend_signature):
        log("安装/更新 FastAPI 后端依赖……")
        run([str(target_python), "-m", "pip", "install", "--upgrade", "pip"])
        run(
            [
                str(target_python),
                "-m",
                "pip",
                "install",
                "-e",
                "apps/api[dev]",
            ]
        )
        write_marker(marker, backend_signature)
    else:
        log("后端依赖已是当前版本。")


def ensure_frontend_dependencies() -> str:
    node = executable("node")
    node_major = (
        run([node, "--version"], capture=True).stdout.strip().lstrip("v").split(".")[0]
    )
    if not node_major.isdigit() or int(node_major) < 20:
        raise DevStartupError("需要 Node.js 20 或更高版本。")
    pnpm = executable("pnpm")
    frontend_signature = signature(
        [
            ROOT / "package.json",
            ROOT / "pnpm-lock.yaml",
            ROOT / "apps" / "web" / "package.json",
        ]
    )
    marker = BOOTSTRAP_DIR / "frontend.sha256"
    if not (ROOT / "node_modules").exists() or not marker_matches(
        marker, frontend_signature
    ):
        log("安装/更新 Vue 前端依赖……")
        run([pnpm, "install", "--frozen-lockfile"])
        write_marker(marker, frontend_signature)
    else:
        log("前端依赖已是当前版本。")
    return pnpm


def docker_ready() -> bool:
    docker = shutil.which("docker")
    if docker is None:
        return False
    return run([docker, "info"], check=False, capture=True).returncode == 0


def wait_for_docker(timeout_seconds: int = 180) -> None:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if docker_ready():
            return
        time.sleep(2)
    raise DevStartupError(
        "Docker 守护进程未在限定时间内就绪。请检查 Colima/Docker Desktop 状态后重试。"
    )


def ensure_docker() -> None:
    executable("docker")
    if docker_ready():
        return

    if sys.platform == "darwin":
        colima = shutil.which("colima")
        if colima:
            log("启动 Colima/Docker……")
            run([colima, "start"])
        else:
            log("启动 Docker Desktop……")
            run(["open", "-a", "Docker"], check=False)
    elif IS_WINDOWS:
        candidates = (
            Path(os.environ.get("ProgramFiles", r"C:\Program Files"))
            / "Docker"
            / "Docker"
            / "Docker Desktop.exe",
            Path(os.environ.get("LOCALAPPDATA", "")) / "Docker" / "Docker Desktop.exe",
        )
        desktop = next((path for path in candidates if path.exists()), None)
        if desktop is None:
            raise DevStartupError(
                "已安装 Docker CLI，但未找到 Docker Desktop。"
                "请重新运行 start-dev.ps1 完成安装。"
            )
        log("启动 Docker Desktop……")
        subprocess.Popen([str(desktop)], cwd=ROOT)
    else:
        systemctl = shutil.which("systemctl")
        if systemctl:
            log("尝试启动 Linux Docker服务……")
            run(["sudo", systemctl, "start", "docker"], check=False)

    wait_for_docker()


def compose_command() -> list[str]:
    docker = executable("docker")
    if run([docker, "compose", "version"], check=False, capture=True).returncode == 0:
        return [docker, "compose"]
    standalone = shutil.which("docker-compose")
    if standalone:
        return [standalone]
    raise DevStartupError(
        "未找到 Docker Compose。macOS请安装 docker-compose，"
        "Windows请确认 Docker Desktop安装完整。"
    )


def http_ready(url: str) -> bool:
    try:
        # 本地健康检查必须绕过成员电脑上的 HTTP(S) 代理。
        with LOCAL_HTTP.open(url, timeout=2) as response:
            return 200 <= response.status < 500
    except urllib.error.HTTPError as error:
        return 200 <= error.code < 500
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def wait_http(
    url: str,
    label: str,
    timeout_seconds: int,
    process: subprocess.Popen[str] | None = None,
) -> None:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if http_ready(url):
            return
        if process is not None and process.poll() is not None:
            raise DevStartupError(f"{label}提前退出，退出码 {process.returncode}。")
        time.sleep(1)
    raise DevStartupError(f"{label}未在 {timeout_seconds} 秒内就绪：{url}")


def prepare_databases(pnpm: str, *, skip_seed: bool) -> None:
    log("启动并等待 Neo4j……")
    compose = compose_command()
    run([*compose, "up", "-d", "neo4j"])
    wait_http("http://127.0.0.1:17474/", "Neo4j", 120)

    log("执行 Alembic 数据库迁移……")
    run([pnpm, "db:migrate"])
    if not skip_seed:
        log("准备幂等开发账号、课程和示例班级……")
        run([pnpm, "seed:users"])
        run([pnpm, "seed:curriculum:if-missing"])
        run([pnpm, "seed:classroom"])


def start_process(
    command: list[str], log_file: Path
) -> tuple[subprocess.Popen[str], IO[str]]:
    log_file.parent.mkdir(parents=True, exist_ok=True)
    stream = log_file.open("a", encoding="utf-8")
    kwargs: dict[str, object] = {
        "cwd": ROOT,
        "stdout": stream,
        "stderr": subprocess.STDOUT,
        "text": True,
    }
    if IS_WINDOWS:
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True
    process = subprocess.Popen(command, **kwargs)
    return process, stream


def stop_process(process: subprocess.Popen[str] | None) -> None:
    if process is None or process.poll() is not None:
        return
    if IS_WINDOWS:
        subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return
    try:
        os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=8)
    except (ProcessLookupError, subprocess.TimeoutExpired):
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def tail_log(path: Path, lines: int = 30) -> str:
    if not path.exists():
        return ""
    return "\n".join(
        path.read_text(encoding="utf-8", errors="replace").splitlines()[-lines:]
    )


def serve(pnpm: str) -> None:
    api_url = "http://127.0.0.1:8000/health"
    web_url = "http://127.0.0.1:5174/"
    api_log = TMP_DIR / "api.log"
    web_log = TMP_DIR / "web.log"
    api_process: subprocess.Popen[str] | None = None
    web_process: subprocess.Popen[str] | None = None
    streams: list[IO[str]] = []

    try:
        if http_ready(api_url):
            log("FastAPI 已在 8000端口运行，复用现有服务。")
        else:
            log("启动 FastAPI（日志：tmp/dev/api.log）……")
            api_process, api_stream = start_process(
                [
                    str(venv_python()),
                    "-m",
                    "uvicorn",
                    "app.main:app",
                    "--app-dir",
                    "apps/api",
                    "--reload",
                    "--reload-dir",
                    "apps/api/app",
                    "--port",
                    "8000",
                ],
                api_log,
            )
            streams.append(api_stream)
            wait_http(api_url, "FastAPI", 60, api_process)

        if http_ready(web_url):
            log("Vite 已在 5174 端口运行，复用现有服务。")
        else:
            log("启动 Vue/Vite（日志：tmp/dev/web.log）……")
            web_process, web_stream = start_process(
                [pnpm, "--dir", "apps/web", "dev", "--host", "127.0.0.1"],
                web_log,
            )
            streams.append(web_stream)
            wait_http(web_url, "Vue/Vite", 60, web_process)

        print(
            "\n开发环境已就绪：\n"
            "  Web:     http://127.0.0.1:5174/\n"
            "  API:     http://127.0.0.1:8000/docs\n"
            "  Neo4j:   http://127.0.0.1:17474/\n"
            "  账号:    student@example.test / teacher@example.test / "
            "technician@example.test\n"
            "  密码:    查看本地 .env 的 DEV_SEED_PASSWORD（不要提交）\n",
            flush=True,
        )

        if api_process is None and web_process is None:
            return
        log("按 Ctrl+C 停止本脚本启动的前后端；Neo4j和本地数据将保留。")
        while True:
            for label, process, path in (
                ("FastAPI", api_process, api_log),
                ("Vue/Vite", web_process, web_log),
            ):
                if process is not None and process.poll() is not None:
                    raise DevStartupError(
                        f"{label}意外退出。\n--- {path} ---\n{tail_log(path)}"
                    )
            time.sleep(2)
    except KeyboardInterrupt:
        log("收到停止请求。")
    except DevStartupError:
        if api_process is not None:
            print(f"\n--- {api_log} ---\n{tail_log(api_log)}", file=sys.stderr)
        if web_process is not None:
            print(f"\n--- {web_log} ---\n{tail_log(web_log)}", file=sys.stderr)
        raise
    finally:
        stop_process(web_process)
        stop_process(api_process)
        for stream in streams:
            stream.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="跨平台一键准备并启动开发环境")
    parser.add_argument(
        "--bootstrap-only",
        action="store_true",
        help="只准备 .env、虚拟环境和依赖，不启动数据库与服务",
    )
    parser.add_argument(
        "--skip-seed",
        action="store_true",
        help="跳过开发账号、课程和示例班级的幂等种子命令",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        if sys.version_info < (3, 12):
            raise DevStartupError("需要 Python 3.12 或更高版本。")
        os.chdir(ROOT)
        ensure_env()
        ensure_backend_dependencies()
        pnpm = ensure_frontend_dependencies()
        if args.bootstrap_only:
            log("依赖准备完成。")
            return 0
        ensure_docker()
        prepare_databases(pnpm, skip_seed=args.skip_seed)
        serve(pnpm)
        return 0
    except DevStartupError as error:
        print(f"\n[dev:error] {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
