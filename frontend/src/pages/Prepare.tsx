import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  generatePreparation,
  generateQuestions,
  getPreparation,
  getPrepQuestions,
  getProfile,
  getResearch,
  listCvs,
  researchCompany,
  saveJobDescription,
  type Cv,
  type PrepGroup,
  type PreparationReport,
  type Research,
} from "../api";
import CompanyResearchView from "../components/CompanyResearchView";
import PreparationView from "../components/PreparationView";
import { Button, Card, CardBody, CardTitle, TextArea } from "../components/ui";

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export default function Prepare() {
  const navigate = useNavigate();
  const [activeCv, setActiveCv] = useState<Cv | null>(null);

  const [jd, setJd] = useState("");
  const [savedJd, setSavedJd] = useState("");
  const [savingJd, setSavingJd] = useState(false);
  const [jdError, setJdError] = useState("");

  const [research, setResearch] = useState<Research | null>(null);
  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState("");

  const [prep, setPrep] = useState<PreparationReport | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState("");

  const [questions, setQuestions] = useState<PrepGroup[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  useEffect(() => {
    (async () => {
      const [cvs, profile, r, prepData, qs] = await Promise.all([
        listCvs().catch(() => [] as Cv[]),
        getProfile().catch(() => null),
        getResearch().catch(() => null),
        getPreparation().catch(() => null),
        getPrepQuestions().catch(() => [] as PrepGroup[]),
      ]);
      const cv = cvs.find((c) => c.selected) ?? null;
      setActiveCv(cv);
      if (profile) {
        setJd(profile.jd_text);
        setSavedJd(profile.jd_text);
      }
      if (r?.research) setResearch(r);
      const hasPlan = Boolean(prepData && (prepData.competencies.length > 0 || prepData.plan.length > 0));
      if (hasPlan && prepData) setPrep(prepData);
      setQuestions(qs);

      // Auto-generate any tailored section that is missing for the current job
      // description and CV, so the page stays up to date without a manual click. A change
      // to the CV or job description clears these on the server, which brings us here.
      const jdReady = Boolean(profile?.jd_text?.trim());
      if (jdReady && !r?.research) runResearch();
      if (jdReady && cv && !hasPlan) runPlan();
      if (jdReady && cv && qs.length === 0) runQuestions();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveJd(e: FormEvent) {
    e.preventDefault();
    setSavingJd(true);
    setJdError("");
    try {
      await saveJobDescription(jd);
      setSavedJd(jd);
      // A new job description makes every tailored section out of date (the server has
      // cleared them), so regenerate them for the new role.
      setResearch(null);
      setPrep(null);
      setQuestions([]);
      runResearch();
      if (activeCv) {
        runPlan();
        runQuestions();
      }
    } catch (err) {
      setJdError(message(err));
    } finally {
      setSavingJd(false);
    }
  }

  async function runResearch() {
    setResearching(true);
    setResearchError("");
    try {
      setResearch(await researchCompany());
    } catch (err) {
      setResearchError(message(err));
    } finally {
      setResearching(false);
    }
  }

  async function runPlan() {
    setPlanning(true);
    setPlanError("");
    try {
      setPrep(await generatePreparation());
    } catch (err) {
      setPlanError(message(err));
    } finally {
      setPlanning(false);
    }
  }

  async function runQuestions() {
    setGenerating(true);
    setGenError("");
    try {
      setQuestions(await generateQuestions());
    } catch (err) {
      setGenError(message(err));
    } finally {
      setGenerating(false);
    }
  }

  const hasJd = Boolean(savedJd.trim());
  const jdChanged = jd !== savedJd;
  const ready = activeCv && hasJd;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Prepare</h1>
        <p className="mt-1 text-sm text-slate-500">
          Research the company, see where you fit the role, get a plan to close the gaps, and
          review likely questions, all tailored to your CV and the job.
        </p>
      </div>

      {/* Setup: the CV and job description everything below is tailored to */}
      <Card className={ready ? "" : "border-amber-200 bg-amber-50/40"}>
        <CardBody>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Your target role</CardTitle>
            <Link to="/cvs" className="text-sm font-medium text-brand-700 hover:underline">
              {activeCv ? `CV: ${activeCv.label}` : "Add a CV"}
            </Link>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Paste the job description you are preparing for. Everything below, and the mock
            interview, is tailored to this and your active CV.
          </p>
          <form onSubmit={saveJd} className="mt-4">
            <TextArea
              label="Job description"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              rows={7}
              placeholder="Paste the job description..."
            />
            <div className="mt-3 flex items-center gap-3">
              <Button type="submit" loading={savingJd} disabled={!jdChanged}>
                Save
              </Button>
              {jdError && <span role="alert" className="text-sm text-red-600">{jdError}</span>}
              {!jdError && jdChanged && <span className="text-sm text-amber-600">Unsaved changes</span>}
              {!jdError && !jdChanged && hasJd && <span role="status" className="text-sm text-green-600">Saved</span>}
            </div>
          </form>
          {!activeCv && (
            <p className="mt-3 text-sm text-amber-700">
              Add a CV in{" "}
              <Link to="/cvs" className="font-medium underline">
                Manage CVs
              </Link>{" "}
              so the plan and questions can be tailored to you.
            </p>
          )}
        </CardBody>
      </Card>

      {/* Company research */}
      <Card>
        <CardBody>
          <CardTitle>Company research</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            What the company does, how they interview, and the skills they look for.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Button variant="secondary" onClick={runResearch} loading={researching}>
              {research?.research ? "Re-research company" : "Research company"}
            </Button>
            {research?.research && !researching && (
              <span role="status" className="text-sm text-green-600">Researched</span>
            )}
          </div>
          {researchError && <p role="alert" className="mt-3 text-sm text-red-600">{researchError}</p>}
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

      {/* Gap analysis + plan */}
      <Card>
        <CardBody>
          <CardTitle>Gap analysis & preparation plan</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            An honest look at where your CV is strong and where it is thin for this role, with a
            prioritised plan to prepare.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={runPlan} loading={planning}>
              {prep ? "Regenerate plan" : "Generate preparation"}
            </Button>
            {prep && prep.competencies.some((c) => c.status === "gap" || c.status === "partial") && (
              <Button onClick={() => navigate("/interview", { state: { focus: "gaps" } })}>
                Practise these in a mock interview
              </Button>
            )}
            {prep && !planning && <span role="status" className="text-sm text-green-600">Ready</span>}
          </div>
          {planError && <p role="alert" className="mt-3 text-sm text-red-600">{planError}</p>}
          {prep && (
            <div className="mt-5">
              <PreparationView report={prep} />
            </div>
          )}
        </CardBody>
      </Card>

      {/* Likely questions */}
      <Card>
        <CardBody>
          <CardTitle>Likely interview questions</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Questions you are likely to be asked, grouped by type.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={runQuestions} loading={generating}>
              {questions.length > 0 ? "Regenerate questions" : "Generate questions"}
            </Button>
            {questions.length > 0 && (
              <Button onClick={() => navigate("/interview", { state: { focus: "questions" } })}>
                Practise these in a mock interview
              </Button>
            )}
            {questions.length > 0 && !generating && (
              <span role="status" className="text-sm text-green-600">Generated</span>
            )}
          </div>
          {genError && <p role="alert" className="mt-3 text-sm text-red-600">{genError}</p>}
          {questions.length > 0 && (
            <div className="mt-5 space-y-5">
              {questions.map((group) => (
                <div key={group.category}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {group.category}
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        navigate("/interview", { state: { focus: "questions", category: group.category } })
                      }
                      className="text-xs font-medium text-brand-700 hover:underline"
                    >
                      Practise this category
                    </button>
                  </div>
                  <ol className="mt-2 space-y-3">
                    {group.questions.map((q, i) => (
                      <li key={i} className="flex gap-2.5 text-sm text-slate-800">
                        <span className="font-semibold text-brand-700">{i + 1}.</span>
                        <div>
                          <p>{q.question}</p>
                          {q.rationale && (
                            <p className="mt-0.5 text-xs text-slate-500">{q.rationale}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
