import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getHealth, getProfile, listCvs, saveJobDescription, type Cv } from "../api";
import { useAuth } from "../auth/AuthContext";
import Logo from "../components/Logo";
import { Badge, Button, Card, CardBody, CardTitle, Label, TextArea } from "../components/ui";

export default function Dashboard() {
  const { user } = useAuth();
  const [health, setHealth] = useState<"checking" | "ok" | "down">("checking");
  const [model, setModel] = useState("");

  const [activeCv, setActiveCv] = useState<Cv | null>(null);
  const [jd, setJd] = useState("");
  const [savedJd, setSavedJd] = useState(""); // what is persisted, to show saved state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

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

      {/* Two paths: prepare, then interview */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card className="overflow-hidden">
          <Link to="/prepare" className="block h-full">
            <div className="flex h-full flex-col justify-between gap-4 bg-gradient-to-br from-slate-700 to-slate-900 p-6 text-white">
              <div>
                <h2 className="text-xl font-semibold">Prepare</h2>
                <p className="mt-1 text-sm text-slate-300">
                  Research the company, see where you fit the role, and get a plan and likely
                  questions.
                </p>
              </div>
              <span className="text-sm font-semibold text-white">Start preparing</span>
            </div>
          </Link>
        </Card>

        <Card className="overflow-hidden">
          <Link to="/interview" className="block h-full">
            <div className="flex h-full flex-col justify-between gap-4 bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white">
              <div>
                <h2 className="text-xl font-semibold">Mock interview</h2>
                <p className="mt-1 text-sm text-brand-100">
                  An adaptive interview with spoken questions and feedback on your answers and
                  delivery.
                </p>
              </div>
              <span className="text-sm font-semibold text-white">Start interview</span>
            </div>
          </Link>
        </Card>
      </div>

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

        {/* Job description */}
        <Card>
          <CardBody>
            <CardTitle>Job description</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Paste the job description you are preparing for. It is used across Prepare and the
              interview.
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
      </div>
    </div>
  );
}
