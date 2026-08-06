import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import AuthShell from "../components/AuthShell";
import { Button } from "../components/ui";

export default function Verify() {
  const { verify } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [status, setStatus] = useState<"working" | "done" | "error">("working");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // guard against React 18 double-invoke in dev
    started.current = true;
    if (!token) {
      setStatus("error");
      return;
    }
    verify(token)
      .then(() => {
        setStatus("done");
        setTimeout(() => navigate("/"), 1200);
      })
      .catch(() => setStatus("error"));
  }, [token, verify, navigate]);

  return (
    <AuthShell
      title="Verifying your email"
      footer={
        <Link to="/login" className="font-medium text-brand-700 hover:underline">
          Back to log in
        </Link>
      }
    >
      {status === "working" && <p className="text-sm text-slate-500">One moment while we confirm your email.</p>}
      {status === "done" && (
        <p className="text-sm text-slate-600">Your email is verified. Taking you to Ante now.</p>
      )}
      {status === "error" && (
        <div>
          <p role="alert" className="mb-4 text-sm text-red-600">
            This verification link is invalid or has expired.
          </p>
          <Link to="/login">
            <Button variant="secondary" className="w-full">
              Back to log in
            </Button>
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
