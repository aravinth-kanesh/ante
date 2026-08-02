import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../api";
import AuthShell from "../components/AuthShell";
import { Button, Input, Label } from "../components/ui";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We will email you a link to choose a new one."
      footer={
        <Link to="/login" className="font-medium text-brand-700 hover:underline">
          Back to log in
        </Link>
      }
    >
      {sent ? (
        <p className="text-sm text-slate-600">
          If an account exists for that email, a reset link is on its way. Please check your inbox.
        </p>
      ) : (
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
          <Button type="submit" loading={busy} className="w-full">
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
