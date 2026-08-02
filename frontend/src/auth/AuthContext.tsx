import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authLogin, authLogout, authMe, authSignup, hasSessionHint, type User } from "../api";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  async function signup(email: string, password: string) {
    setUser(await authSignup(email, password));
  }

  async function logout() {
    try {
      await authLogout();
    } finally {
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
