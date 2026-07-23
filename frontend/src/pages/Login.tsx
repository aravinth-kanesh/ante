import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Logo from "../components/Logo";
import PasswordField from "../components/PasswordField";
import { Button, Card, CardBody, Input, Label } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
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
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
            <p className="mt-1 text-sm text-slate-500">Log in to continue your interview practice.</p>
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
                autoComplete="current-password"
              />
              {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
              <Button type="submit" loading={busy} className="w-full">
                Log in
              </Button>
            </form>
          </CardBody>
        </Card>
        <p className="mt-5 text-center text-sm text-slate-500">
          No account?{" "}
          <Link to="/signup" className="font-medium text-brand-700 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
