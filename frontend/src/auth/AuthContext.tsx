import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  authLogin,
  authLogout,
  authMe,
  authSignup,
  getAuthConfig,
  hasSessionHint,
  verifyEmail,
  type User,
} from "../api";

interface AuthState {
  user: User | null;
  loading: boolean;
  verificationRequired: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<User>;
  verify: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [verificationRequired, setVerificationRequired] = useState(false);

  useEffect(() => {
    getAuthConfig()
      .then((c) => setVerificationRequired(c.verification_required))
      .catch(() => setVerificationRequired(false));

    // The tokens are httpOnly, so we cannot read them; the JS-readable CSRF cookie
    // tells us whether to bother asking the server who we are.
    if (!hasSessionHint()) {
      setLoading(false);
      return;
    }
    authMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    setUser(await authLogin(email, password));
  }

  async function signup(email: string, password: string): Promise<User> {
    const created = await authSignup(email, password);
    // When verification is required the server does not start a session; the caller
    // shows a "check your email" screen instead of entering the app.
    if (created.is_verified) setUser(created);
    return created;
  }

  async function verify(token: string) {
    setUser(await verifyEmail(token));
  }

  async function logout() {
    try {
      await authLogout();
    } finally {
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, verificationRequired, login, signup, verify, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
