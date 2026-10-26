# School Bus Tracker

A role-based school transport tracking starter built with React + Vite, FastAPI, SQLAlchemy 2, and PostgreSQL. It includes an admin dashboard, driver location updates, parent-scoped live tracking, route/bus/driver management, tests, and Docker Compose.

> **Production note:** This is a deployable MVP foundation, not a substitute for a security review or a real GPS-device integration. Driver location is submitted by the authenticated driver client; production deployments should use HTTPS, managed secrets, backups, monitoring, rate limits, and a trusted GPS source. WebSocket/SSE can replace polling as scale requires.

## Roles and access
- **Admin:** manage routes, buses, driver accounts and parent accounts; view all buses and locations.
- **Driver:** sign in and update location only for the bus assigned to their account.
- **Parent:** view only the bus assigned to their account and its route. The API enforces this boundary; hiding UI elements is not the security control.

## Quick start
1. Copy `.env.example` to `.env` and change every secret/password.
2. Run `docker compose up --build`.
3. Frontend: http://localhost:8080
4. API docs: http://localhost:8000/docs
5. First admin is created from `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` on startup if no admin exists.

Demo flow: sign in as admin, create a route and bus, create a driver and parent, assign the bus to the driver and parent, then sign in as the driver to post coordinates. Parent accounts can only see their assigned bus.

## Local development
Backend:
```bash
cd backend
python -m venv .venv
# activate the venv, then:
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Frontend:
```bash
cd frontend
npm install
npm run dev
```
Set `DATABASE_URL` and `JWT_SECRET_KEY` appropriately for local development; the API refuses to start with a missing/short JWT secret. SQLite is used by the test suite.

## Tests
```bash
cd backend
pip install -r requirements.txt
pytest -q
```
Frontend production build:
```bash
cd frontend
npm install
npm run build
```

## Configuration and production checklist
- Theme colors and spacing: `frontend/src/styles.css` CSS variables.
- API base URL: `VITE_API_URL` (defaults to `/api`; the Vite dev server proxies `/api` to FastAPI).
- Use a strong unique JWT secret, rotate credentials, and never commit `.env`.
- Configure HTTPS at the reverse proxy; restrict CORS to your exact frontend origins.
- Add database migrations (Alembic) before evolving production schemas; startup `create_all` is for this starter only.
- Set retention rules for location data, obtain appropriate consent, and limit access to child location information.
- Add backups, monitoring, rate limiting, audit log shipping, incident response, and integration tests before handling real student data.
