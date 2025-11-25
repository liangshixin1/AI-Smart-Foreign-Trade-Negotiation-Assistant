"""In-memory storage for generated knowledge point drafts (MVP)."""

from __future__ import annotations

import uuid
from typing import Dict, List


_BATCHES: Dict[str, List[Dict[str, object]]] = {}


def create_batch(drafts: List[Dict[str, object]]) -> str:
    batch_id = str(uuid.uuid4())
    _BATCHES[batch_id] = drafts
    return batch_id


def get_batch(batch_id: str) -> List[Dict[str, object]]:
    return _BATCHES.get(batch_id, [])


def approve(batch_id: str, ids: List[str]) -> List[Dict[str, object]]:
    drafts = _BATCHES.get(batch_id, [])
    approved = [d for d in drafts if str(d.get("id")) in {str(i) for i in ids}]
    return approved
