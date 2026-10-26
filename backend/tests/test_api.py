from .conftest import token


def test_health_check(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_login_and_me(client, admin_token):
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200 and r.json()["role"] == "admin"


def test_invalid_login(client):
    r = client.post("/api/auth/login", json={"email": "wrong@example.com", "password": "BadPassword123!"})
    assert r.status_code == 401


def test_admin_creates_route_bus_driver_parent(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    route = client.post(
        "/api/admin/routes",
        headers=h,
        json={"name": "North Route", "start_point": "Depot", "end_point": "School", "stops": ["Park"]},
    )
    assert route.status_code == 201, route.text
    bus = client.post(
        "/api/admin/buses",
        headers=h,
        json={"bus_number": "BUS-01", "plate_number": "TN01AB1234", "capacity": 35, "route_id": route.json()["id"]},
    )
    assert bus.status_code == 201, bus.text
    bus_id = bus.json()["id"]
    for role, email in [("driver", "driver@example.com"), ("parent", "parent@example.com")]:
        result = client.post(
            "/api/admin/users",
            headers=h,
            json={
                "email": email,
                "full_name": role.title() + " User",
                "password": "StrongPassword123!",
                "role": role,
                "assigned_bus_id": bus_id,
            },
        )
        assert result.status_code == 201, result.text

    # Verify listing routes and buses
    routes_list = client.get("/api/admin/routes", headers=h)
    assert routes_list.status_code == 200
    assert len(routes_list.json()) >= 1

    buses_list = client.get("/api/admin/buses", headers=h)
    assert buses_list.status_code == 200
    assert len(buses_list.json()) >= 1

    # Verify tracking buses
    assert client.get("/api/tracking/buses", headers=h).json()[0]["route"]["name"] == "North Route"


def test_duplicate_user_and_bus_rejection(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    client.post(
        "/api/admin/buses",
        headers=h,
        json={"bus_number": "BUS-DUP", "plate_number": "TN99DUP1", "capacity": 30},
    )
    dup_bus = client.post(
        "/api/admin/buses",
        headers=h,
        json={"bus_number": "BUS-DUP", "plate_number": "TN99DUP2", "capacity": 30},
    )
    assert dup_bus.status_code == 409

    client.post(
        "/api/admin/users",
        headers=h,
        json={"email": "dup@example.com", "full_name": "Dup User", "password": "StrongPassword123!", "role": "driver"},
    )
    dup_user = client.post(
        "/api/admin/users",
        headers=h,
        json={"email": "dup@example.com", "full_name": "Dup User 2", "password": "StrongPassword123!", "role": "parent"},
    )
    assert dup_user.status_code == 409


def test_parent_only_sees_assigned_bus(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    route_response = client.post(
        "/api/admin/routes",
        headers=h,
        json={"name": "R1", "start_point": "AB", "end_point": "BC", "stops": []},
    )
    assert route_response.status_code == 201, route_response.text
    r = route_response.json()
    bus_response = client.post(
        "/api/admin/buses",
        headers=h,
        json={"bus_number": "BUS-1", "plate_number": "TN01AA1111", "route_id": r["id"]},
    )
    assert bus_response.status_code == 201, bus_response.text
    b1 = bus_response.json()
    client.post("/api/admin/buses", headers=h, json={"bus_number": "BUS-2", "plate_number": "TN01AA2222"})
    client.post(
        "/api/admin/users",
        headers=h,
        json={
            "email": "parent@example.com",
            "full_name": "Parent",
            "password": "StrongPassword123!",
            "role": "parent",
            "assigned_bus_id": b1["id"],
        },
    )
    pt = token(client, "parent@example.com", "StrongPassword123!")
    response = client.get("/api/tracking/buses", headers={"Authorization": f"Bearer {pt}"})
    assert response.status_code == 200
    assert len(response.json()) == 1 and response.json()[0]["bus_number"] == "BUS-1"


def test_driver_can_update_only_assigned_bus(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    b = client.post("/api/admin/buses", headers=h, json={"bus_number": "BUS-9", "plate_number": "TN09ZZ9999"}).json()
    client.post(
        "/api/admin/users",
        headers=h,
        json={"email": "driver@example.com", "full_name": "Driver", "password": "StrongPassword123!", "role": "driver", "assigned_bus_id": b["id"]},
    )
    dt = token(client, "driver@example.com", "StrongPassword123!")
    response = client.put(
        "/api/driver/location",
        headers={"Authorization": f"Bearer {dt}"},
        json={"latitude": 13.0827, "longitude": 80.2707, "speed_kph": 25},
    )
    assert response.status_code == 200 and response.json()["latitude"] == 13.0827


def test_driver_without_bus_rejected(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    client.post(
        "/api/admin/users",
        headers=h,
        json={"email": "driver_nobus@example.com", "full_name": "Driver No Bus", "password": "StrongPassword123!", "role": "driver"},
    )
    dt = token(client, "driver_nobus@example.com", "StrongPassword123!")
    response = client.put(
        "/api/driver/location",
        headers={"Authorization": f"Bearer {dt}"},
        json={"latitude": 13.0827, "longitude": 80.2707, "speed_kph": 25},
    )
    assert response.status_code == 403


def test_parent_cannot_create_routes(client):
    h = {"Authorization": f"Bearer {token(client, 'admin@example.com', 'AdminPassword123!')}"}
    client.post(
        "/api/admin/users",
        headers=h,
        json={"email": "parent@example.com", "full_name": "Parent", "password": "StrongPassword123!", "role": "parent"},
    )
    pt = token(client, "parent@example.com", "StrongPassword123!")
    r = client.post(
        "/api/admin/routes",
        headers={"Authorization": f"Bearer {pt}"},
        json={"name": "Bad route", "start_point": "A", "end_point": "B"},
    )
    assert r.status_code == 403
