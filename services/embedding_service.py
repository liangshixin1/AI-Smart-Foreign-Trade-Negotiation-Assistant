"""Simple embedding service with sentence-transformers (中文/多语种)."""

from __future__ import annotations

import os
import threading
from typing import List, Optional

import numpy as np

_model = None
_model_lock = threading.Lock()


def _get_model_name() -> str:
    return os.getenv("EMBEDDING_MODEL_NAME") or "paraphrase-multilingual-MiniLM-L12-v2"


def get_model():
    """Lazy-load embedding模型；加载失败返回 None。"""

    global _model
    if _model is not None:
        return _model
    with _model_lock:
        if _model is not None:
            return _model
        try:
            from sentence_transformers import SentenceTransformer
        except Exception:
            return None
        try:
            _model = SentenceTransformer(_get_model_name())
        except Exception:
            _model = None
        return _model


def embed_texts(texts: List[str]) -> List[List[float]]:
    """Embed 多个文本，返回归一化向量列表；若模型不可用则返回空列表。"""

    model = get_model()
    if model is None or not texts:
        return []
    try:
        vectors = model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
        # 清洗 nan/inf，避免后续向量运算异常
        vectors = np.nan_to_num(vectors, nan=0.0, posinf=0.0, neginf=0.0)
        # sentence-transformers 返回 ndarray；统一转 python list 方便序列化
        return vectors.tolist()
    except Exception:
        return []
