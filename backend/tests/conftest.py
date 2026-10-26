import os
os.environ["DATABASE_URL"] = "sqlite:///./test_schoolbus.db"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-that-is-long-enough-for-tests"
os.environ["BOOTSTRAP_ADMIN_EMAIL"] = "admin@example.com"
os.environ["BOOTSTRAP_ADMIN_PASSWORD"] = "AdminPassword123!"
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine
from app.models import User
from app.security import hash_password
from app.database import SessionLocal

@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine); Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        db.add(User(email="admin@example.com", full_name="Admin", password_hash=hash_password("AdminPassword123!"), role="admin"))
        db.commit()
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)
    

def token(client, email, password):
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]
@pytest.fixture
def admin_token(client): return token(client, "admin@example.com", "AdminPassword123!")
