from enum import StrEnum
from pydantic import BaseModel, ConfigDict, Field

class TargetType(StrEnum):
    newborn = 'newborn'
    toddler = 'toddler'
    elderly = 'elderly'
    wheelchair = 'wheelchair'
    limited_mobility = 'limited_mobility'

class SpaceType(StrEnum):
    living_room = 'living_room'
    bedroom = 'bedroom'
    kitchen = 'kitchen'
    bathroom = 'bathroom'
    entrance = 'entrance'
    hallway = 'hallway'
    stairs = 'stairs'

class TargetCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=80)
    target_type: TargetType
    age: int | None = Field(default=None, ge=0, le=130)
    memo: str = Field(default='', max_length=1000)

class SpaceCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=80)
    space_type: SpaceType

class CompareRequest(BaseModel):
    previous_scan_id: int = Field(gt=0)

class ResolutionRequest(BaseModel):
    resolved: bool

from typing import Literal

class FieldCheckItem(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    key: str = Field(min_length=1, max_length=60)
    status: Literal['risk', 'clear', 'unknown']
    note: str = Field(default='', max_length=300)

class FieldChecksRequest(BaseModel):
    items: list[FieldCheckItem] = Field(max_length=50)

class GuideTaskRequest(BaseModel):
    key: str = Field(min_length=1, max_length=120)
    completed: bool
