import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  generateQuestions,
  getHealth,
  getProfile,
  saveProfile,
  uploadCv,
  type PrepQuestion,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import ChatTest from "../components/ChatTest";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [health, setHealth] = useState<"checking" | "ok" | "down">("checking");
  const [model, setModel] = useState("");

  const [cv, setCv] = useState("");
  const [cvFilename, setCvFilename] = useState("");
  const [jd, setJd] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [questions, setQuestions] = useState<PrepQuestion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  useEffect(() => {
    getHealth()
      .then((h) => {
        setHealth("ok");
        setModel(h.model);
      })
      .catch(() => setHealth("down"));
    getProfile()
      .then((p) => {
        setCv(p.cv_text);
        setCvFilename(p.cv_filename);
        setJd(p.jd_text);
      })
      .catch(() => {});
  }, []);

  async function saveContext(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await saveProfile(cv, jd);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function onCvFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const p = await uploadCv(file);
      setCv(p.cv_text);
      setCvFilename(p.cv_filename);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function generate() {
    setGenerating(true);
    setGenError("");
    try {
      setQuestions(await generateQuestions());
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>AI Interview Practice</h1>
        <button onClick={logout}>Log out</button>
      </header>
      <p>Signed in as {user?.email}</p>
      <p>
        Backend:{" "}
        {health === "checking" && <span>checking...</span>}
        {health === "ok" && <span style={{ color: "green" }}>connected (model: {model})</span>}
        {health === "down" && <span style={{ color: "crimson" }}>unavailable</span>}
      </p>

      <section>
        <h2>Your preparation context</h2>
        <p style={{ color: "#666", marginTop: 0 }}>
          Paste your CV and the job description you are preparing for. These will be used to
          tailor your practice.
        </p>
        <form onSubmit={saveContext}>
          <label>
            CV
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={onCvFile}
              disabled={uploading}
              style={{ display: "block", margin: "0.25rem 0" }}
            />
            {uploading && <span style={{ fontSize: "0.85rem" }}>Extracting text...</span>}
            {!uploading && cvFilename && (
              <span style={{ color: "#666", fontSize: "0.85rem" }}>Uploaded: {cvFilename}</span>
            )}
            {uploadError && <span style={{ color: "crimson", fontSize: "0.85rem" }}> {uploadError}</span>}
            <textarea
              value={cv}
              onChange={(e) => setCv(e.target.value)}
              rows={6}
              placeholder="Upload a file above or paste your CV..."
              style={{ width: "100%", boxSizing: "border-box", margin: "0.25rem 0 1rem" }}
            />
          </label>
          <label>
            Job description
            <textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              rows={6}
              placeholder="Paste the job description..."
              style={{ width: "100%", boxSizing: "border-box", margin: "0.25rem 0 1rem" }}
            />
          </label>
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
          {saved && <span style={{ color: "green", marginLeft: "0.75rem" }}>Saved</span>}
        </form>
      </section>

      <section>
        <h2>Likely interview questions</h2>
        <p style={{ color: "#666", marginTop: 0 }}>
          Generate questions tailored to your saved CV and job description.
        </p>
        <button onClick={generate} disabled={generating}>
          {generating ? "Generating..." : "Generate likely questions"}
        </button>
        {genError && <p style={{ color: "crimson" }}>{genError}</p>}
        {questions.length > 0 && (
          <ol>
            {questions.map((q, i) => (
              <li key={i} style={{ marginBottom: "0.5rem" }}>
                {q.question}
                {q.rationale && (
                  <div style={{ color: "#666", fontSize: "0.85rem" }}>{q.rationale}</div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <ChatTest />
    </main>
  );
}
