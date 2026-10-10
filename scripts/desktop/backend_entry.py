"""Pipe-only launch configuration; stdout emits only non-secret readiness information."""

from __future__ import annotations

import json
import socket
import sys
import threading
from pathlib import Path

import uvicorn

from app.desktop.runtime import DemoCredential, PublicCredential
from app.desktop.server import desktop_app


def main() -> None:
    launch = json.loads(sys.stdin.readline())
    credential = (
        (
            PublicCredential if launch.get("public_edition") else DemoCredential
        ).model_validate(launch["credential"])
        if launch.get("credential")
        else None
    )
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
        origin = f"http://127.0.0.1:{port}"
        application = desktop_app(
            Path(launch["data_dir"]),
            launch["token"],
            origin,
            credential,
            public_edition=bool(launch.get("public_edition")),
        )
        server = uvicorn.Server(
            uvicorn.Config(application, log_level="warning", access_log=False)
        )

        def parent_closed() -> None:
            sys.stdin.read()
            server.should_exit = True

        threading.Thread(target=parent_closed, daemon=True).start()
        print(json.dumps({"origin": origin, "event": "ready"}), flush=True)
        server.run(sockets=[listener])


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # ValidationError text can contain the supplied credentials. Never print it.
        print(
            json.dumps({"event": "failed", "category": type(error).__name__}),
            flush=True,
        )
        sys.exit(1)
