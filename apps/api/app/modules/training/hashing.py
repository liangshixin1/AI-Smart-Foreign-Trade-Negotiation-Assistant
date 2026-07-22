import hashlib
import json


def stable_hash(payload: object) -> str:
    value = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(value.encode()).hexdigest()
