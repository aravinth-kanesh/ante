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
  if (res.status === 204) return null; // no content (e.g. account deletion)
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

export async function deleteAccount(): Promise<void> {
  await request("/api/auth/me", { method: "DELETE" });
}

export async function getProfile(): Promise<Profile> {
  return request("/api/profile");
}

export async function saveJobDescription(jd_text: string): Promise<Profile> {
  return request("/api/profile", {
    method: "PUT",
    body: JSON.stringify({ jd_text }),
  });
}

// CV library

export interface Cv {
  id: number;
  label: string;
  filename: string;
  created_at: string;
  selected: boolean;
}

export interface CvDetail extends Cv {
  text: string;
}

export async function listCvs(): Promise<Cv[]> {
  return request("/api/cv");
}

export async function createCv(label: string, text: string): Promise<CvDetail> {
  return request("/api/cv", { method: "POST", body: JSON.stringify({ label, text }) });
}

export async function uploadCvFile(file: File, label: string): Promise<CvDetail> {
  const form = new FormData();
  form.append("file", file);
  form.append("label", label);
  return request("/api/cv/upload", { method: "POST", body: form });
}

export async function getCv(id: number): Promise<CvDetail> {
  return request(`/api/cv/${id}`);
}

export async function renameCv(id: number, label: string): Promise<CvDetail> {
  return request(`/api/cv/${id}`, { method: "PATCH", body: JSON.stringify({ label }) });
}

export async function updateCvText(id: number, text: string): Promise<CvDetail> {
  return request(`/api/cv/${id}`, { method: "PATCH", body: JSON.stringify({ text }) });
}

export async function selectCv(id: number): Promise<CvDetail> {
  return request(`/api/cv/${id}/select`, { method: "POST" });
}

export async function deleteCv(id: number): Promise<{ ok: boolean }> {
  return request(`/api/cv/${id}`, { method: "DELETE" });
}

export interface CompanyResearch {
  overview: string;
  interview_process: string;
  technical_skills: string[];
  soft_skills: string[];
  skills: string[]; // legacy fallback
  tips: string[];
}

export interface Research {
  company: string;
  role: string;
  research: CompanyResearch | null;
}

export async function getResearch(): Promise<Research> {
  return request("/api/profile/research");
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

export interface PrepGroup {
  category: string;
  questions: PrepQuestion[];
}

export async function generateQuestions(): Promise<PrepGroup[]> {
  const data = await request("/api/prepare/questions", { method: "POST" });
  return data.groups;
}

export async function getPrepQuestions(): Promise<PrepGroup[]> {
  const data = await request("/api/prepare/questions");
  return data.groups;
}

export interface Competency {
  name: string;
  area: "technical" | "behavioural";
  status: "strong" | "partial" | "gap";
  evidence: string;
}

export interface PlanItem {
  focus: string;
  action: string;
  priority: "high" | "medium" | "low";
}

export interface PreparationReport {
  summary: string;
  competencies: Competency[];
  plan: PlanItem[];
}

export async function getPreparation(): Promise<PreparationReport> {
  return request("/api/prepare/plan");
}

export async function generatePreparation(): Promise<PreparationReport> {
  return request("/api/prepare/plan", { method: "POST" });
}

export type InterviewMode = "text" | "voice";
export type InterviewType = "general" | "behavioural" | "competency" | "technical" | "strengths";

export async function startInterview(
  mode: InterviewMode = "text",
  interviewType: InterviewType = "general",
): Promise<{ session_id: number; question: string; mode: InterviewMode }> {
  return request("/api/interview/start", {
    method: "POST",
    body: JSON.stringify({ mode, interview_type: interviewType }),
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

export interface ServerVoice {
  id: string;
  label: string;
}

export async function listServerVoices(): Promise<{ available: boolean; voices: ServerVoice[] }> {
  return request("/api/speech/voices");
}

/** Synthesise the interviewer's voice on the server. Returns WAV audio. */
export async function synthesizeSpeech(text: string, voice: string): Promise<Blob> {
  const res = await fetch("/api/speech/say", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ text, voice }),
  });
  if (!res.ok) throw new Error("Could not synthesise speech");
  return res.blob();
}

export interface NonverbalSample {
  face_detected: boolean;
  yaw: number;
  pitch: number;
  roll: number;
  eyes_open: boolean;
  smile: number;
  pose_detected: boolean;
  shoulder_tilt: number | null;
}

export interface NonverbalMetrics {
  frames_analysed: number;
  face_detected: boolean;
  eye_contact_pct: number;
  head_steadiness: number;
  steadiness_label: string;
  smile_pct: number | null;
  posture_pct: number | null;
}

export async function analyseNonverbal(samples: NonverbalSample[]): Promise<NonverbalMetrics> {
  return request("/api/vision/analyse", {
    method: "POST",
    body: JSON.stringify({ samples }),
  });
}

export async function answerInterview(
  sessionId: number,
  answer: string,
  metrics: DeliveryMetrics | null = null,
  nonverbal: NonverbalMetrics | null = null,
): Promise<{ question: string | null; done: boolean }> {
  return request(`/api/interview/${sessionId}/answer`, {
    method: "POST",
    body: JSON.stringify({ answer, metrics, nonverbal }),
  });
}

export interface AnswerNote {
  question: string;
  verdict: "strong" | "adequate" | "weak";
  comment: string;
}

export interface FeedbackReport {
  summary: string;
  strengths: string[];
  improvements: string[];
  answer_notes: AnswerNote[];
  delivery: string;
}

export async function finishInterview(sessionId: number): Promise<{ feedback: FeedbackReport }> {
  return request(`/api/interview/${sessionId}/finish`, { method: "POST" });
}

export async function regenerateFeedback(sessionId: number): Promise<{ feedback: FeedbackReport }> {
  return request(`/api/interview/${sessionId}/feedback`, { method: "POST" });
}

export interface SessionSummary {
  id: number;
  mode: InterviewMode;
  interview_type: InterviewType;
  status: string;
  created_at: string;
  question_count: number;
  title: string;
  preview: string;
}

export interface TurnRead {
  role: string;
  kind: string;
  content: string;
  metrics: DeliveryMetrics | null;
  nonverbal: NonverbalMetrics | null;
}

export interface InterviewDetail {
  status: string;
  mode: InterviewMode;
  interview_type: InterviewType;
  company: string;
  role: string;
  feedback: FeedbackReport | null;
  turns: TurnRead[];
}

export async function listSessions(): Promise<SessionSummary[]> {
  return request("/api/interview");
}

export async function getInterview(sessionId: number): Promise<InterviewDetail> {
  return request(`/api/interview/${sessionId}`);
}

export async function deleteInterview(sessionId: number): Promise<{ ok: boolean }> {
  return request(`/api/interview/${sessionId}`, { method: "DELETE" });
}
