export interface User {
  id: number;
  email: string;
  is_verified: boolean;
}

export interface Profile {
  cv_text: string;
  cv_filename: string;
  jd_text: string;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// A 401 on these must not trigger a refresh: refresh would recurse, and a failed
// login or signup is a genuine credential error, not an expired session.
const NO_REFRESH = ["/api/auth/refresh", "/api/auth/login", "/api/auth/signup", "/api/auth/logout"];

/** Read a readable (non-httpOnly) cookie, used for the CSRF token. */
export function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

/** True if a login session cookie is present (the CSRF cookie is JS-readable). */
export function hasSessionHint(): boolean {
  return readCookie("csrf_token") !== null;
}

function buildHeaders(options: RequestInit): Record<string, string> {
  const method = (options.method || "GET").toUpperCase();
  const isForm = options.body instanceof FormData; // sets its own multipart content-type
  const headers: Record<string, string> = {
    ...(isForm ? {} : { "Content-Type": "application/json" }),
    ...((options.headers as Record<string, string>) || {}),
  };
  if (!SAFE_METHODS.has(method)) {
    const csrf = readCookie("csrf_token");
    if (csrf) headers["X-CSRF-Token"] = csrf; // double-submit CSRF token
  }
  return headers;
}

async function request(path: string, options: RequestInit = {}, allowRefresh = true): Promise<any> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...options,
      headers: buildHeaders(options),
      credentials: "include", // send and receive the httpOnly auth cookies
    });
  } catch {
    // fetch only rejects on a network-level failure (offline, server unreachable), so
    // turn it into a message a student can act on rather than a raw "Failed to fetch".
    throw new Error("Cannot reach the server. Please check your connection and try again.");
  }
  // The access token is short-lived; on expiry, refresh once and replay the request.
  if (res.status === 401 && allowRefresh && !NO_REFRESH.includes(path)) {
    const refreshed = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: buildHeaders({ method: "POST" }),
    }).catch(() => null);
    if (refreshed && refreshed.ok) return request(path, options, false);
  }
  if (!res.ok) {
    // Rate limiting returns a terse machine message; give a calm, plain one instead.
    if (res.status === 429) {
      throw new Error("You are going a little too fast. Please wait a few seconds and try again.");
    }
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // response had no JSON body
    }
    // A server error with no useful detail should not surface as a bare status line.
    if (detail === res.statusText && res.status >= 500) {
      detail = "Something went wrong on our side. Please try again in a moment.";
    }
    throw new Error(detail);
  }
  if (res.status === 204) return null; // no content (e.g. account deletion)
  return res.json();
}

export async function getHealth(): Promise<{ status: string; model: string }> {
  return request("/api/health");
}

