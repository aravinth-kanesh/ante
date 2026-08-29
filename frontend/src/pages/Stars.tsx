import { useEffect, useState } from "react";
import {
  createStarStory,
  deleteStarStory,
  listStarStories,
  updateStarStory,
  type StarStory,
  type StarStoryInput,
} from "../api";
import { Button, Card, CardBody, CardTitle, ErrorNote, Input, Loading, TextArea } from "../components/ui";

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

const EMPTY: StarStoryInput = { title: "", situation: "", task: "", action: "", result: "" };

const PARTS: { key: keyof StarStoryInput; label: string; hint: string }[] = [
  { key: "situation", label: "Situation", hint: "Set the scene in a sentence or two." },
  { key: "task", label: "Task", hint: "What you needed to achieve, and any constraint." },
  { key: "action", label: "Action", hint: "What you personally did, and why you chose it." },
  { key: "result", label: "Result", hint: "The outcome, with numbers where you can." },
];

export default function Stars() {
  const [stories, setStories] = useState<StarStory[] | null>(null);
  const [form, setForm] = useState<StarStoryInput>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);

  useEffect(() => {
    listStarStories()
      .then(setStories)
      .catch((err) => setError(message(err)));
  }, []);

  function edit(story: StarStory) {
    setEditingId(story.id);
    setForm({
      title: story.title,
      situation: story.situation,
      task: story.task,
      action: story.action,
      result: story.result,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancel() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      if (editingId !== null) {
        const updated = await updateStarStory(editingId, form);
        setStories((s) => (s ? s.map((x) => (x.id === editingId ? updated : x)) : s));
      } else {
        const created = await createStarStory(form);
        setStories((s) => [created, ...(s ?? [])]);
      }
      cancel();
    } catch (err) {
      setError(message(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    setError("");
    try {
      await deleteStarStory(id);
      setStories((s) => (s ? s.filter((x) => x.id !== id) : s));
      if (editingId === id) cancel();
    } catch (err) {
      setError(message(err));
    } finally {
      setConfirmId(null);
    }
  }

  const canSave = Object.values(form).some((v) => v.trim());

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">STAR stories</h1>
        <p className="mt-1 text-sm text-slate-500">
          Draft your best examples once, in the STAR shape, and reuse them across interviews.
          Strong competency answers almost always come from a handful of well-prepared stories.
        </p>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <Card>
        <CardBody className="space-y-4">
          <CardTitle>{editingId !== null ? "Edit story" : "New story"}</CardTitle>
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="A short name, e.g. Leading the group project"
          />
          {PARTS.map((part) => (
            <TextArea
              key={part.key}
              label={part.label}
              hint={part.hint}
              value={form[part.key]}
              onChange={(e) => setForm({ ...form, [part.key]: e.target.value })}
              rows={2}
            />
          ))}
          <div className="flex items-center gap-3">
            <Button onClick={save} loading={saving} disabled={!canSave}>
              {editingId !== null ? "Save changes" : "Save story"}
            </Button>
            {editingId !== null && (
              <button type="button" onClick={cancel} className="text-sm font-medium text-slate-600 hover:underline">
                Cancel
              </button>
            )}
          </div>
        </CardBody>
      </Card>

      {!stories && <Loading label="Loading your stories" />}
      {stories && stories.length === 0 && (
        <p className="text-sm text-slate-500">No stories yet. Draft your first one above.</p>
      )}

      <div className="space-y-3">
        {stories?.map((story) => (
          <Card key={story.id}>
            <CardBody className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-900">{story.title || "Untitled story"}</p>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => edit(story)}>
                    Edit
                  </Button>
                  {confirmId === story.id ? (
                    <>
                      <Button variant="destructive" size="sm" onClick={() => remove(story.id)}>
                        Delete
                      </Button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="text-sm font-medium text-slate-600 hover:underline"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setConfirmId(story.id)}>
                      Delete
                    </Button>
                  )}
                </div>
              </div>
              <dl className="space-y-1.5 text-sm">
                {PARTS.map((part) =>
                  story[part.key] ? (
                    <div key={part.key} className="flex gap-2">
                      <dt className="w-20 shrink-0 font-medium text-slate-500">{part.label}</dt>
                      <dd className="text-slate-700">{story[part.key]}</dd>
                    </div>
                  ) : null,
                )}
              </dl>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
