#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

log() {
  printf '[bootstrap] %s\n' "$1"
}

die() {
  printf '[bootstrap:error] %s\n' "$1" >&2
  exit 1
}

install_macos_formula() {
  local formula="$1"
  command -v brew >/dev/null 2>&1 ||
    die "缺少 Homebrew，先从 https://brew.sh 安装后重新运行本脚本。"
  log "安装系统工具：${formula}"
  brew install "${formula}"
}

ensure_macos_tools() {
  command -v python3 >/dev/null 2>&1 || install_macos_formula "python@3.12"
  command -v node >/dev/null 2>&1 || install_macos_formula "node"
  command -v pnpm >/dev/null 2>&1 || install_macos_formula "pnpm"
  command -v docker >/dev/null 2>&1 || install_macos_formula "docker"

  if ! docker compose version >/dev/null 2>&1 &&
    ! command -v docker-compose >/dev/null 2>&1; then
    install_macos_formula "docker-compose"
  fi

  if ! docker info >/dev/null 2>&1; then
    command -v colima >/dev/null 2>&1 || install_macos_formula "colima"
  fi
}

ensure_linux_tools() {
  local missing=()
  for command_name in python3 node pnpm docker; do
    command -v "${command_name}" >/dev/null 2>&1 || missing+=("${command_name}")
  done

  if ((${#missing[@]} > 0)); then
    die "Linux 缺少：${missing[*]}。请安装 Python 3.12+、Node.js 20+、pnpm 11+ 和 Docker 后重试。"
  fi
  if ! docker compose version >/dev/null 2>&1 &&
    ! command -v docker-compose >/dev/null 2>&1; then
    die "Linux 缺少 Docker Compose v2 或 docker-compose。"
  fi
}

case "$(uname -s)" in
Darwin)
  ensure_macos_tools
  ;;
Linux)
  ensure_linux_tools
  ;;
*)
  die "此脚本支持 macOS/Linux；Windows请运行 scripts\\start-dev.cmd。"
  ;;
esac

exec python3 scripts/dev.py "$@"
