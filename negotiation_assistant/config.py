"""集中管理应用配置，避免业务模块到处直接读取环境变量。"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Optional


PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _as_bool(value: Optional[str], default: bool = False) -> bool:
    """将常见环境变量写法转换为布尔值。"""
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class AppSettings:
    """应用运行配置。

    使用不可变数据类可以避免运行过程中被意外修改；测试也能直接构造配置，而不必污染
    全局环境变量。后续接入配置中心时，只需替换本模块，无需修改路由和业务服务。
    """

    environment: str = "development"
    debug: bool = False
    testing: bool = False
    secret_key: str = "development-only-change-me"
    max_content_length: int = 16 * 1024 * 1024
    modern_frontend_dir: Path = PROJECT_ROOT / "static/modern"

    @classmethod
    def from_env(cls, environ: Optional[Mapping[str, str]] = None) -> "AppSettings":
        """从环境变量创建配置，并为格式错误的数值提供明确异常。"""
        source = environ if environ is not None else os.environ
        max_content_length = int(source.get("MAX_CONTENT_LENGTH", 16 * 1024 * 1024))
        return cls(
            environment=source.get("APP_ENV", source.get("FLASK_ENV", "development")),
            debug=_as_bool(source.get("DEBUG", source.get("FLASK_DEBUG"))),
            testing=_as_bool(source.get("TESTING")),
            secret_key=source.get("SECRET_KEY", "development-only-change-me"),
            max_content_length=max_content_length,
            modern_frontend_dir=Path(
                source.get("MODERN_FRONTEND_DIR", str(PROJECT_ROOT / "static/modern"))
            ),
        )

    def flask_config(self) -> dict[str, object]:
        """只暴露 Flask 需要的配置，保持外部配置与框架细节解耦。"""
        return {
            "ENV": self.environment,
            "DEBUG": self.debug,
            "TESTING": self.testing,
            "SECRET_KEY": self.secret_key,
            "MAX_CONTENT_LENGTH": self.max_content_length,
            "MODERN_FRONTEND_DIR": str(self.modern_frontend_dir),
        }
