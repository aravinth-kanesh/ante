import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authLogin,
  authLogout,
  getHealth,
  getProfile,
  hasSessionHint,
  readCookie,
  saveJobDescription,
  startInterview,
} from "./api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function clearCookies() {
  for (const c of document.cookie.split(";")) {
    document.cookie = `${c.split("=")[0].trim()}=;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}

const fetchMock = vi.fn();

beforeEach(() => {
  clearCookies();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("cookies", () => {
  it("reads a cookie and reports a session hint from the csrf cookie", () => {
    expect(hasSessionHint()).toBe(false);
    document.cookie = "csrf_token=abc123";
    expect(readCookie("csrf_token")).toBe("abc123");
    expect(hasSessionHint()).toBe(true);
  });
});

describe("request()", () => {
  it("adds the X-CSRF-Token header on a mutating request", async () => {
    document.cookie = "csrf_token=tok42";
    fetchMock.mockResolvedValueOnce(jsonResponse({ jd_text: "x" }));
    await saveJobDescription("a role");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("PUT");
    expect(init.headers["X-CSRF-Token"]).toBe("tok42");
    expect(init.credentials).toBe("include");
  });

  it("does not add a CSRF header on a GET", async () => {
    document.cookie = "csrf_token=tok42";
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: "ok", model: "m" }));
    await getHealth();
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["X-CSRF-Token"]).toBeUndefined();
  });

  it("on a 401 refreshes once and replays the original request", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // GET /api/profile
      .mockResolvedValueOnce(new Response(null, { status: 204 })) // POST /api/auth/refresh
      .mockResolvedValueOnce(jsonResponse({ jd_text: "hello" })); // replayed GET
    const profile = await getProfile();
    expect(profile.jd_text).toBe("hello");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/refresh");
  });

  it("does not refresh on a failed login", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "Incorrect email or password" }, 401));
    await expect(authLogin("a@b.co", "wrong")).rejects.toThrow("Incorrect email or password");
    expect(fetchMock).toHaveBeenCalledTimes(1); // no refresh attempt
  });

  it("returns null on 204", async () => {
    document.cookie = "csrf_token=t";
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(authLogout()).resolves.toBeUndefined();
  });

  it("turns a network failure into a plain, actionable message", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(getProfile()).rejects.toThrow(/Cannot reach the server/);
  });

  it("gives a calm message when rate limited", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "Rate limit exceeded: 20 per 1 minute" }, 429));
    await expect(getProfile()).rejects.toThrow(/too fast/);
  });

  it("hides a bare server error behind a friendly message", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 502 }));
    await expect(getProfile()).rejects.toThrow(/something went wrong on our side/i);
  });
});

describe("startInterview", () => {
  it("sends the chosen length, defaulting to 10 minutes", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ session_id: 1, question: "Q", mode: "voice", duration_target_min: 10 }),
    );
    await startInterview("voice", "general", "balanced");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).duration_target_min).toBe(10);

    await startInterview("voice", "general", "balanced", 20);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).duration_target_min).toBe(20);
  });
});
