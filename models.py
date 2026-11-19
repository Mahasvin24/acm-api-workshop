from pydantic import BaseModel, Field


class Registration(BaseModel):
    name: str = Field(min_length=1)
    creator: str = Field(min_length=1)
    description: str = Field(min_length=1)
    ip: str = Field(min_length=1)
    port: int = Field(strict=True, ge=1024, le=65535)
