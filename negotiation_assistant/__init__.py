"""AI 外贸谈判助手应用内核。

该包只负责应用装配，不承载具体业务规则。业务接口仍位于 ``routes``，领域服务仍位于
``services``，从而让应用启动、业务逻辑和基础设施能够独立演进。
"""

from .application import create_app
from .config import AppSettings

__all__ = ["AppSettings", "create_app"]
