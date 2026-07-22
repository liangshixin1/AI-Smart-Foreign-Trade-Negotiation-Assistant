from __future__ import annotations

import base64
import hashlib
import hmac
import secrets

SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P)
    salt_text = base64.urlsafe_b64encode(salt).decode()
    digest_text = base64.urlsafe_b64encode(digest).decode()
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt_text}${digest_text}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, n, r, p, salt_text, digest_text = encoded.split("$", 5)
        if algorithm != "scrypt":
            return False
        salt = base64.urlsafe_b64decode(salt_text.encode())
        expected = base64.urlsafe_b64decode(digest_text.encode())
        actual = hashlib.scrypt(password.encode(), salt=salt, n=int(n), r=int(r), p=int(p))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def new_token() -> str:
    return secrets.token_urlsafe(48)


def hash_token(token: str, pepper: str) -> str:
    return hmac.new(pepper.encode(), token.encode(), hashlib.sha256).hexdigest()
