import { useEffect, useState, type FormEvent } from "react";
import { getHealth, getProfile, saveProfile } from "../api";
import { useAuth } from "../auth/AuthContext";
import ChatTest from "../components/ChatTest";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [health, setHealth] = useState<"checking" | "ok" | "down">("checking");
  const [model, setModel] = useState("");

  const [cv, setCv] = useState("");
  const [jd, setJd] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
        setJd(p.jd_text);
      })
      .catch(() => {});
  }, []);

  async function saveContext(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await saveProfile({ cv_text: cv, jd_text: jd });
      setSaved(true);
    } finally {
      setSaving(false);
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
            <textarea
              value={cv}
              onChange={(e) => setCv(e.target.value)}
              rows={6}
              placeholder="Paste your CV..."
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

      <ChatTest />
    </main>
  );
}
