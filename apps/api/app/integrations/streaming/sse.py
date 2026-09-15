# [导读] 用途: 将事件名称与数据编码成 SSE 文本帧。
# [导读] 为什么: SSE 是服务端向浏览器持续推送事件的 HTTP 格式; 统一编码保持事件名、JSON 数据和空
# [导读] 行边界一致。
# [导读] 结构: sse_event。
# [导读] 提醒: 流式连接已开始后, 业务失败通常要通过失败事件告知前端, 不能再依赖普通 HTTP 错误响
# [导读] 应。
import json


# [导读] 按 SSE 的事件名、data 和双换行编码; 前端按事件类型更新状态, 不能只拼接所有消息正文。
def sse_event(event: str, data: dict[str, object]) -> str:
    payload = {"event_version": 1, **data}
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False, default=str)}\n\n"
