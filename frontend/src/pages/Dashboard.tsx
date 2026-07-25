import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  generateQuestions,
  getHealth,
  getProfile,
  getResearch,
  listCvs,
  researchCompany,
  saveJobDescription,
  type Cv,
  type PrepQuestion,
  type Research,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import CompanyResearchView from "../components/CompanyResearchView";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardTitle,
  DocumentIcon,
  Label,
  TextArea,
} from "../components/ui";

export default function Dashboard() {
  const { user } = useAuth();
  const [health, setHealth] = useState<"checking" | "ok" | "down">("checking");
  const [model, setModel] = useState("");

  const [activeCv, setActiveCv] = useState<Cv | null>(null);
  const [jd, setJd] = useState("");
  const [savedJd, setSavedJd] = useState(""); // what is persisted, to show saved state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [questions, setQuestions] = useState<PrepQuestion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  const [research, setResearch] = useState<Research | null>(null);
  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState("");

  useEffect(() => {
    getHealth()
      .then((h) => {
        setHealth("ok");
        setModel(h.model);
      })
      .catch(() => setHealth("down"));
    getProfile()
      .then((p) => {
        setJd(p.jd_text);
        setSavedJd(p.jd_text);
      })
      .catch(() => {});
    listCvs()
      .then((cvs) => setActiveCv(cvs.find((c) => c.selected) ?? null))
      .catch(() => {});
    getResearch()
      .then((r) => {
        if (r.research) setResearch(r);
      })
      .catch(() => {});
  }, []);

  async function saveContext(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      await saveJobDescription(jd);
      setSavedJd(jd);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function generate() {
    setGenerating(true);
    setGenError("");
    try {
      setQuestions(await generateQuestions());
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  async function runResearch() {
    setResearching(true);
    setResearchError("");
    try {
      setResearch(await researchCompany());
    } catch (err) {
      setResearchError(err instanceof Error ? err.message : String(err));
    } finally {
      setResearching(false);
    }
  }

  const jdChanged = jd !== savedJd;

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

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Ready to practise?</h2>
            <p className="mt-1 max-w-md text-sm text-brand-100">
              Run an adaptive mock interview with spoken questions and feedback on both your
              answers and your delivery.
            </p>
          </div>
          <Link to="/interview">
            <span className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 shadow-sm transition-colors hover:bg-brand-50">
              Start a mock interview
            </span>
          </Link>
        </div>
      </Card>

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
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <DocumentIcon className="h-5 w-5" />
                </span>
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

        {/* Job description */}
        <Card>
          <CardBody>
            <CardTitle>Job description</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Paste the job description you are preparing for.
            </p>
            <form onSubmit={saveContext} className="mt-4">
              <Label>Job description</Label>
              <TextArea
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                rows={7}
                placeholder="Paste the job description..."
              />
              <div className="mt-3 flex items-center gap-3">
                <Button type="submit" loading={saving} disabled={!jdChanged}>
                  Save
                </Button>
                {saveError && <span className="text-sm text-red-600">{saveError}</span>}
                {!saveError && jdChanged && (
                  <span className="text-sm text-amber-600">Unsaved changes</span>
                )}
                {!saveError && !jdChanged && jd.trim() && (
                  <span className="text-sm text-green-600">Saved</span>
                )}
              </div>
            </form>
          </CardBody>
        </Card>

        {/* Company research */}
        <Card>
          <CardBody>
            <CardTitle>Company research</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Research the company from your saved job description, so questions match how they
              interview.
            </p>
            <div className="mt-4">
              <Button variant="secondary" onClick={runResearch} loading={researching}>
                Research company
              </Button>
            </div>
            {researchError && <p className="mt-3 text-sm text-red-600">{researchError}</p>}
            {research?.research && (
              <div className="mt-5">
                <CompanyResearchView
                  company={research.company}
                  role={research.role}
                  research={research.research}
                />
              </div>
            )}
          </CardBody>
        </Card>

        {/* Likely questions */}
        <Card>
          <CardBody>
            <CardTitle>Likely interview questions</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Generate questions tailored to your active CV and job description.
            </p>
            <div className="mt-4">
              <Button variant="secondary" onClick={generate} loading={generating}>
                Generate questions
              </Button>
            </div>
            {genError && <p className="mt-3 text-sm text-red-600">{genError}</p>}
            {questions.length > 0 && (
              <ol className="mt-4 space-y-3">
                {questions.map((q, i) => (
                  <li key={i} className="text-sm text-slate-800">
                    <span className="mr-2 font-semibold text-brand-700">{i + 1}.</span>
                    {q.question}
                    {q.rationale && <p className="mt-0.5 ml-6 text-xs text-slate-500">{q.rationale}</p>}
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
