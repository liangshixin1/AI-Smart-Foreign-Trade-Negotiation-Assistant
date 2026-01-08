"""Simple embedding service with sentence-transformers (中文/多语种)."""

from __future__ import annotations

import os
import threading
from typing import Dict, List, Optional

import numpy as np

_models: Dict[str, object] = {}
_model_lock = threading.Lock()


def _get_model_name() -> str:
    # EMBEDDING_MODEL 为历史兼容；优先使用 EMBEDDING_MODEL_NAME
    return os.getenv("EMBEDDING_MODEL_NAME") or os.getenv("EMBEDDING_MODEL") or "BAAI/bge-m3"


def get_model(model_name: Optional[str] = None):
    """Lazy-load embedding 模型；加载失败返回 None。

    支持按 model_name 缓存多套模型，避免不同业务互相干扰。
    """

    name = (model_name or _get_model_name() or "").strip()
    if not name:
        return None
    cached = _models.get(name)
    if cached is not None:
        return cached
    with _model_lock:
        cached = _models.get(name)
        if cached is not None:
            return cached
        try:
            from sentence_transformers import SentenceTransformer
        except Exception:
            return None
        model = None
        try:
            cache_dir = (os.getenv("EMBEDDING_CACHE_DIR") or "").strip() or None
            kwargs = {"cache_folder": cache_dir} if cache_dir else {}
            # 部分社区模型（如 BGE-M3）需要 trust_remote_code；在旧版本 sentence-transformers 中该参数可能不存在。
            try:
                model = SentenceTransformer(name, trust_remote_code=True, **kwargs)
            except TypeError:
                try:
                    model = SentenceTransformer(name, **kwargs)
                except TypeError:
                    model = SentenceTransformer(name)
        except Exception:
            model = None
        if model is None:
            return None
        _models[name] = model
        return model


def embed_texts(texts: List[str], *, model_name: Optional[str] = None) -> List[List[float]]:
    """Embed 多个文本，返回归一化向量列表；若模型不可用则返回空列表。"""

    model = get_model(model_name=model_name)
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
