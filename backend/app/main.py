from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from .config import settings
from .database import Base, SessionLocal, engine
from .models import User
from .security import hash_password
from .routers import auth, admin, tracking

@asynccontextmanager
async def lifespan(app: FastAPI):
    if len(settings.jwt_secret_key) < 32:
        raise RuntimeError("JWT_SECRET_KEY must be set to a random secret of at least 32 characters")
    if settings.bootstrap_admin_password and len(settings.bootstrap_admin_password) < 12:
        raise RuntimeError("BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters")
    Base.metadata.create_all(bind=engine)
    if settings.bootstrap_admin_email and settings.bootstrap_admin_password:
        with SessionLocal() as db:
            existing = db.scalar(select(User).where(User.role == "admin"))
            if not existing:
                db.add(User(email=settings.bootstrap_admin_email.lower(), full_name="School Administrator", password_hash=hash_password(settings.bootstrap_admin_password), role="admin"))
                db.commit()
    yield

app = FastAPI(title="School Bus Tracker API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True, allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allow_headers=["Authorization", "Content-Type"])
app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(tracking.router, prefix="/api")
@app.get("/health", tags=["operations"])
def health(): return {"status": "ok"}
