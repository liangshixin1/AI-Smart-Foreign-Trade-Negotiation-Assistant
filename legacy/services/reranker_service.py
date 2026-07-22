"""Optional reranker service with sentence-transformers CrossEncoder."""

from __future__ import annotations

import os
import threading
from typing import Dict, List, Optional, Sequence, Tuple

_models: Dict[str, object] = {}
_lock = threading.Lock()


def _get_model_name() -> str:
    return os.getenv("RERANKER_MODEL_NAME") or "BAAI/bge-reranker-v2-m3"


def get_model(model_name: Optional[str] = None):
    """Lazy-load reranker 模型；加载失败返回 None。"""

    name = (model_name or _get_model_name() or "").strip()
    if not name:
        return None
    cached = _models.get(name)
    if cached is not None:
        return cached
    with _lock:
        cached = _models.get(name)
        if cached is not None:
            return cached
        try:
            from sentence_transformers import CrossEncoder
        except Exception:
            return None
        model = None
        try:
            try:
                model = CrossEncoder(name, trust_remote_code=True)
            except TypeError:
                model = CrossEncoder(name)
        except Exception:
            model = None
        if model is None:
            return None
        _models[name] = model
        return model


def rerank(query: str, docs: Sequence[str], *, model_name: Optional[str] = None) -> List[float]:
    """Return reranker scores aligned with docs; best-effort (errors => [])."""

    if not query or not docs:
        return []
    model = get_model(model_name=model_name)
    if model is None:
        return []
    pairs: List[Tuple[str, str]] = [(query, d or "") for d in docs]
    try:
        scores = model.predict(pairs)
        if scores is None:
            return []
        return [float(s) for s in scores]
    except Exception:
        return []
