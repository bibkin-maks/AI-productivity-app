import { useEffect, useState } from "react";
import { ArrowRight, Plus, Trash2, X } from "lucide-react";
import Dialog from "../app/Dialog";

// ------------------------------------------------------------ scope picker

export function ScopeDialog({ open, action, occurrenceDate, theme, onChoose, onClose }) {
  const deleting = action === "delete";
  const day = occurrenceDate ? new Date(occurrenceDate).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }) : "this date";
  const options = [
    ["this", deleting ? `Only ${day}` : `Only ${day}`, deleting ? "The rest of the series stays." : "Changes apply to this date only."],
    ["following", deleting ? "This and all later dates" : "This and all later dates", deleting ? "Earlier dates stay." : "Earlier dates keep the old details."],
    ["all", deleting ? "The whole series" : "Every date in the series", deleting ? "Removes every occurrence." : "Past and future dates change."],
  ];
  return (
    <Dialog open={open} onClose={onClose} theme={theme} title={deleting ? "Delete repeating event" : "Save repeating event"} description="This event repeats. What should change?">
      <ul>
        {options.map(([scope, title, hint]) => (
          <li key={scope}>
            <button type="button" className="chat-suggest !text-base" onClick={() => onChoose(scope)}>
              <span className="flex-1">
                <span className={`block font-semibold ${deleting && scope === "all" ? "text-[var(--app-high)]" : ""}`}>{title}</span>
                <span className="block text-sm app-muted">{hint}</span>
              </span>
              <ArrowRight size={18} className="text-[var(--app-text-3)]" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

// ------------------------------------------------------------ presets

const blankPreset = () => ({ name: "", exercises: [{ name: "", type: "count" }] });

export function PresetsDialog({ open, presets, theme, onChange, onClose }) {
  const [form, setForm] = useState(blankPreset);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(blankPreset());
      setError("");
    }
  }, [open]);

  const save = (e) => {
    e.preventDefault();
    const exercises = form.exercises.filter((ex) => ex.name.trim());
    if (!form.name.trim()) return setError("Name the preset.");
    if (!exercises.length) return setError("Add at least one exercise.");
    onChange([...presets, { id: `${Date.now()}`, name: form.name.trim(), exercises }]);
    setForm(blankPreset());
    setError("");
  };

  const setExercise = (i, patch) => setForm((f) => ({ ...f, exercises: f.exercises.map((ex, idx) => (idx === i ? { ...ex, ...patch } : ex)) }));

  return (
    <Dialog open={open} onClose={onClose} theme={theme} title="Workout presets" description="Load a preset into a workout to fill its exercise list.">
      <div className="space-y-8">
        <section aria-label="Saved presets">
          {presets.length === 0 ? (
            <p className="app-muted">No presets yet.</p>
          ) : (
            <ul>
              {presets.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3 border-t border-[var(--app-line-strong)] last:border-b">
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold">{p.name}</span>
                    <span className="block text-sm app-muted truncate">{p.exercises.map((ex) => (typeof ex === "string" ? ex : ex.name)).join(" · ")}</span>
                  </span>
                  <button type="button" className="app-icon-btn" onClick={() => onChange(presets.filter((x) => x.id !== p.id))} aria-label={`Delete preset ${p.name}`}>
                    <Trash2 size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form onSubmit={save} className="space-y-3" aria-label="New preset">
          <p className="app-label">New preset</p>
          <input className="app-input" placeholder="Preset name, e.g. Leg day" aria-label="Preset name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          {form.exercises.map((ex, i) => (
            <div key={i} className="flex gap-2">
              <input className="app-input" placeholder={`Exercise ${i + 1}`} aria-label={`Exercise ${i + 1}`} value={ex.name} onChange={(e) => setExercise(i, { name: e.target.value })} />
              <select className="app-input !w-auto" aria-label={`Exercise ${i + 1} tracking`} value={ex.type} onChange={(e) => setExercise(i, { type: e.target.value })}>
                <option value="count">Sets × reps</option>
                <option value="single">Value</option>
                <option value="tick">Checkbox</option>
                <option value="text">Note</option>
              </select>
              {form.exercises.length > 1 && (
                <button type="button" className="app-icon-btn flex-none" onClick={() => setForm({ ...form, exercises: form.exercises.filter((_, idx) => idx !== i) })} aria-label={`Remove exercise ${i + 1}`}>
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="app-button" onClick={() => setForm({ ...form, exercises: [...form.exercises, { name: "", type: "count" }] })}>
              <Plus size={16} /> Exercise
            </button>
            <button type="submit" className="app-button app-button--signal ml-auto">Save preset</button>
          </div>
          {error && <p className="text-sm text-[var(--app-high)]" role="alert">{error}</p>}
        </form>
      </div>
    </Dialog>
  );
}

// ------------------------------------------------------------ clear everything

export function ClearAllDialog({ open, count, theme, busy, onConfirm, onClose }) {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);
  const armed = typed.trim().toLowerCase() === "delete";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      theme={theme}
      title="Delete all events"
      description={`This removes all ${count} saved event${count === 1 ? "" : "s"}, including repeating series. You can undo right after, but not once you leave this page.`}
      initialFocus="#clear-confirm"
      footer={
        <div className="ml-auto flex gap-2">
          <button type="button" className="app-button" onClick={onClose}>Cancel</button>
          <button type="button" className="app-button app-button--danger" disabled={!armed || busy} onClick={onConfirm}>
            Delete everything
          </button>
        </div>
      }
    >
      <label htmlFor="clear-confirm" className="block mb-2">
        Type <strong>delete</strong> to confirm
      </label>
      <input id="clear-confirm" className="app-input" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
    </Dialog>
  );
}
