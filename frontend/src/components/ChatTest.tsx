import { useState } from "react";
import { sendChat } from "../api";

export default function ChatTest() {
  const [prompt, setPrompt] = useState(
    "Give me a common interview question for a graduate software engineering role.",
  );
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError("");
    setReply("");
    try {
      const text = await sendChat([{ role: "user", content: prompt }]);
      setReply(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h2>Ask the model</h2>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Type a message..."
        rows={3}
        style={{ width: "100%", boxSizing: "border-box", fontSize: "1rem" }}
      />
      <button onClick={submit} disabled={loading || !prompt.trim()}>
        {loading ? "Sending..." : "Send"}
      </button>
      {reply && (
        <p style={{ whiteSpace: "pre-wrap", marginTop: "1rem" }}>
          <strong>Reply:</strong> {reply}
        </p>
      )}
      {error && (
        <p style={{ color: "crimson", marginTop: "1rem" }}>
          <strong>Error:</strong> {error}
        </p>
      )}
    </section>
  );
}
