def auth_cookies(client, email="star@example.com"):
    res = client.post("/api/auth/signup", json={"email": email, "password": "password123"})
    client.cookies.clear()
    return {"access_token": res.cookies["access_token"]}


def test_star_story_crud_and_ownership(client):
    cookies = auth_cookies(client, "starowner@example.com")
    # create
    created = client.post(
        "/api/stars",
        cookies=cookies,
        json={
            "title": "Leading a team",
            "situation": "Final-year group project",
            "task": "Deliver a working tool in eight weeks",
            "action": "I coordinated the plan and owned the database",
            "result": "We delivered on time with positive feedback",
        },
    ).json()
    assert created["title"] == "Leading a team"
    sid = created["id"]

    # list
    stories = client.get("/api/stars", cookies=cookies).json()
    assert len(stories) == 1 and stories[0]["id"] == sid

    # update
    updated = client.put(
        f"/api/stars/{sid}", cookies=cookies, json={**created, "title": "Leadership"}
    ).json()
    assert updated["title"] == "Leadership"

    # another user cannot see or touch it
    intruder = auth_cookies(client, "starintruder@example.com")
    assert client.get("/api/stars", cookies=intruder).json() == []
    assert client.put(f"/api/stars/{sid}", cookies=intruder, json=created).status_code == 404
    assert client.delete(f"/api/stars/{sid}", cookies=intruder).status_code == 404

    # owner deletes
    assert client.delete(f"/api/stars/{sid}", cookies=cookies).json() == {"ok": True}
    assert client.get("/api/stars", cookies=cookies).json() == []


def test_star_requires_auth(client):
    assert client.get("/api/stars").status_code == 401
