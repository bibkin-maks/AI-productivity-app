import { useState } from "react";
import { Plus } from "lucide-react";
import Check from "./Check";
import { PRIORITY_ORDER, TYPE_META, formatDuration, formatTime, isDone } from "./diaryUtils";

const TAG_LABEL = { high: "High", medium: "Med", low: "Low" };

export default function HitList({ items, isToday, onToggle, onAdd }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const sorted = [...items].sort(
    (a, b) =>
      Number(isDone(a)) - Number(isDone(b)) ||
      (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1) ||
      a.start - b.start
  );
  const remaining = items.filter((e) => !isDone(e)).length;

  const submit = async (e) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title || saving) return;
    setSaving(true);
    setError("");
    try {
      await onAdd(title);
      setDraft("");
    } catch {
      setError("Couldn't add that task. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="app-card" aria-labelledby="hitlist-title">
      <div className="flex items-baseline justify-between mb-4">
        <h2 id="hitlist-title" className="app-display text-3xl">{isToday ? "Today's hit list" : "Hit list"}</h2>
        <p className="font-medium tabular-nums">
          <span className="text-2xl">{String(remaining).padStart(2, "0")}</span>{" "}
          <span className="app-label">remaining</span>
        </p>
      </div>

      {sorted.length === 0 ? (
        <p className="app-muted py-6 border-y-[1.5px] border-[var(--app-line-strong)]">No tasks yet. Add your first one below.</p>
      ) : (
        <ul>
          {sorted.map((item) => {
            const done = isDone(item);
            return (
              <li key={item.id} className="hit-row">
                <Check checked={done} onToggle={() => onToggle(item)} label={`Mark ${item.title} ${done ? "not done" : "done"}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-lg font-semibold leading-tight truncate ${done ? "app-strike" : ""}`}>{item.title}</p>
                  <p className="app-muted text-sm mt-1 flex items-center gap-2 flex-wrap">
                    {(TYPE_META[item.type] || TYPE_META.task).label}
                    {!item.allDay && <> · {formatTime(item.start)}</>}
                    {!item.allDay && <span className="app-pill !text-[11px]">{formatDuration(item.end - item.start)}</span>}
                  </p>
                </div>
                <span className={`app-tag app-tag--${done ? "done" : item.priority || "medium"}`}>
                  {done ? "Done" : TAG_LABEL[item.priority] || "Med"}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={submit} className="flex items-center gap-3 mt-2">
        <Plus size={18} className="text-[var(--app-text-3)]" aria-hidden="true" />
        <label htmlFor="quick-add" className="sr-only">Add a new task</label>
        <input
          id="quick-add"
          className="quick-add"
          placeholder="Add a new task..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={saving}
          autoComplete="off"
        />
      </form>
      {error && <p className="text-sm mt-2 text-[var(--app-high)]" role="alert">{error}</p>}
    </section>
  );
}
