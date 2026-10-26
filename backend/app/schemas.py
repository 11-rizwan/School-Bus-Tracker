from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field

Role = Literal["admin", "driver", "parent"]
class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=12, max_length=128)
    role: Literal["driver", "parent"]
    assigned_bus_id: int | None = None
class UserOut(BaseModel):
    id: int; email: EmailStr; full_name: str; role: Role; is_active: bool; assigned_bus_id: int | None
    model_config = ConfigDict(from_attributes=True)
class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
class RouteCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    start_point: str = Field(min_length=2, max_length=200)
    end_point: str = Field(min_length=2, max_length=200)
    stops: list[str] = Field(default_factory=list, max_length=100)
class RouteOut(BaseModel):
    id: int; name: str; start_point: str; end_point: str; stops: list[str]
    model_config = ConfigDict(from_attributes=True)
class BusCreate(BaseModel):
    bus_number: str = Field(min_length=1, max_length=30)
    plate_number: str = Field(min_length=4, max_length=30)
    capacity: int = Field(default=40, ge=1, le=100)
    route_id: int | None = None
class BusOut(BaseModel):
    id: int; bus_number: str; plate_number: str; capacity: int; route_id: int | None; is_active: bool
    model_config = ConfigDict(from_attributes=True)
class LocationIn(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    speed_kph: float = Field(default=0, ge=0, le=250)
class LocationOut(BaseModel):
    latitude: float; longitude: float; speed_kph: float; updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
class BusView(BaseModel):
    id: int; bus_number: str; plate_number: str; capacity: int; route_id: int | None
    route: RouteOut | None = None
    location: LocationOut | None = None
    model_config = ConfigDict(from_attributes=True)
