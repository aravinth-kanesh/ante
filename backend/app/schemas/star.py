from datetime import datetime

from pydantic import BaseModel, Field

_LONG = 4000


class StarStoryRead(BaseModel):
    id: int
    title: str
    situation: str
    task: str
    action: str
    result: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class StarStoryWrite(BaseModel):
    title: str = Field("", max_length=200)
    situation: str = Field("", max_length=_LONG)
    task: str = Field("", max_length=_LONG)
    action: str = Field("", max_length=_LONG)
    result: str = Field("", max_length=_LONG)
