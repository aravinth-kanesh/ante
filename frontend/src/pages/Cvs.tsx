import { useEffect, useState, type ChangeEvent } from "react";
import {
  createCv,
  deleteCv,
  getCv,
  listCvs,
  renameCv,
  selectCv,
  updateCvText,
  uploadCvFile,
  type Cv,
} from "../api";
import { Badge, Button, Card, CardBody, CardTitle, Input, Loading, TextArea } from "../components/ui";

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export default function Cvs() {
  const [cvs, setCvs] = useState<Cv[] | null>(null);
  const [error, setError] = useState("");

  const [newLabel, setNewLabel] = useState("");
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [viewText, setViewText] = useState("");
  const [viewLoading, setViewLoading] = useState(false);
  const [savingText, setSavingText] = useState(false);

  async function refresh() {
    try {
      setCvs(await listCvs());
    } catch (err) {
      setError(message(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAdding(true);
    setAddError("");
    try {
      await uploadCvFile(file, newLabel.trim());
      setNewLabel("");
      await refresh();
    } catch (err) {
      setAddError(message(err));
    } finally {
      setAdding(false);
    }
  }

  async function onPaste() {
    setAdding(true);
    setAddError("");
    try {
      await createCv(newLabel.trim() || "My CV", newText);
      setNewLabel("");
      setNewText("");
      await refresh();
    } catch (err) {
      setAddError(message(err));
    } finally {
      setAdding(false);
    }
  }

  async function act(id: number, fn: () => Promise<unknown>) {
    setBusyId(id);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusyId(null);
    }
  }

  function startRename(cv: Cv) {
    setEditingId(cv.id);
    setEditLabel(cv.label);
  }

  async function toggleView(cv: Cv) {
    if (viewingId === cv.id) {
      setViewingId(null);
      return;
    }
    setViewingId(cv.id);
    setViewText("");
    setViewLoading(true);
    setError("");
    try {
      const detail = await getCv(cv.id);
      setViewText(detail.text);
    } catch (err) {
      setError(message(err));
      setViewingId(null);
    } finally {
      setViewLoading(false);
    }
  }

  async function saveText(id: number) {
    setSavingText(true);
    setError("");
    try {
      await updateCvText(id, viewText);
      await refresh();
    } catch (err) {
      setError(message(err));
    } finally {
      setSavingText(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Your CVs</h1>
        <p className="mt-1 text-sm text-slate-500">
          Keep separate CVs for different industries and roles, and choose which one your mock
          interviews use.
        </p>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {/* Add a CV */}
      <Card>
        <CardBody className="space-y-4">
          <CardTitle>Add a CV</CardTitle>
          <div>
            <Input
              label="Label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Finance CV, Tech CV"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label
              className={`inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 ${
                adding ? "cursor-default opacity-70" : "cursor-pointer"
              }`}
            >
              {adding ? "Working..." : "Upload a file"}
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={onUpload}
                disabled={adding}
                className="hidden"
              />
            </label>
            <span className="text-sm text-slate-500">or paste below</span>
          </div>
          <div>
            <TextArea
              label="Paste CV text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              rows={5}
              placeholder="Paste your CV text..."
            />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={onPaste} loading={adding} disabled={!newText.trim()}>
              Save pasted CV
            </Button>
            {addError && <span role="alert" className="text-sm text-red-600">{addError}</span>}
          </div>
        </CardBody>
      </Card>

      {/* List */}
      {!cvs && <Loading label="Loading your CVs" />}
      {cvs && cvs.length === 0 && (
        <p className="text-sm text-slate-500">No CVs yet. Add one above to get started.</p>
      )}
      <div className="space-y-3">
        {cvs?.map((cv) => (
          <Card key={cv.id}>
            <CardBody className="space-y-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                {editingId === cv.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="max-w-xs"
                    />
                    <Button
                      size="sm"
                      loading={busyId === cv.id}
                      onClick={() =>
                        act(cv.id, () => renameCv(cv.id, editLabel)).then(() => setEditingId(null))
                      }
                    >
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-slate-900">{cv.label}</span>
                    {cv.selected && <Badge color="green">Active</Badge>}
                  </div>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  {cv.filename ? `${cv.filename} · ` : ""}
                  {new Date(cv.created_at).toLocaleDateString("en-GB")}
                </p>
              </div>
              {editingId !== cv.id && (
                <div className="flex shrink-0 items-center gap-2">
                  {!cv.selected && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busyId === cv.id}
                      onClick={() => act(cv.id, () => selectCv(cv.id))}
                    >
                      Use this CV
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => toggleView(cv)}>
                    {viewingId === cv.id ? "Hide" : "View"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => startRename(cv)}>
                    Rename
                  </Button>
                  {confirmDeleteId === cv.id ? (
                    <>
                      <Button
                        size="sm"
                        variant="destructive"
                        loading={busyId === cv.id}
                        onClick={() =>
                          act(cv.id, () => deleteCv(cv.id)).then(() => setConfirmDeleteId(null))
                        }
                      >
                        Delete permanently
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="danger" onClick={() => setConfirmDeleteId(cv.id)}>
                      Delete
                    </Button>
                  )}
                </div>
              )}
              </div>

              {viewingId === cv.id && (
                <div className="border-t border-slate-200 pt-4">
                  {viewLoading ? (
                    <Loading label="Loading CV text" />
                  ) : (
                    <>
                      <TextArea
                        label="Extracted CV text"
                        hint="This is the text the interviewer reads. You can correct it if the file did not extract cleanly."
                        value={viewText}
                        onChange={(e) => setViewText(e.target.value)}
                        rows={14}
                        className="font-mono text-xs leading-relaxed"
                      />
                      <div className="mt-3 flex items-center gap-3">
                        <Button
                          size="sm"
                          loading={savingText}
                          disabled={!viewText.trim()}
                          onClick={() => saveText(cv.id)}
                        >
                          Save changes
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setViewingId(null)}>
                          Close
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
