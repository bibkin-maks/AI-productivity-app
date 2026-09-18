import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Repeat, Trash2, X } from "lucide-react";
import Dialog from "../app/Dialog";
import { TYPE_META } from "../diary/diaryUtils";

const WEEKDAYS = [
  { label: "Mon", value: 1 }, { label: "Tue", value: 2 }, { label: "Wed", value: 3 }, { label: "Thu", value: 4 },
  { label: "Fri", value: 5 }, { label: "Sat", value: 6 }, { label: "Sun", value: 0 },
];
const STATUSES = [["pending", "To do"], ["in_progress", "Doing"], ["completed", "Done"], ["blocked", "Blocked"]];
const PRIORITIES = [["low", "Low"], ["medium", "Medium"], ["high", "High"]];
const REPEATS = [
  ["none", "Doesn't repeat"], ["daily", "Every day"], ["weekdays", "On specific weekdays"], ["weekly", "Every week"],
  ["biweekly", "Every 2 weeks"], ["every_n_weeks", "Every N weeks"], ["monthly", "Every month"], ["yearly", "Every year"],
];
const SWATCHES = ["#0a84ff", "#5e5ce6", "#bf5af2", "#ff2d55", "#ff5a1f", "#ff9f0a", "#30d158", "#8e8e93"];
const AUTO_COLOR = "#3788d8";
const EXERCISE_TYPES = [["count", "Sets × reps"], ["single", "Value"], ["tick", "Checkbox"], ["text", "Note"]];

const pad = (n) => String(n).padStart(2, "0");
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function withDate(date, value) {
  const [y, m, day] = value.split("-").map(Number);
  const d = new Date(date);
  d.setFullYear(y, m - 1, day);
  return d;
}

function withTime(date, value) {
  const [h, min] = value.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, min, 0, 0);
  return d;
}

export function repeatSummary(draft) {
  const start = new Date(draft.start);
  const until = draft.recurrenceEnd ? ` until ${new Date(draft.recurrenceEnd).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}` : "";
  switch (draft.recurrence) {
    case "daily": return `Every day${until}`;
    case "weekly": return `Every ${start.toLocaleDateString([], { weekday: "long" })}${until}`;
    case "biweekly": return `Every other ${start.toLocaleDateString([], { weekday: "long" })}${until}`;
    case "every_n_weeks": return `Every ${draft.recurrenceInterval || 2} weeks on ${start.toLocaleDateString([], { weekday: "long" })}${until}`;
    case "monthly": return `Every month on day ${start.getDate()}${until}`;
    case "yearly": return `Every year on ${start.toLocaleDateString([], { month: "long", day: "numeric" })}${until}`;
    case "weekdays": {
      const days = WEEKDAYS.filter((d) => (draft.recurrenceDays || []).includes(d.value)).map((d) => d.label);
      return days.length ? `Every ${days.join(", ")}${until}` : "Pick at least one day";
    }
    default: return "";
  }
}

function validate(draft) {
  if (!draft.title.trim()) return { field: "title", message: "Give the event a title." };
  if (!draft.allDay && new Date(draft.end) <= new Date(draft.start)) return { field: "end", message: "End time must be after the start." };
  if (draft.allDay && new Date(draft.end) < new Date(draft.start)) return { field: "end", message: "End date can't be before the start date." };
  if (draft.recurrence === "weekdays" && !(draft.recurrenceDays || []).length) return { field: "repeat", message: "Pick at least one weekday to repeat on." };
  if (draft.recurrence !== "none" && draft.recurrenceEnd && new Date(draft.recurrenceEnd) < new Date(draft.start).setHours(0, 0, 0, 0)) {
    return { field: "repeat", message: "The repeat end date is before the event starts." };
  }
  return null;
}

function Segmented({ label, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="app-seg">
      {options.map(([id, text, dot]) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} className="app-seg__opt" onClick={() => onChange(id)}>
          {dot && <span className="w-2 h-2 rounded-full" style={{ background: dot }} aria-hidden="true" />}
          {text}
        </button>
      ))}
    </div>
  );
}

