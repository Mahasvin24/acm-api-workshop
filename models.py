import ipaddress
import re

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Registration(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=3, max_length=48)
    creator: str = Field(min_length=2, max_length=48)
    description: str = Field(min_length=10, max_length=160)
    ip: str
    port: int = Field(strict=True, ge=1024, le=65535)

    @field_validator("name", "creator", "description", mode="before")
    @classmethod
    def plain_text(cls, value):
        if isinstance(value, str):
            if re.search(r"[\x00-\x1f\x7f<>]", value):
                raise ValueError("Use a single line of plain text, without HTML.")
            return value.strip()
        return value

    @field_validator("ip")
    @classmethod
    def wifi_address(cls, value):
        try:
            address = ipaddress.IPv4Address(value)
        except ipaddress.AddressValueError:
            raise ValueError("Use an IPv4 address without http:// or a port.")
        a, b, *_ = address.packed
        if a in (0, 127) or a >= 224 or (a == 169 and b == 254):
            raise ValueError("Use your reachable Wi-Fi IPv4 address.")
        return value


class RegistrationUpdate(Registration):
    name: str | None = Field(default=None, min_length=3, max_length=48)
    creator: str | None = Field(default=None, min_length=2, max_length=48)
    description: str | None = Field(default=None, min_length=10, max_length=160)
    ip: str | None = None
    port: int | None = Field(default=None, strict=True, ge=1024, le=65535)

    @model_validator(mode="before")
    @classmethod
    def nonempty_update(cls, value):
        if isinstance(value, dict) and (not value or any(v is None for v in value.values())):
            raise ValueError("Include at least one field to update; fields cannot be null.")
        return value


class PublicRegistration(Registration):
    id: str
    created_at: str


class RegistrationCreated(PublicRegistration):
    edit_token: str
    message: str
