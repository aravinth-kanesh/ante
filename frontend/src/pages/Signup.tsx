import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { resendVerification } from "../api";
import { useAuth } from "../auth/AuthContext";
import AuthShell from "../components/AuthShell";
import PasswordField from "../components/PasswordField";
import { Button, Input } from "../components/ui";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false); // shown when verification is required

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const user = await signup(email, password);
      if (user.is_verified) navigate("/");
      else setPending(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <AuthShell
        title="Check your email"
        subtitle="We sent a link to confirm your address."
        footer={
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            Back to log in
          </Link>
        }
      >
        <p className="mb-4 text-sm text-slate-600">
          Open the email we just sent to {email} and follow the link to finish setting up your
          account. It may take a minute to arrive.
        </p>
        <Button variant="secondary" className="w-full" onClick={() => resendVerification(email)}>
          Resend the email
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start practising for your interviews."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit}>
        <div className="mb-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          minLength={8}
          autoComplete="new-password"
        />
        <p className="-mt-2 mb-4 text-xs text-slate-500">At least 8 characters.</p>
        <PasswordField
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          minLength={8}
          autoComplete="new-password"
        />
        <label className="mb-4 flex items-start gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            I have read and agree to the{" "}
            <Link to="/privacy" className="font-medium text-brand-700 hover:underline">
              privacy notice
            </Link>
            .
          </span>
        </label>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <Button type="submit" loading={busy} disabled={!consent} className="w-full">
          Sign up
        </Button>
      </form>
    </AuthShell>
  );
}
