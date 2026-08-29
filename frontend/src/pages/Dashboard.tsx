import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getHealth, getPreparation, getProfile, listCvs, listSessions, type Cv } from "../api";
import { useAuth } from "../auth/AuthContext";
import GettingStarted from "../components/GettingStarted";
import Logo from "../components/Logo";
import { Badge, Card, CardBody, CardTitle } from "../components/ui";

const HIDE_KEY = "ante:getting-started-hidden";

export default function Dashboard() {
  const { user } = useAuth();
  const [health, setHealth] = useState<"checking" | "ok" | "down">("checking");
  const [model, setModel] = useState("");

  const [activeCv, setActiveCv] = useState<Cv | null>(null);
  const [jd, setJd] = useState("");
  const [planDone, setPlanDone] = useState(false);
  const [interviewDone, setInterviewDone] = useState(false);
  const [hidden, setHidden] = useState(() => localStorage.getItem(HIDE_KEY) === "1");

  const trimmedJd = jd.trim();
  const jdSnippet = trimmedJd.length > 240 ? trimmedJd.slice(0, 240).trimEnd() + "..." : trimmedJd;

  useEffect(() => {
    getHealth()
      .then((h) => {
        setHealth("ok");
        setModel(h.model);
      })
      .catch(() => setHealth("down"));
    getProfile()
      .then((p) => setJd(p.jd_text))
      .catch(() => {});
    listCvs()
      .then((cvs) => setActiveCv(cvs.find((c) => c.selected) ?? null))
      .catch(() => {});
    getPreparation()
      .then((r) => setPlanDone(r.competencies.length > 0))
      .catch(() => {});
    listSessions()
      .then((s) => setInterviewDone(s.length > 0))
      .catch(() => {});
  }, []);

  const steps = {
    cv: activeCv !== null,
    jd: trimmedJd.length > 0,
    plan: planDone,
    interview: interviewDone,
  };
  const allDone = steps.cv && steps.jd && steps.plan && steps.interview;

  function hideGettingStarted() {
    localStorage.setItem(HIDE_KEY, "1");
    setHidden(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Signed in as {user?.email}</p>
        </div>
        {health === "checking" && <Badge color="slate">Checking backend...</Badge>}
        {health === "ok" && <Badge color="green">Connected · {model}</Badge>}
        {health === "down" && <Badge color="red">Backend unavailable</Badge>}
      </div>

      {!allDone && !hidden && <GettingStarted steps={steps} onHide={hideGettingStarted} />}

      {/* Two paths: prepare, then interview */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card className="overflow-hidden transition-shadow hover:shadow-lift">
          <Link to="/prepare" className="block h-full">
            <div className="flex h-full flex-col justify-between gap-4 bg-gradient-to-br from-slate-700 to-slate-900 p-6 text-white dark:from-[#1b2334] dark:to-[#0b1018]">
              <div>
                <h2 className="text-xl font-semibold">Prepare</h2>
                <p className="mt-1 text-sm text-slate-300 dark:text-[#aab7c8]">
                  Set your target role, research the company, see where you fit, and get a plan and
                  likely questions.
                </p>
              </div>
              <span className="text-sm font-semibold text-white">Start preparing</span>
            </div>
          </Link>
        </Card>

        <Card className="overflow-hidden transition-shadow hover:shadow-lift">
          <Link to="/interview" className="block h-full">
            <div className="flex h-full flex-col justify-between gap-4 bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white">
              <div>
                <h2 className="text-xl font-semibold">Mock interview</h2>
                <p className="mt-1 text-sm text-brand-100 dark:text-[#c7d2fe]">
                  An adaptive interview with spoken questions and feedback on your answers and
                  delivery.
                </p>
              </div>
              <span className="text-sm font-semibold text-white">Start interview</span>
            </div>
          </Link>
        </Card>
      </div>

      <p className="text-center text-sm text-slate-500">
        Been practising?{" "}
        <Link to="/progress" className="font-medium text-brand-700 hover:underline">
          See how you are improving
        </Link>
        .
      </p>

      {/* At-a-glance status of the two inputs everything is tailored to */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Active CV */}
        <Card>
          <CardBody>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Active CV</CardTitle>
              <Link to="/cvs" className="text-sm font-medium text-brand-700 hover:underline">
                Manage CVs
              </Link>
            </div>
            {activeCv ? (
              <div className="mt-4 flex items-center gap-3">
                <Logo size={40} />
                <div>
                  <p className="font-medium text-slate-900">{activeCv.label}</p>
                  {activeCv.filename && (
                    <p className="text-xs text-slate-500">{activeCv.filename}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                No CV yet.{" "}
                <Link to="/cvs" className="font-medium text-brand-700 hover:underline">
                  Add one
                </Link>{" "}
                to tailor your interview.
              </p>
            )}
            <p className="mt-4 text-sm text-slate-500">
              Keep separate CVs for different industries and switch the active one before an
              interview.
            </p>
          </CardBody>
        </Card>

        {/* Job description (edited in Prepare; shown here as status) */}
        <Card>
          <CardBody>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Job description</CardTitle>
              <Link to="/prepare" className="text-sm font-medium text-brand-700 hover:underline">
                {trimmedJd ? "Edit in Prepare" : "Add in Prepare"}
              </Link>
            </div>
            {trimmedJd ? (
              <p className="mt-4 whitespace-pre-line text-sm text-slate-600">{jdSnippet}</p>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                No job description set yet. Add the role you are preparing for in{" "}
                <Link to="/prepare" className="font-medium text-brand-700 hover:underline">
                  Prepare
                </Link>
                .
              </p>
            )}
            <p className="mt-4 text-sm text-slate-500">
              The job description is used across Prepare and the interview.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
