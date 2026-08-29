import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import RouteAnnouncer from "./components/RouteAnnouncer";
import { Loading } from "./components/ui";
import Cvs from "./pages/Cvs";
import Dashboard from "./pages/Dashboard";
import Help from "./pages/Help";
import History from "./pages/History";
import ForgotPassword from "./pages/ForgotPassword";
import Login from "./pages/Login";
import Prepare from "./pages/Prepare";
import Privacy from "./pages/Privacy";
import QuickPractice from "./pages/QuickPractice";
import ResetPassword from "./pages/ResetPassword";
import Settings from "./pages/Settings";
import Signup from "./pages/Signup";
import Verify from "./pages/Verify";

// The heaviest routes (in-browser vision and recording, the replay player, the trend
// charts) are split into their own chunks so the first load stays lean on campus wifi.
const Interview = lazy(() => import("./pages/Interview"));
const Results = lazy(() => import("./pages/Results"));
const Progress = lazy(() => import("./pages/Progress"));

// A protected page wrapped in the app shell (nav + container). Lazy content suspends
// inside the layout, so the nav stays put while a chunk loads.
function Page({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <Layout>
        <Suspense fallback={<div className="flex justify-center py-16"><Loading /></div>}>
          {children}
        </Suspense>
      </Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RouteAnnouncer />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/help" element={<Help />} />
          <Route path="/" element={<Page><Dashboard /></Page>} />
          <Route path="/cvs" element={<Page><Cvs /></Page>} />
          <Route path="/prepare" element={<Page><Prepare /></Page>} />
          <Route path="/interview" element={<Page><Interview /></Page>} />
          <Route path="/practice" element={<Page><QuickPractice /></Page>} />
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
