from pathlib import Path
import secrets
import getpass

env_path = Path(".env")

if env_path.exists():
    print("ERROR: .env already exists. Keeping it unchanged.")
    print("Back it up or rename it before generating new credentials.")
    raise SystemExit(1)

db_name = "schoolbus"
db_user = "schoolbus_app"

# URL-safe secrets: safe to embed in DATABASE_URL.
db_password = secrets.token_urlsafe(32)
jwt_secret = secrets.token_urlsafe(48)
admin_password = secrets.token_urlsafe(24)

admin_email = input(
    "Admin email [admin@school.example]: "
).strip() or "admin@school.example"

if "\n" in admin_email or "\r" in admin_email:
    raise SystemExit("Invalid email input.")

database_url = (
    f"postgresql+psycopg://{db_user}:{db_password}"
    f"@db:5432/{db_name}"
)

env_content = f"""POSTGRES_DB={db_name}
POSTGRES_USER={db_user}
POSTGRES_PASSWORD={db_password}
DATABASE_URL={database_url}
JWT_SECRET_KEY={jwt_secret}
ACCESS_TOKEN_EXPIRE_MINUTES=60
BOOTSTRAP_ADMIN_EMAIL={admin_email}
BOOTSTRAP_ADMIN_PASSWORD={admin_password}
CORS_ORIGINS=http://localhost:8080,http://localhost:5173
VITE_API_URL=/api
"""

# Create the file exclusively; never overwrite an existing .env.
with env_path.open("x", encoding="utf-8") as file:
    file.write(env_content)

print("\nEnvironment file generated successfully.")
print(f"Location: {env_path.resolve()}")
print("\nSAVE THESE ADMIN CREDENTIALS:")
print(f"Email:    {admin_email}")
print(f"Password: {admin_password}")
print("\nStore the password securely. Do not commit .env to Git.")
print("Start the application with: docker compose up --build")
