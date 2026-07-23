def auth_header(client, email="cvlib@example.com"):
    token = client.post(
        "/api/auth/signup", json={"email": email, "password": "password123"}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_create_and_list_selects_new_cv(client):
    headers = auth_header(client)
    created = client.post(
        "/api/cv", headers=headers, json={"label": "Tech CV", "text": "python and react"}
    ).json()
    assert created["label"] == "Tech CV" and created["selected"] is True

    listing = client.get("/api/cv", headers=headers).json()
    assert len(listing) == 1 and listing[0]["selected"] is True


def test_selecting_switches_active_and_mirrors_profile(client):
    headers = auth_header(client, "cvswitch@example.com")
    finance = client.post(
        "/api/cv", headers=headers, json={"label": "Finance CV", "text": "excel and modelling"}
    ).json()
    tech = client.post(
        "/api/cv", headers=headers, json={"label": "Tech CV", "text": "python and react"}
    ).json()

    # newest (tech) is active; the profile mirror follows it
    assert client.get("/api/profile", headers=headers).json()["cv_text"] == "python and react"

    client.post(f"/api/cv/{finance['id']}/select", headers=headers)
    assert client.get("/api/profile", headers=headers).json()["cv_text"] == "excel and modelling"

    selected = [c for c in client.get("/api/cv", headers=headers).json() if c["selected"]]
    assert len(selected) == 1 and selected[0]["id"] == finance["id"]


def test_rename_and_delete(client):
    headers = auth_header(client, "cvedit@example.com")
    a = client.post("/api/cv", headers=headers, json={"label": "A", "text": "one"}).json()
    b = client.post("/api/cv", headers=headers, json={"label": "B", "text": "two"}).json()

    renamed = client.patch(f"/api/cv/{a['id']}", headers=headers, json={"label": "Renamed"}).json()
    assert renamed["label"] == "Renamed"

    # delete the active CV (b, newest); active falls back to the remaining one
    client.delete(f"/api/cv/{b['id']}", headers=headers)
    listing = client.get("/api/cv", headers=headers).json()
    assert [c["id"] for c in listing] == [a["id"]]
    assert listing[0]["selected"] is True
    assert client.get("/api/profile", headers=headers).json()["cv_text"] == "one"


def test_ownership_is_enforced(client):
    owner = auth_header(client, "cvowner@example.com")
    cv = client.post("/api/cv", headers=owner, json={"label": "Mine", "text": "secret"}).json()

    intruder = auth_header(client, "cvintruder@example.com")
    assert client.get(f"/api/cv/{cv['id']}", headers=intruder).status_code == 404
    assert client.post(f"/api/cv/{cv['id']}/select", headers=intruder).status_code == 404
    assert client.delete(f"/api/cv/{cv['id']}", headers=intruder).status_code == 404


def test_legacy_profile_cv_is_backfilled(client):
    headers = auth_header(client, "cvlegacy@example.com")
    # old flow: CV saved straight onto the profile
    client.put("/api/profile", headers=headers, json={"cv_text": "legacy cv", "jd_text": ""})

    listing = client.get("/api/cv", headers=headers).json()
    assert len(listing) == 1
    assert listing[0]["selected"] is True and listing[0]["label"] == "My CV"


def test_requires_auth(client):
    assert client.get("/api/cv").status_code == 401


def test_create_rejects_empty(client):
    headers = auth_header(client, "cvempty@example.com")
    assert client.post("/api/cv", headers=headers, json={"label": "x", "text": "  "}).status_code == 400
