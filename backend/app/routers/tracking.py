from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload
from ..database import get_db
from ..models import Bus, BusLocation, Route, User
from ..schemas import BusView, LocationIn, LocationOut, RouteOut
from ..security import get_current_user, require_role

router = APIRouter(tags=["tracking"])
def route_payload(route):
    if not route: return None
    import json
    try:
        stops = json.loads(route.stops_json) if route.stops_json else []
    except Exception:
        stops = []
    return {"id": route.id, "name": route.name, "start_point": route.start_point, "end_point": route.end_point, "stops": stops}
def view_bus(bus: Bus):
    loc = bus.locations[0] if bus.locations else None
    return {"id": bus.id, "bus_number": bus.bus_number, "plate_number": bus.plate_number, "capacity": bus.capacity, "route_id": bus.route_id,
            "route": route_payload(bus.route), "location": ({"latitude": loc.latitude, "longitude": loc.longitude, "speed_kph": loc.speed_kph, "updated_at": loc.updated_at} if loc else None)}
@router.get("/tracking/buses", response_model=list[BusView])
def visible_buses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role == "admin":
        buses = db.scalars(select(Bus).options(joinedload(Bus.route), joinedload(Bus.locations)).order_by(Bus.bus_number)).unique().all()
    else:
        if user.assigned_bus_id is None: return []
        bus = db.scalars(select(Bus).where(Bus.id == user.assigned_bus_id).options(joinedload(Bus.route), joinedload(Bus.locations))).unique().first()
        buses = [bus] if bus else []
    return [view_bus(bus) for bus in buses if bus.is_active]
@router.put("/driver/location", response_model=LocationOut)
def update_location(payload: LocationIn, user: User = Depends(require_role("driver")), db: Session = Depends(get_db)):
    if user.assigned_bus_id is None: raise HTTPException(403, "No bus is assigned to this driver")
    bus = db.get(Bus, user.assigned_bus_id)
    if not bus or not bus.is_active: raise HTTPException(403, "Assigned bus is unavailable")
    location = db.scalar(select(BusLocation).where(BusLocation.bus_id == bus.id))
    if location is None:
        location = BusLocation(bus_id=bus.id, latitude=payload.latitude, longitude=payload.longitude, speed_kph=payload.speed_kph)
        db.add(location)
    else:
        location.latitude = payload.latitude; location.longitude = payload.longitude; location.speed_kph = payload.speed_kph; location.updated_at = datetime.now(timezone.utc)
    db.commit(); db.refresh(location)
    return location
