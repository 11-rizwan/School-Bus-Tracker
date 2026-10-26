from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

def utcnow():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    assigned_bus_id: Mapped[int | None] = mapped_column(ForeignKey("buses.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    assigned_bus: Mapped["Bus | None"] = relationship("Bus", foreign_keys=[assigned_bus_id])

class Route(Base):
    __tablename__ = "routes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    start_point: Mapped[str] = mapped_column(String(200), nullable=False)
    end_point: Mapped[str] = mapped_column(String(200), nullable=False)
    stops_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    buses: Mapped[list["Bus"]] = relationship(back_populates="route")

class Bus(Base):
    __tablename__ = "buses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bus_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    plate_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, default=40, nullable=False)
    route_id: Mapped[int | None] = mapped_column(ForeignKey("routes.id", ondelete="SET NULL"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    route: Mapped["Route | None"] = relationship(back_populates="buses")
    locations: Mapped[list["BusLocation"]] = relationship(back_populates="bus", cascade="all, delete-orphan")

class BusLocation(Base):
    __tablename__ = "bus_locations"
    __table_args__ = (UniqueConstraint("bus_id", name="uq_location_per_bus"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bus_id: Mapped[int] = mapped_column(ForeignKey("buses.id", ondelete="CASCADE"), nullable=False, index=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    speed_kph: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
    bus: Mapped["Bus"] = relationship(back_populates="locations")
