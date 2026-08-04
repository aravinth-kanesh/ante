import { type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Cvs from "./pages/Cvs";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Interview from "./pages/Interview";
import ForgotPassword from "./pages/ForgotPassword";
import Login from "./pages/Login";
import Prepare from "./pages/Prepare";
import Privacy from "./pages/Privacy";
import Progress from "./pages/Progress";
import ResetPassword from "./pages/ResetPassword";
import Results from "./pages/Results";
import Settings from "./pages/Settings";
import Signup from "./pages/Signup";
import Verify from "./pages/Verify";

// A protected page wrapped in the app shell (nav + container).
function Page({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/" element={<Page><Dashboard /></Page>} />
          <Route path="/cvs" element={<Page><Cvs /></Page>} />
          <Route path="/prepare" element={<Page><Prepare /></Page>} />
          <Route path="/interview" element={<Page><Interview /></Page>} />
          <Route path="/progress" element={<Page><Progress /></Page>} />
          <Route path="/results/:id" element={<Page><Results /></Page>} />
          <Route path="/history" element={<Page><History /></Page>} />
          <Route path="/settings" element={<Page><Settings /></Page>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
