import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../api";
import AuthShell from "../components/AuthShell";
import PasswordField from "../components/PasswordField";
import { Button } from "../components/ui";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
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
      await resetPassword(token, password);
      navigate("/login", { state: { reset: true } });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Choose a new password"
      footer={
        <Link to="/login" className="font-medium text-brand-700 hover:underline">
          Back to log in
        </Link>
      }
    >
      {!token ? (
        <p className="text-sm text-red-600">This reset link is missing its token. Please request a new one.</p>
      ) : (
        <form onSubmit={submit}>
          <PasswordField
            label="New password"
            value={password}
            onChange={setPassword}
            minLength={8}
            autoComplete="new-password"
          />
          <p className="-mt-2 mb-4 text-xs text-slate-500">At least 8 characters.</p>
          <PasswordField
            label="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            minLength={8}
            autoComplete="new-password"
          />
          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          <Button type="submit" loading={busy} className="w-full">
            Reset password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
