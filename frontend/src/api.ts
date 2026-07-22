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
  cv_filename: string;
  jd_text: string;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path: string, options: RequestInit = {}) {
  // FormData bodies set their own multipart content-type.
  const isForm = options.body instanceof FormData;
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
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

export async function saveProfile(cv_text: string, jd_text: string): Promise<Profile> {
  return request("/api/profile", {
    method: "PUT",
    body: JSON.stringify({ cv_text, jd_text }),
  });
}

export async function uploadCv(file: File): Promise<Profile> {
  const form = new FormData();
  form.append("file", file);
  return request("/api/profile/cv", { method: "POST", body: form });
}

export interface Research {
  company: string;
  role: string;
  company_context: string;
}

export async function researchCompany(): Promise<Research> {
  return request("/api/profile/research", { method: "POST" });
}

export interface ChatReply {
  reply: string;
  blocked: boolean;
}

export async function sendChat(messages: Message[]): Promise<ChatReply> {
  const data = await request("/api/chat", {
    method: "POST",
    body: JSON.stringify({ messages }),
  });
  return { reply: data.reply, blocked: data.blocked ?? false };
}

export interface PrepQuestion {
  question: string;
  rationale: string;
}

export async function generateQuestions(): Promise<PrepQuestion[]> {
  const data = await request("/api/prepare/questions", { method: "POST" });
  return data.questions;
}

export type InterviewMode = "text" | "voice";

export async function startInterview(
  mode: InterviewMode = "text",
): Promise<{ session_id: number; question: string; mode: InterviewMode }> {
  return request("/api/interview/start", {
    method: "POST",
    body: JSON.stringify({ mode }),
  });
}

export interface DeliveryMetrics {
  duration_sec: number;
  word_count: number;
  wpm: number;
  pause_count: number;
  long_pause_count: number;
  total_pause_sec: number;
  filler_count: number;
  fillers: Record<string, number>;
}

export async function transcribeAudio(
  blob: Blob,
): Promise<{ transcript: string; metrics: DeliveryMetrics }> {
  const form = new FormData();
  form.append("audio", blob, "answer.webm");
  return request("/api/speech/transcribe", { method: "POST", body: form });
}

export async function answerInterview(
  sessionId: number,
  answer: string,
  metrics: DeliveryMetrics | null = null,
): Promise<{ question: string | null; done: boolean }> {
  return request(`/api/interview/${sessionId}/answer`, {
    method: "POST",
    body: JSON.stringify({ answer, metrics }),
  });
}

export async function finishInterview(sessionId: number): Promise<{ feedback: string }> {
  return request(`/api/interview/${sessionId}/finish`, { method: "POST" });
}
