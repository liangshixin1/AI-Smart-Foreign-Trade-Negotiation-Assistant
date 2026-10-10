"""Private input validation; errors never print values."""

import sys
from pathlib import Path

from app.desktop.runtime import DemoCredential
from datetime import UTC, datetime

try:
    value = DemoCredential.model_validate_json(
        Path(sys.argv[1]).read_text(encoding="utf-8-sig")
    )
    if value.expires_at <= datetime.now(UTC):
        raise ValueError("Expired")
except Exception:
    print(
        "Credential validation failed: check three distinct keys, model, expiry and budget."
    )
    sys.exit(1)
print("Private credential structure validated; real connectivity is a separate check.")
