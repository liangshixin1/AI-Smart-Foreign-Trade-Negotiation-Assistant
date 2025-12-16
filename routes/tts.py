"""文本转语音（TTS）代理接口，调用 DashScope qwen3-tts-flash-realtime。"""

from __future__ import annotations

import base64
import io
import os
import threading
import wave
from typing import Optional

from flask import Blueprint, Response, jsonify, request

try:  # pragma: no cover - 运行时才有 dashscope
    import dashscope
    from dashscope.audio.qwen_tts_realtime import (
        AudioFormat,
        QwenTtsRealtime,
        QwenTtsRealtimeCallback,
    )
except Exception as exc:  # pragma: no cover
    dashscope = None  # type: ignore
    QwenTtsRealtime = None  # type: ignore
    QwenTtsRealtimeCallback = object  # type: ignore
    AudioFormat = None  # type: ignore
    print("[TTS] dashscope import failed:", exc)

bp = Blueprint("tts", __name__)


def _pcm16le_to_wav(pcm_bytes: bytes, sample_rate: int = 24000) -> bytes:
    """将 16bit PCM 数据包装为 WAV，便于浏览器播放。"""
    with io.BytesIO() as buf:
        with wave.open(buf, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(pcm_bytes)
        return buf.getvalue()


class _TtsCallback(QwenTtsRealtimeCallback):  # type: ignore[misc]
    """收集增量音频，等待完成事件。"""

    def __init__(self) -> None:
        self.buffer = bytearray()
        self.done = threading.Event()
        self.error: Optional[str] = None

    def on_event(self, response: dict) -> None:
        try:
            rtype = response.get("type")
            if rtype == "response.audio.delta":
                delta = response.get("delta")
                if delta:
                    self.buffer.extend(base64.b64decode(delta))
            elif rtype in {"response.done", "session.finished"}:
                self.done.set()
        except Exception as exc:  # pragma: no cover
            self.error = str(exc)
            self.done.set()

    def on_error(self, response: dict) -> None:  # pragma: no cover
        self.error = response.get("message") if isinstance(response, dict) else str(response)
        self.done.set()

    def on_close(self, close_status_code, close_msg) -> None:  # pragma: no cover
        if not self.done.is_set():
            self.done.set()


@bp.post("/api/tts/synthesize")
def synthesize_audio():
    """单句合成：收集完毕后一次性返回 WAV。"""
    if dashscope is None or QwenTtsRealtime is None:
        return jsonify({"error": "dashscope 未安装或导入失败"}), 500

    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        return jsonify({"error": "DASHSCOPE_API_KEY 未配置"}), 500

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    voice = (data.get("voice") or "Ryan").strip()  # 默认英文男声，官方支持：Cherry/Jennifer/Ryan/Aiden/Katerina 等
    if not text:
        return jsonify({"error": "text 为空"}), 400

    dashscope.api_key = api_key
    ws_url = os.getenv("DASHSCOPE_TTS_WS_URL", "wss://dashscope.aliyuncs.com/api-ws/v1/realtime")

    callback = _TtsCallback()
    synthesizer = QwenTtsRealtime(model="qwen3-tts-flash-realtime", callback=callback, url=ws_url)

    try:
        synthesizer.connect()
        synthesizer.update_session(
            voice=voice,
            response_format=AudioFormat.PCM_24000HZ_MONO_16BIT,
            mode="server_commit",
        )
        synthesizer.append_text(text)
        synthesizer.finish()
        callback.done.wait(timeout=15)
    except Exception as exc:  # pragma: no cover
        print("[TTS] synthesize error:", exc)
        return jsonify({"error": f"TTS 调用失败: {exc}"}), 500
    finally:
        try:
            synthesizer.close()  # type: ignore[attr-defined]
        except Exception:
            pass

    if callback.error:
        return jsonify({"error": callback.error}), 500

    pcm_bytes = bytes(callback.buffer)
    wav_bytes = _pcm16le_to_wav(pcm_bytes, sample_rate=24000)

    return Response(
        wav_bytes,
        mimetype="audio/wav",
        headers={"X-Content-Type-Options": "nosniff"},
    )
