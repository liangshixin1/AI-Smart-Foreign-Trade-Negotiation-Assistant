"""语音识别（ASR）代理接口，调用 DashScope 实时转写。"""

from __future__ import annotations

import math
import os
import tempfile
import json
from typing import Dict, List

from flask import Blueprint, jsonify, request

import dashscope
from dashscope.audio.asr import Recognition, RecognitionCallback, RecognitionResult
from flask_sock import Sock

bp = Blueprint("asr", __name__)
sock = Sock()


def _chunk_bytes(data: bytes, chunk_size: int = 3200) -> List[bytes]:
    return [data[i : i + chunk_size] for i in range(0, len(data), chunk_size)]


class _CollectingCallback(RecognitionCallback):
    """收集转写结果并存储到列表。"""

    def __init__(self) -> None:
        self.sentences: List[str] = []
        self.error: str = ""

    def on_open(self) -> None:
        # 不做麦克风初始化，使用上传的音频流
        return

    def on_close(self) -> None:
        return

    def on_complete(self) -> None:
        return

    def on_error(self, message) -> None:
        self.error = getattr(message, "message", "Unknown error")

    def on_event(self, result: RecognitionResult) -> None:
        sentence: Dict[str, object] = result.get_sentence()
        text = sentence.get("text")
        if text:
            self.sentences.append(str(text))


@bp.post("/api/asr/transcribe")
def transcribe_audio():
    """接收前端上传的音频（单段），调用 DashScope 实时 ASR 返回文本。"""
    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        return jsonify({"error": "DASHSCOPE_API_KEY 未配置"}), 500

    if "audio" not in request.files:
        return jsonify({"error": "缺少音频文件字段 audio"}), 400

    file = request.files["audio"]
    fmt = (request.form.get("format") or "opus").strip().lower()
    sample_rate = int(request.form.get("sampleRate") or 16000)

    # 读取音频数据
    data = file.read()
    if not data:
        return jsonify({"error": "音频内容为空"}), 400

    dashscope.api_key = api_key
    dashscope.base_websocket_api_url = "wss://dashscope.aliyuncs.com/api-ws/v1/inference"

    callback = _CollectingCallback()
    recognition = Recognition(
        model="fun-asr-realtime",
        format=fmt,
        sample_rate=sample_rate,
        semantic_punctuation_enabled=True,
        callback=callback,
    )

    try:
        recognition.start()
        print(
            "[ASR] start",
            {
                "size": len(data),
                "format": fmt,
                "sample_rate": sample_rate,
                "blocks": math.ceil(len(data) / 3200),
            },
        )
        for chunk in _chunk_bytes(data):
            recognition.send_audio_frame(chunk)
        recognition.stop()
    except Exception as exc:  # pragma: no cover - 外部服务异常直接返回错误
        print("[ASR] exception", exc)
        return jsonify({"error": f"ASR 调用失败: {exc}"}), 500

    if callback.error:
        print("[ASR] callback error", callback.error)
        return jsonify({"error": callback.error}), 500

    text = " ".join(callback.sentences).strip()
    print("[ASR] sentences", callback.sentences, "final_text", text)
    return jsonify({"text": text, "sentences": callback.sentences})


class _StreamingCallback(RecognitionCallback):
    """流式回调：将增量结果推回前端 websocket。"""

    def __init__(self, ws) -> None:
        self.ws = ws

    def on_open(self) -> None:
        self.ws.send(json.dumps({"event": "asr_open"}))

    def on_event(self, result: RecognitionResult) -> None:
        sentence: Dict[str, object] = result.get_sentence()
        payload = {
            "event": "asr_partial",
            "text": sentence.get("text"),
            "isEnd": RecognitionResult.is_sentence_end(sentence),
            "requestId": result.get_request_id(),
        }
        try:
            self.ws.send(json.dumps(payload))
        except Exception:
            pass

    def on_complete(self) -> None:
        try:
            self.ws.send(json.dumps({"event": "asr_complete"}))
        except Exception:
            pass

    def on_error(self, message) -> None:
        try:
            self.ws.send(json.dumps({"event": "asr_error", "error": getattr(message, 'message', 'unknown')}))
        except Exception:
            pass

    def on_close(self) -> None:
        try:
            self.ws.send(json.dumps({"event": "asr_close"}))
        except Exception:
            pass


@sock.route("/api/asr/stream")
def asr_stream(ws):
    """WebSocket 流式识别：前端发送 PCM 16k 音频帧，实时返回增量文本。"""
    try:
        ws.send(json.dumps({"event": "asr_log", "message": "WS connected"}))
    except Exception:
        pass
    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        ws.send(json.dumps({"event": "asr_error", "error": "DASHSCOPE_API_KEY 未配置"}))
        ws.close()
        return
    dashscope.api_key = api_key
    dashscope.base_websocket_api_url = os.getenv(
        "DASHSCOPE_WS_URL", "wss://dashscope.aliyuncs.com/api-ws/v1/inference"
    )

    callback = _StreamingCallback(ws)
    recognition = Recognition(
        model="fun-asr-realtime",
        format="pcm",
        sample_rate=16000,
        semantic_punctuation_enabled=False,
        callback=callback,
    )

    try:
        recognition.start()
        ws.send(json.dumps({"event": "asr_log", "message": "recognition started"}))
        while True:
            frame = ws.receive()
            if frame is None:
                break
            if isinstance(frame, str) and frame.strip().upper() == "__STOP__":
                break
            if isinstance(frame, (bytes, bytearray)):
                try:
                    ws.send(json.dumps({"event": "asr_log", "message": f"recv {len(frame)} bytes"}))
                except Exception:
                    pass
                recognition.send_audio_frame(frame)
            else:
                try:
                    ws.send(
                        json.dumps(
                            {
                                "event": "asr_log",
                                "message": f"unexpected frame type {type(frame)}",
                            }
                        )
                    )
                except Exception:
                    pass
        recognition.stop()
    except Exception as exc:  # pragma: no cover
        try:
            ws.send(json.dumps({"event": "asr_error", "error": str(exc)}))
        except Exception:
            pass
    finally:
        try:
            ws.close()
        except Exception:
            pass
