import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import PasswordField from "../components/PasswordField";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await signup(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 360, margin: "4rem auto", fontFamily: "system-ui, sans-serif" }}>
      <h1>Sign up</h1>
      <form onSubmit={submit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: "0.5rem", margin: "0.25rem 0 1rem" }}
          />
        </label>
        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          minLength={8}
          autoComplete="new-password"
        />
        <p style={{ fontSize: "0.85rem", color: "#666", margin: "-0.75rem 0 1rem" }}>
          At least 8 characters.
        </p>
        <PasswordField
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          minLength={8}
          autoComplete="new-password"
        />
        <button type="submit" disabled={busy} style={{ width: "100%", padding: "0.5rem" }}>
          {busy ? "Creating account..." : "Sign up"}
        </button>
      </form>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </main>
  );
}
