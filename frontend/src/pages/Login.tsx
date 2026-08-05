import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { resendVerification } from "../api";
import { useAuth } from "../auth/AuthContext";
import AuthShell from "../components/AuthShell";
import PasswordField from "../components/PasswordField";
import { WhyAnteShort } from "../components/WhyAnte";
import { Button, Input } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const justReset = (location.state as { reset?: boolean } | null)?.reset;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNeedsVerification(false);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      if (message.toLowerCase().includes("verify")) setNeedsVerification(true);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    await resendVerification(email);
    setResent(true);
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to continue your interview practice."
      footer={
        <>
          No account?{" "}
          <Link to="/signup" className="font-medium text-brand-700 hover:underline">
            Sign up
          </Link>
          <div className="mt-8 border-t border-slate-200 pt-5 text-left">
            <WhyAnteShort />
          </div>
        </>
      }
    >
      <form onSubmit={submit}>
        {justReset && (
          <p className="mb-4 text-sm text-green-700">
            Your password has been reset. You can log in with it now.
          </p>
        )}
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
          autoComplete="current-password"
        />
        <div className="-mt-2 mb-4 text-right">
          <Link to="/forgot-password" className="text-xs font-medium text-brand-700 hover:underline">
            Forgot password?
          </Link>
        </div>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {needsVerification &&
          (resent ? (
            <p className="mb-4 text-sm text-slate-600">A new verification email is on its way.</p>
          ) : (
            <Button type="button" variant="secondary" className="mb-4 w-full" onClick={resend}>
              Resend verification email
            </Button>
          ))}
        <Button type="submit" loading={busy} className="w-full">
          Log in
        </Button>
      </form>
    </AuthShell>
  );
}