export async function authSignup(email: string, password: string): Promise<User> {
  return request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function authLogin(email: string, password: string): Promise<User> {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function authLogout(): Promise<void> {
  await request("/api/auth/logout", { method: "POST" });
}

export async function authMe(): Promise<User> {
  return request("/api/auth/me");
}

export async function getAuthConfig(): Promise<{ verification_required: boolean }> {
  return request("/api/auth/config");
}

export async function verifyEmail(token: string): Promise<User> {
  return request("/api/auth/verify", { method: "POST", body: JSON.stringify({ token }) });
}

export async function resendVerification(email: string): Promise<void> {
  await request("/api/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function forgotPassword(email: string): Promise<void> {
  await request("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await request("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await request("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export async function deleteAccount(): Promise<void> {
  await request("/api/auth/me", { method: "DELETE" });
}

/** Download all of the account's stored data as a JSON file (data portability). */
export async function exportMyData(): Promise<void> {
  const res = await fetch("/api/auth/export", { credentials: "include" });
  if (!res.ok) throw new Error("Could not export your data");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ante-data.json";
  link.click();
  URL.revokeObjectURL(url);
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
  sources: { title: string; url: string }[];
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
export type Focus = "balanced" | "gaps" | "questions";

export type InterviewLength = 5 | 10 | 15 | 20 | 25 | 30;
export type Difficulty = "gentle" | "standard" | "stretch";

export async function startInterview(
  mode: InterviewMode = "text",
  interviewType: InterviewType = "general",
  focus: Focus = "balanced",
  durationTargetMin: InterviewLength = 10,
  category = "",
  sample = false,
  difficulty: Difficulty = "standard",
): Promise<{ session_id: number; question: string; mode: InterviewMode; duration_target_min: number }> {
  return request("/api/interview/start", {
    method: "POST",
    body: JSON.stringify({
      mode,
      interview_type: interviewType,
      focus,
      category,
      duration_target_min: durationTargetMin,
      sample,
      difficulty,
    }),
  });
}

export interface AnswerMedia {
  index: number;
  has_video: boolean;
}

function mediaExt(type: string): string {
  return type.includes("mp4") ? "mp4" : "webm";
}

/** Upload one answer's recording to the temporary session store. */
export async function uploadAnswerMedia(
  sessionId: number,
  index: number,
  blob: Blob,
): Promise<AnswerMedia> {
  const form = new FormData();
  form.append("file", blob, `q${index}.${mediaExt(blob.type)}`);
  return request(`/api/interview/${sessionId}/media/${index}`, { method: "POST", body: form });
}

export async function listAnswerMedia(sessionId: number): Promise<AnswerMedia[]> {
  return request(`/api/interview/${sessionId}/media`);
}

/** A direct URL for a browser download (the cookie is sent automatically). */
export function answerMediaBundleUrl(sessionId: number): string {
  return `/api/interview/${sessionId}/media/bundle.zip`;
}

export async function deleteAnswerMedia(sessionId: number): Promise<void> {
  await request(`/api/interview/${sessionId}/media`, { method: "DELETE" });
}

export interface PauseEvent {
  start: number;
  end: number;
  long: boolean;
}

export interface FillerEvent {
  time: number;
  text: string;
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
  pauses: PauseEvent[];
  filler_events: FillerEvent[];
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
  const csrf = readCookie("csrf_token");
  const res = await fetch("/api/speech/say", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    },
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
  t: number; // seconds from the start of the recording
}

export interface NonverbalTick {
  t: number;
  eye_contact: boolean;
}

export interface NonverbalMetrics {
  frames_analysed: number;
  face_detected: boolean;
  eye_contact_pct: number;
  head_steadiness: number;
  steadiness_label: string;
  smile_pct: number | null;
  posture_pct: number | null;
  timeline: NonverbalTick[];
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
  model_answer: string;
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
  focus: string; // "", "gaps" or "questions"
  status: string;
  created_at: string;
  question_count: number;
  title: string;
  preview: string;
  is_sample: boolean;
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
  focus: string; // "", "gaps" or "questions"
  company: string;
  role: string;
  feedback: FeedbackReport | null;
  reflection: string;
  confidence_before: number;
  confidence_after: number;
  turns: TurnRead[];
}

export interface SavedAnswer {
  id: number;
  question: string;
  answer: string;
  created_at: string;
}

export async function listSavedAnswers(): Promise<SavedAnswer[]> {
  return request("/api/saved-answers");
}

export async function createSavedAnswer(question: string, answer: string): Promise<SavedAnswer> {
  return request("/api/saved-answers", { method: "POST", body: JSON.stringify({ question, answer }) });
}

export async function deleteSavedAnswer(id: number): Promise<{ ok: boolean }> {
  return request(`/api/saved-answers/${id}`, { method: "DELETE" });
}

export interface StarStory {
  id: number;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  updated_at: string;
}

export type StarStoryInput = Omit<StarStory, "id" | "updated_at">;

export async function listStarStories(): Promise<StarStory[]> {
  return request("/api/stars");
}

export async function createStarStory(data: StarStoryInput): Promise<StarStory> {
  return request("/api/stars", { method: "POST", body: JSON.stringify(data) });
}

export async function updateStarStory(id: number, data: StarStoryInput): Promise<StarStory> {
  return request(`/api/stars/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteStarStory(id: number): Promise<{ ok: boolean }> {
  return request(`/api/stars/${id}`, { method: "DELETE" });
}

/** A single question to practise, with no interview setup. */
export async function getPracticeQuestion(exclude = ""): Promise<{ question: string }> {
  const q = exclude ? `?exclude=${encodeURIComponent(exclude)}` : "";
  return request(`/api/practice/question${q}`);
}

/** Instant feedback on one practice answer, returned as a single answer note. */
export async function submitPracticeAnswer(question: string, answer: string): Promise<AnswerNote> {
  return request("/api/practice/answer", {
    method: "POST",
    body: JSON.stringify({ question, answer }),
  });
}

/** Save the student's own reflection note on a past interview. */
export async function saveReflection(sessionId: number, text: string): Promise<{ ok: boolean }> {
  return request(`/api/interview/${sessionId}/reflection`, {
    method: "PUT",
    body: JSON.stringify({ text }),
  });
}

/** Save the student's before/after confidence rating (1 to 5; 0 to leave unset). */
export async function saveConfidence(
  sessionId: number,
  before: number,
  after: number,
): Promise<{ ok: boolean }> {
  return request(`/api/interview/${sessionId}/confidence`, {
    method: "PUT",
    body: JSON.stringify({ before, after }),
  });
}

export async function listSessions(): Promise<SessionSummary[]> {
  return request("/api/interview");
}

export interface ActiveInterview {
  session_id: number;
  mode: InterviewMode;
  interview_type: InterviewType;
  duration_target_min: number;
  is_sample: boolean;
  question: string | null; // the current unanswered question, or null if asking has finished
  history: { question: string; answer: string }[];
}

/** The most recent interview left unfinished, so the page can offer to resume it. */
export async function getActiveInterview(): Promise<ActiveInterview | null> {
  return request("/api/interview/active");
}

export async function getInterview(sessionId: number): Promise<InterviewDetail> {
  return request(`/api/interview/${sessionId}`);
}

export async function deleteInterview(sessionId: number): Promise<{ ok: boolean }> {
  return request(`/api/interview/${sessionId}`, { method: "DELETE" });
}

// Progress tracking: trends aggregated from past interviews.
export interface Verdicts {
  strong: number;
  adequate: number;
  weak: number;
}

export interface SessionStats {
  session_id: number;
  created_at: string;
  interview_type: string;
  title: string;
  answered_count: number;
  strong_rate: number | null;
  verdicts: Verdicts;
  avg_wpm: number | null;
  filler_per_min: number | null;
  eye_contact_pct: number | null;
  head_steadiness: number | null;
  has_delivery: boolean;
  has_nonverbal: boolean;
  confidence_before: number | null;
  confidence_after: number | null;
}

export type TrendDirection = "improved" | "steady" | "slipped" | "na";

export interface MetricDelta {
  metric: string;
  label: string;
  first: number | null;
  latest: number | null;
  direction: TrendDirection;
  lower_is_better: boolean;
  good_low: number | null;
  good_high: number | null;
}

export interface ProgressReport {
  totals: { interviews: number; questions_answered: number; minutes_practised: number };
  sessions: SessionStats[];
  deltas: MetricDelta[];
  focus_areas: string[];
  strengths: string[];
}

export async function getProgress(): Promise<ProgressReport> {
  return request("/api/progress");
}

/** The stored coach summary (persists across logins; empty when none saved yet). */
export async function readProgressSummary(): Promise<{ summary: string }> {
  return request("/api/progress/summary");
}

/** Generate a fresh coach summary and store it (a billable model call). */
export async function generateProgressSummary(): Promise<{ summary: string }> {
  return request("/api/progress/summary", { method: "POST" });
}
