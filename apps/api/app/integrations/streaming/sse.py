import json


def sse_event(event: str, data: dict[str, object]) -> str:
    payload = {"event_version": 1, **data}
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False, default=str)}\n\n"
