import os
from flask import Flask, request, Response, send_from_directory
from openai import OpenAI

DEEPSEEK_BASE = "https://api.deepseek.com"
MODEL = "deepseek-chat"

app = Flask(__name__, static_folder="static")


def stream_chat(api_key: str, system_prompt: str, user_prompt: str):
    client = OpenAI(api_key=api_key, base_url=DEEPSEEK_BASE)
    stream = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        stream=True,
    )

    for chunk in stream:
        delta = ""
        if chunk.choices:
            delta = getattr(chunk.choices[0].delta, "content", "") or ""
        if delta:
            yield delta


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.post("/api/collab_stream")
def collab_stream():
    body = request.get_json(force=True)
    sys_prompt = body.get("system", "")
    user_prompt = body.get("user", "")
    key = os.getenv("DEEPSEEK_COLLAB_KEY")
    if not key:
        return {"error": "Missing DEEPSEEK_COLLAB_KEY"}, 500
    return Response(stream_chat(key, sys_prompt, user_prompt), mimetype="text/plain")


@app.post("/api/critique_stream")
def critique_stream():
    body = request.get_json(force=True)
    sys_prompt = body.get("system", "")
    user_prompt = body.get("user", "")
    key = os.getenv("DEEPSEEK_CRITIC_KEY")
    if not key:
        return {"error": "Missing DEEPSEEK_CRITIC_KEY"}, 500
    return Response(stream_chat(key, sys_prompt, user_prompt), mimetype="text/plain")


if __name__ == "__main__":
    app.run(debug=True)
