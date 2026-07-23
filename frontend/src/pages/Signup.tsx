import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Logo from "../components/Logo";
import PasswordField from "../components/PasswordField";
import { Button, Card, CardBody, Input, Label } from "../components/ui";

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-brand-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo size={44} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Create your account</h1>
            <p className="mt-1 text-sm text-slate-500">Start practising for your interviews.</p>
          </div>
        </div>
        <Card>
          <CardBody>
            <form onSubmit={submit}>
              <div className="mb-4">
                <Label>Email</Label>
                <Input
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
              {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
              <Button type="submit" loading={busy} className="w-full">
                Sign up
              </Button>
            </form>
          </CardBody>
        </Card>
        <p className="mt-5 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
