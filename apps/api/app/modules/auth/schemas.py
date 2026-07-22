from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=320)
    password: str = Field(min_length=8, max_length=256)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=32, max_length=512)


class UserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    student_no: str | None
    display_name: str
    roles: list[str]


class TokenPairResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserSummary


class MeResponse(BaseModel):
    user: UserSummary
