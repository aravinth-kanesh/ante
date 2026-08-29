def _cookies(client, email):
    res = client.post("/api/auth/signup", json={"email": email, "password": "password123"})
    client.cookies.clear()
    return {"access_token": res.cookies["access_token"]}


def test_saved_answers_crud_and_ownership(client):
    cookies = _cookies(client, "saver@example.com")
    created = client.post(
        "/api/saved-answers",
        cookies=cookies,
        json={"question": "Why this role?", "answer": "Because I have built X and want more of it."},
    ).json()
    aid = created["id"]
    assert client.get("/api/saved-answers", cookies=cookies).json()[0]["id"] == aid

    intruder = _cookies(client, "saverintruder@example.com")
    assert client.get("/api/saved-answers", cookies=intruder).json() == []
    assert client.delete(f"/api/saved-answers/{aid}", cookies=intruder).status_code == 404

    assert client.delete(f"/api/saved-answers/{aid}", cookies=cookies).json() == {"ok": True}
    assert client.get("/api/saved-answers", cookies=cookies).json() == []
