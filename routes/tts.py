"""文本转语音（TTS）代理接口，调用 DashScope CosyVoice 流式合成。"""

from __future__ import annotations

import os
from typing import Iterator

from flask import Blueprint, Response, jsonify, request, stream_with_context

import dashscope
from dashscope.audio.tts import SpeechSynthesizer

bp = Blueprint("tts", __name__)


def _synthesize_stream(text: str) -> Iterator[bytes]:
    """将文本转换为音频二进制流，按需推送给客户端。"""
    synthesizer = SpeechSynthesizer()
    try:
        audio = synthesizer.call(
            text,
            model="cosyvoice-v1",
            voice="longxiaochun",
            format="mp3",
        )
        if isinstance(audio, (bytes, bytearray)):
            yield audio
        elif hasattr(audio, "data"):
            # 部分 SDK 版本返回对象，尝试取 data/audio 字段
            data = getattr(audio, "data", None) or getattr(audio, "output", None)
            if isinstance(data, (bytes, bytearray)):
                yield data
            elif isinstance(data, dict):
                # 可能返回 base64，前端暂不处理；直接忽略
                pass
        else:
            # 兜底：直接将字符串化内容返回
            yield str(audio).encode("utf-8")
    except Exception as exc:  # pragma: no cover - 外部服务异常
        print("[TTS] synthesize error:", exc)
        yield b""


@bp.post("/api/tts/synthesize")
def synthesize_audio():
    """流式返回合成的 MP3 音频字节。"""
    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        return jsonify({"error": "DASHSCOPE_API_KEY 未配置"}), 500

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "text 为空"}), 400

    dashscope.api_key = api_key
    dashscope.base_websocket_api_url = os.getenv(
        "DASHSCOPE_WS_URL", "wss://dashscope.aliyuncs.com/api-ws/v1/inference"
    )

    return Response(
        stream_with_context(_synthesize_stream(text)),
        mimetype="audio/mpeg",
        headers={"X-Content-Type-Options": "nosniff"},
    )
