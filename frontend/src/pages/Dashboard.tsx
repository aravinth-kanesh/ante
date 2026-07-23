import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  generateQuestions,
  getHealth,
  getProfile,
  researchCompany,
  saveProfile,
  uploadCv,
  type PrepQuestion,
  type Research,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import { Badge, Button, Card, CardBody, CardTitle, Label, TextArea } from "../components/ui";

export default function Dashboard() {
  const { user } = useAuth();
  const [health, setHealth] = useState<"checking" | "ok" | "down">("checking");
  const [model, setModel] = useState("");

  const [cv, setCv] = useState("");
  const [cvFilename, setCvFilename] = useState("");
  const [jd, setJd] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

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
        setCv(p.cv_text);
        setCvFilename(p.cv_filename);
        setJd(p.jd_text);
      })
      .catch(() => {});
  }, []);

  async function saveContext(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await saveProfile(cv, jd);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function onCvFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const p = await uploadCv(file);
      setCv(p.cv_text);
      setCvFilename(p.cv_filename);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      e.target.value = "";
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Signed in as {user?.email}</p>
        </div>
        {health === "checking" && <Badge color="slate">Checking backend…</Badge>}
        {health === "ok" && <Badge color="green">Connected · {model}</Badge>}
        {health === "down" && <Badge color="red">Backend unavailable</Badge>}
      </div>

      {/* Hero CTA */}
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
        {/* Preparation context */}
        <Card className="lg:col-span-2">
          <CardBody>
            <CardTitle>Your preparation context</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Add your CV and the job description you are preparing for. These tailor your
              practice. You can manage multiple CVs on the{" "}
              <Link to="/cvs" className="font-medium text-brand-700 hover:underline">
                CVs page
              </Link>
              .
            </p>
            <form onSubmit={saveContext} className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <Label>CV</Label>
                <label
                  className={`inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 ${
                    uploading ? "cursor-default opacity-70" : "cursor-pointer"
                  }`}
                >
                  {uploading ? "Extracting text…" : cvFilename ? "Replace CV file" : "Choose a CV file"}
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={onCvFile}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
                {!uploading && cvFilename && (
                  <p className="mt-1 text-xs text-slate-500">Uploaded: {cvFilename}</p>
                )}
                {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
                <TextArea
                  value={cv}
                  onChange={(e) => setCv(e.target.value)}
                  rows={7}
                  placeholder="Upload a file above or paste your CV…"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Job description</Label>
                <TextArea
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  rows={7}
                  placeholder="Paste the job description…"
                />
              </div>
              <div className="flex items-center gap-3 md:col-span-2">
                <Button type="submit" loading={saving}>
                  Save context
                </Button>
                {saved && <span className="text-sm text-green-600">Saved</span>}
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
            {research && (
              <div className="mt-4">
                <p className="font-medium text-slate-900">
                  {research.company || "Company"}
                  {research.role && <span className="text-slate-500"> · {research.role}</span>}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                  {research.company_context}
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Likely questions */}
        <Card>
          <CardBody>
            <CardTitle>Likely interview questions</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Generate questions tailored to your saved CV and job description.
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