export default function EventSheet({
  open, mode, initial, isOccurrence, theme, presets, saving,
  onClose, onSave, onDelete, onManagePresets,
}) {
  const [draft, setDraft] = useState(initial);
  const [problem, setProblem] = useState(null);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(initial);
      setProblem(null);
      setSaveError("");
    }
  }, [open, initial]);

  const set = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setProblem(null);
  };

  const start = useMemo(() => new Date(draft?.start), [draft?.start]);
  const end = useMemo(() => new Date(draft?.end), [draft?.end]);
  if (!draft) return null;

  const duration = end - start;
  const setStart = (next) => set({ start: next, end: new Date(next.getTime() + Math.max(duration, draft.allDay ? 0 : 15 * 60000)) });

  const toggleAllDay = (allDay) => {
    if (allDay) {
      const s = new Date(start); s.setHours(0, 0, 0, 0);
      const e = new Date(end < s ? s : end); e.setHours(23, 59, 0, 0);
      set({ allDay, start: s, end: e });
    } else {
      const s = new Date(start); s.setHours(9, 0, 0, 0);
      set({ allDay, start: s, end: new Date(s.getTime() + 3600000) });
    }
  };

  const log = draft.workoutLog || [];
  const setLog = (next) => set({ workoutLog: next });
  const updateExercise = (i, patch) => setLog(log.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));

  const loadPreset = (preset) => {
    set({
      type: "workout",
      title: draft.title || preset.name,
      workoutLog: preset.exercises.map((ex) => ({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: typeof ex === "string" ? ex : ex.name,
        type: (typeof ex === "object" && ex.type) || "count",
        sets: "", reps: "", weight: "", value: "", comment: "", completed: false,
      })),
    });
  };

  const submit = async (e) => {
    e?.preventDefault();
    const issue = validate(draft);
    if (issue) {
      setProblem(issue);
      document.getElementById(`event-${issue.field}`)?.focus();
      return;
    }
    setSaveError("");
    try {
      await onSave({ ...draft, title: draft.title.trim() });
    } catch (err) {
      setSaveError(err?.message || "Couldn't save. Please try again.");
    }
  };

  const typeOptions = Object.entries(TYPE_META).map(([id, meta]) => [id, meta.label, meta.color]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      variant="sheet"
      theme={theme}
      title={mode === "create" ? "New event" : "Edit event"}
      description={isOccurrence ? "This is one date of a repeating event. You'll choose what to change when saving." : start.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
      initialFocus="#event-title"
      footer={
        <>
          {(problem || saveError) && (
            <p className="w-full text-sm text-[var(--app-high)] mb-1" role="alert">{problem?.message || saveError}</p>
          )}
          {mode === "edit" && (
            <button type="button" className="app-button !bg-transparent !text-[var(--app-high)] hover:!bg-[var(--app-surface-2)]" onClick={onDelete} disabled={saving}>
              <Trash2 size={16} /> Delete
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" className="app-button" onClick={onClose}>Cancel</button>
            <button type="submit" form="event-form" className="app-button app-button--signal" disabled={saving}>
              {saving && <Loader2 size={16} className="animate-spin" />}
              {mode === "create" ? "Create" : "Save"}
            </button>
          </div>
        </>
      }
    >
      <form id="event-form" onSubmit={submit} className="space-y-6" noValidate>
        <div>
          <label htmlFor="event-title" className="sr-only">Title</label>
          <input
            id="event-title"
            className="app-title-input"
            placeholder={draft.type === "expense" ? "e.g. Server subscription" : draft.type === "workout" ? "e.g. Push day" : "What's happening?"}
            value={draft.title}
            onChange={(e) => set({ title: e.target.value })}
            aria-invalid={problem?.field === "title"}
            autoComplete="off"
          />
        </div>

        <div className="app-field">
          <span className="app-field__label">Type</span>
          <Segmented label="Type" options={typeOptions} value={draft.type || "task"} onChange={(type) => set({ type })} />
        </div>

        {/* When */}
        <div className="app-field" role="group" aria-labelledby="event-when-label">
          <div className="flex items-center justify-between mb-2">
            <span id="event-when-label" className="app-field__label !mb-0">When</span>
            <label className="app-switch">
              <input type="checkbox" checked={Boolean(draft.allDay)} onChange={(e) => toggleAllDay(e.target.checked)} />
              <span aria-hidden="true" />
              All day
            </label>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <label className="sr-only" htmlFor="event-start-date">Start date</label>
            <input id="event-start-date" type="date" className="app-input" value={toDateInput(start)} onChange={(e) => e.target.value && setStart(withDate(start, e.target.value))} />
            {!draft.allDay && (
              <>
                <label className="sr-only" htmlFor="event-start-time">Start time</label>
                <input id="event-start-time" type="time" step={300} className="app-input" value={toTimeInput(start)} onChange={(e) => e.target.value && setStart(withTime(start, e.target.value))} />
              </>
            )}
            <label className="sr-only" htmlFor="event-end">End date</label>
            <input id="event-end" type="date" className="app-input" value={toDateInput(end)} onChange={(e) => e.target.value && set({ end: withDate(end, e.target.value) })} aria-invalid={problem?.field === "end"} />
            {!draft.allDay && (
              <>
                <label className="sr-only" htmlFor="event-end-time">End time</label>
                <input id="event-end-time" type="time" step={300} className="app-input" value={toTimeInput(end)} onChange={(e) => e.target.value && set({ end: withTime(end, e.target.value) })} aria-invalid={problem?.field === "end"} />
              </>
            )}
          </div>
        </div>

        {/* Repeat */}
        <div className="app-field">
          <label htmlFor="event-repeat" className="app-field__label">Repeat</label>
          <select
            id="event-repeat"
            className="app-input"
            value={draft.recurrence || "none"}
            onChange={(e) => set({ recurrence: e.target.value, recurrenceDays: e.target.value === "weekdays" && !(draft.recurrenceDays || []).length ? [start.getDay()] : draft.recurrenceDays })}
            aria-invalid={problem?.field === "repeat"}
          >
            {REPEATS.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
          </select>

          {draft.recurrence === "weekdays" && (
            <div className="flex flex-wrap gap-1.5 mt-3" role="group" aria-label="Repeat on">
              {WEEKDAYS.map((d) => {
                const active = (draft.recurrenceDays || []).includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    aria-pressed={active}
                    className="app-day-pill"
                    onClick={() => set({ recurrenceDays: active ? draft.recurrenceDays.filter((x) => x !== d.value) : [...(draft.recurrenceDays || []), d.value] })}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          )}

          {draft.recurrence === "every_n_weeks" && (
            <label className="flex items-center gap-3 mt-3">
              <span className="app-muted">Every</span>
              <input
                type="number" min={1} max={52} className="app-input !w-20 text-center"
                value={draft.recurrenceInterval || 2}
                onChange={(e) => set({ recurrenceInterval: Math.min(52, Math.max(1, parseInt(e.target.value, 10) || 1)) })}
              />
              <span className="app-muted">weeks</span>
            </label>
          )}

          {draft.recurrence && draft.recurrence !== "none" && (
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <label htmlFor="event-until" className="app-muted">Ends</label>
              <input
                id="event-until" type="date" className="app-input !w-auto"
                value={draft.recurrenceEnd ? toDateInput(new Date(draft.recurrenceEnd)) : ""}
                onChange={(e) => set({ recurrenceEnd: e.target.value ? withTime(withDate(start, e.target.value), "23:59") : null })}
              />
              {draft.recurrenceEnd && (
                <button type="button" className="text-sm underline underline-offset-4 app-muted" onClick={() => set({ recurrenceEnd: null })}>Never</button>
              )}
              <p className="w-full text-sm flex items-center gap-2"><Repeat size={14} className="text-[var(--app-signal)]" aria-hidden="true" />{repeatSummary(draft)}</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="app-field">
            <span className="app-field__label">Status</span>
            <Segmented label="Status" options={STATUSES} value={draft.status || "pending"} onChange={(status) => set({ status })} />
          </div>
          <div className="app-field">
            <span className="app-field__label">Priority</span>
            <Segmented label="Priority" options={PRIORITIES} value={draft.priority || "medium"} onChange={(priority) => set({ priority })} />
          </div>
        </div>

        {draft.type === "expense" && (
          <div className="app-field">
            <label htmlFor="event-amount" className="app-field__label">Amount</label>
            <input
              id="event-amount" type="number" inputMode="decimal" step="0.01" min="0" className="app-input !w-40 tabular-nums"
              placeholder="0.00" value={draft.amount ?? ""} onChange={(e) => set({ amount: e.target.value })}
            />
          </div>
        )}

        <div className="app-field">
          <span className="app-field__label">Colour</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
            <button type="button" role="radio" aria-checked={!draft.color || draft.color === AUTO_COLOR} className="app-swatch app-swatch--auto" onClick={() => set({ color: AUTO_COLOR })}>
              Auto
            </button>
            {SWATCHES.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={draft.color === c} aria-label={c} className="app-swatch" style={{ background: c }} onClick={() => set({ color: c })} />
            ))}
          </div>
        </div>

        <div className="app-field">
          <label htmlFor="event-description" className="app-field__label">Notes</label>
          <textarea id="event-description" rows={3} className="app-input resize-y" placeholder="Details, links, anything useful…" value={draft.description || ""} onChange={(e) => set({ description: e.target.value })} />
        </div>

        {draft.type === "workout" && (
          <section className="app-field" aria-labelledby="workout-label">
            <div className="flex items-center justify-between">
              <span id="workout-label" className="app-field__label !mb-0">Workout log · {log.length}</span>
              <button type="button" className="text-sm underline underline-offset-4 app-muted" onClick={onManagePresets}>Manage presets</button>
            </div>
            {presets.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {presets.map((p) => (
                  <button key={p.id} type="button" className="app-pill !text-sm hover:!bg-[var(--app-surface-3)]" onClick={() => loadPreset(p)}>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            <ul className="mt-3 space-y-2">
              {log.map((item, i) => (
                <li key={item.id || i} className="rounded-xl bg-[var(--app-surface-2)] p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input className="app-input !bg-transparent !px-0 font-semibold" placeholder="Exercise name" aria-label={`Exercise ${i + 1} name`} value={item.name} onChange={(e) => updateExercise(i, { name: e.target.value })} />
                    <select className="app-input !w-auto !py-1.5 text-sm" aria-label={`Exercise ${i + 1} tracking`} value={item.type} onChange={(e) => updateExercise(i, { type: e.target.value })}>
                      {EXERCISE_TYPES.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
                    </select>
                    <button type="button" className="app-icon-btn !w-9 !h-9" onClick={() => setLog(log.filter((_, idx) => idx !== i))} aria-label={`Remove ${item.name || "exercise"}`}>
                      <X size={16} />
                    </button>
                  </div>
                  {item.type === "count" && (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <input className="app-input !w-16 text-center" inputMode="numeric" placeholder="Sets" aria-label="Sets" value={item.sets ?? ""} onChange={(e) => updateExercise(i, { sets: e.target.value })} />
                      <span className="app-muted">×</span>
                      <input className="app-input !w-16 text-center" inputMode="numeric" placeholder="Reps" aria-label="Reps" value={item.reps ?? ""} onChange={(e) => updateExercise(i, { reps: e.target.value })} />
                      <input className="app-input !w-24 text-center" inputMode="decimal" placeholder="kg" aria-label="Weight in kg" value={item.weight ?? ""} onChange={(e) => updateExercise(i, { weight: e.target.value })} />
                    </div>
                  )}
                  {item.type === "single" && (
                    <input className="app-input !w-32" placeholder="Value" aria-label="Value" value={item.value ?? ""} onChange={(e) => updateExercise(i, { value: e.target.value })} />
                  )}
                  {item.type === "text" && (
                    <input className="app-input" placeholder="Note" aria-label="Note" value={item.value ?? ""} onChange={(e) => updateExercise(i, { value: e.target.value })} />
                  )}
                  {item.type === "tick" && (
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="accent-[var(--app-signal)] w-4 h-4" checked={Boolean(item.completed)} onChange={(e) => updateExercise(i, { completed: e.target.checked })} />
                      Done
                    </label>
                  )}
                </li>
              ))}
            </ul>
            {log.length < 20 && (
              <button
                type="button"
                className="app-button w-full mt-2"
                onClick={() => setLog([...log, { id: `${Date.now()}`, name: "", type: "count", sets: "", reps: "", weight: "", value: "", comment: "", completed: false }])}
              >
                <Plus size={16} /> Add exercise
              </button>
            )}
          </section>
        )}
      </form>
    </Dialog>
  );
}
