import { getToken } from "./auth/token";

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface User {
  id: number;
  email: string;
}

export interface Profile {
  cv_text: string;
  jd_text: string;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...options.headers,
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // response had no JSON body
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function getHealth(): Promise<{ status: string; model: string }> {
  return request("/api/health");
}

export async function authSignup(email: string, password: string): Promise<string> {
  const data = await request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return data.access_token;
}

export async function authLogin(email: string, password: string): Promise<string> {
  const data = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return data.access_token;
}

export async function authMe(): Promise<User> {
  return request("/api/auth/me");
}

export async function getProfile(): Promise<Profile> {
  return request("/api/profile");
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  return request("/api/profile", { method: "PUT", body: JSON.stringify(profile) });
}

export async function sendChat(messages: Message[]): Promise<string> {
  const data = await request("/api/chat", {
    method: "POST",
    body: JSON.stringify({ messages }),
  });
  return data.reply;
}
