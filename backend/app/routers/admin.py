import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Bus, Route, User
from ..schemas import BusCreate, BusOut, RouteCreate, RouteOut, UserCreate, UserOut
from ..security import hash_password, require_role

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_role("admin"))])
def route_out(route: Route):
    try:
        stops = json.loads(route.stops_json) if route.stops_json else []
    except Exception:
        stops = []
    return {"id": route.id, "name": route.name, "start_point": route.start_point, "end_point": route.end_point, "stops": stops}
@router.get("/routes", response_model=list[RouteOut])
def list_routes(db: Session = Depends(get_db)):
    return [route_out(r) for r in db.scalars(select(Route).order_by(Route.id)).all()]
@router.post("/routes", response_model=RouteOut, status_code=201)
def create_route(payload: RouteCreate, db: Session = Depends(get_db)):
    route = Route(name=payload.name, start_point=payload.start_point, end_point=payload.end_point, stops_json=json.dumps(payload.stops))
    db.add(route); db.commit(); db.refresh(route)
    return route_out(route)
@router.get("/buses", response_model=list[BusOut])
def list_buses(db: Session = Depends(get_db)):
    return db.scalars(select(Bus).order_by(Bus.bus_number)).all()
@router.post("/buses", response_model=BusOut, status_code=201)
def create_bus(payload: BusCreate, db: Session = Depends(get_db)):
    if payload.route_id is not None and not db.get(Route, payload.route_id): raise HTTPException(404, "Route not found")
    if db.scalar(select(Bus).where((Bus.bus_number == payload.bus_number) | (Bus.plate_number == payload.plate_number))): raise HTTPException(409, "Bus number or plate number already exists")
    bus = Bus(**payload.model_dump()); db.add(bus); db.commit(); db.refresh(bus)
    return bus
@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.scalars(select(User).where(User.role != "admin").order_by(User.id)).all()
@router.post("/users", response_model=UserOut, status_code=201)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == payload.email.lower())): raise HTTPException(409, "Email already registered")
    if payload.assigned_bus_id is not None and not db.get(Bus, payload.assigned_bus_id): raise HTTPException(404, "Assigned bus not found")
    user = User(email=payload.email.lower(), full_name=payload.full_name, password_hash=hash_password(payload.password), role=payload.role, assigned_bus_id=payload.assigned_bus_id)
    db.add(user); db.commit(); db.refresh(user)
    return user
