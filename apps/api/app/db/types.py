# [导读] 用途: 提供模型默认时间所用的 UTC 时钟函数。
# [导读] 为什么: 统一使用带时区的时间, 避免服务部署在不同时区后记录含义改变。
# [导读] 结构: utc_now。
# [导读] 提醒: SQLite 读回的时间可能没有时区信息, 比较前需沿现有业务方法归一化。
from datetime import UTC, datetime


def utc_now() -> datetime:
    return datetime.now(UTC)
