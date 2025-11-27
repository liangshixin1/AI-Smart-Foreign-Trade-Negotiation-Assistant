"""Lightweight chunking and embedding-like scoring for RAG matching (MVP)."""

from __future__ import annotations

import math
import re
from collections import Counter
from typing import Dict, List, Optional, Tuple

from services import embedding_service


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip().lower()


def chunk_text(text: str, max_len: int = 420) -> List[str]:
    """Naive chunking by sentence; fallback to fixed-size slices."""
    normalized = text or ""
    sentences = re.split(r"(?<=[。！!？?;；])", normalized)
    chunks: List[str] = []
    buf = ""
    for sent in sentences:
        if len(buf) + len(sent) <= max_len:
            buf += sent
        else:
            if buf:
                chunks.append(buf.strip())
            buf = sent
    if buf:
        chunks.append(buf.strip())
    if not chunks:
        # fallback fixed slicing
        for i in range(0, len(normalized), max_len):
            chunks.append(normalized[i : i + max_len])
    return [c for c in chunks if c]


def _embed(text: str) -> Counter:
    tokens = re.findall(r"[\\w\\u4e00-\\u9fa5]+", _normalize(text))
    return Counter(tokens)


def _cosine(a: Counter, b: Counter) -> float:
    if not a or not b:
        return 0.0
    inter = set(a.keys()) & set(b.keys())
    dot = sum(a[t] * b[t] for t in inter)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb) if na and nb else 0.0


def _cosine_dense(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


def rank_chunks(selection: str, chunks: List[Dict[str, object]], top_k: int = 5) -> List[Tuple[Dict[str, object], float]]:
    query_vec = _embed(selection)
    scored: List[Tuple[Dict[str, object], float]] = []
    for ch in chunks:
        vec = _embed(ch.get("text") or "")
        score = _cosine(query_vec, vec)
        scored.append((ch, score))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_k]


def match(selection_text: str, knowledge_cards: List[Dict[str, object]]) -> Tuple[Dict[str, object], float, List[Dict[str, object]]]:
    # 优先尝试真实向量（sentence-transformers），失败则退回 ngram chunk 逻辑
    try:
        selection_vecs = embedding_service.embed_texts([selection_text])
        selection_vec = selection_vecs[0] if selection_vecs else None
        if selection_vec:
            texts = []
            for card in knowledge_cards:
                combined = " ".join(
                    filter(
                        None,
                        [
                            card.get("name"),
                            card.get("summary"),
                            card.get("bodyHtml"),
                            card.get("content"),
                        ],
                    )
                )
                texts.append(combined)
            candidate_vecs = embedding_service.embed_texts(texts)
            if candidate_vecs:
                scored_pairs = []
                for card, vec in zip(knowledge_cards, candidate_vecs):
                    score = _cosine_dense(selection_vec, vec)
                    scored_pairs.append((card, score))
                scored_pairs.sort(key=lambda x: x[1], reverse=True)
                top = scored_pairs[:6]
                best = top[0][0] if top else {}
                confidence = top[0][1] if top else 0.0
                context = [
                    {
                        "name": card.get("name"),
                        "score": score,
                        "text": (card.get("summary") or card.get("bodyHtml") or card.get("content") or "")[:260],
                    }
                    for card, score in top
                ]
                if best:
                    return best, float(confidence), context
    except Exception:
        # silent fallback to ngram matching
        pass

    chunks: List[Dict[str, object]] = []
    for card in knowledge_cards:
        body = card.get("bodyHtml") or card.get("content") or card.get("summary") or ""
        for idx, ch in enumerate(chunk_text(body)):
            chunks.append({"text": ch, "name": card.get("name", ""), "chunkIndex": idx})
    top_chunks = rank_chunks(selection_text, chunks, top_k=6)
    # aggregate scores per knowledge point
    agg: Dict[str, float] = {}
    for ch, score in top_chunks:
        name = ch.get("name") or ""
        agg[name] = max(agg.get(name, 0.0), score)
    best_name = max(agg, key=agg.get) if agg else ""
    match_card = next((c for c in knowledge_cards if c.get("name") == best_name), None) if best_name else None
    context = [{"text": ch.get("text"), "name": ch.get("name"), "chunkIndex": ch.get("chunkIndex"), "score": s} for ch, s in top_chunks]
    confidence = agg.get(best_name, 0.0) if best_name else 0.0
    return match_card or {}, confidence, context
