# [导读] 用途: 提供密码散列、密码核验、随机令牌和令牌摘要。
# [导读] 为什么: 密码用带随机盐的 scrypt; 令牌用服务端 pepper 计算摘要, 使数据库无需保存可直接使
# [导读] 用的明文凭据。
# [导读] 结构: hash_password、verify_password、new_token、hash_token。
# [导读] 提醒: pepper 是服务端持有的额外秘密; 更换它会使旧令牌无法匹配。校验摘要使用恒定时间比较
# [导读] , 避免普通字符串比较的时序差异。
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets

SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1


# [导读] 每次生成随机盐并保存算法参数; 相同密码不应形成可直接横向比对的同一摘要。
def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P)
    salt_text = base64.urlsafe_b64encode(salt).decode()
    digest_text = base64.urlsafe_b64encode(digest).decode()
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt_text}${digest_text}"


# [导读] 按保存的参数重算摘要, 用恒定时间比较; 编码损坏按校验失败处理。
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


# [导读] 用服务端 pepper 对令牌做 HMAC 摘要; 数据库泄漏摘要不能直接当 Bearer 令牌使用。
def hash_token(token: str, pepper: str) -> str:
    return hmac.new(pepper.encode(), token.encode(), hashlib.sha256).hexdigest()
