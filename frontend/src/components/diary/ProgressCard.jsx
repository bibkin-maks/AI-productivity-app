import { formatDuration, formatTime } from "./diaryUtils";

export default function ProgressCard({ done, total, plannedMs, nextUp, isToday }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const dots = Math.min(Math.max(total, 10), 20);
  const filled = total ? Math.round((done / total) * dots) : 0;

  return (
    <section className="app-card" aria-label="Progress">
      <div className="flex items-start justify-between gap-4">
        <p className="app-muted leading-tight">
          {isToday ? "today's" : "this day's"} plan
          <br />
          goal
        </p>
        <p className="font-medium">
          {done}/{total} completed
        </p>
      </div>

      <div className="flex items-end justify-between gap-6 mt-6">
        <p className="app-numeral text-[clamp(88px,11vw,140px)]">
          {pct}
          <span className="text-[0.6em]">%</span>
        </p>
        <div className="progress-dots mb-3" role="img" aria-label={`${done} of ${total} done`}>
          {Array.from({ length: dots }, (_, i) => (
            <span key={i} data-on={i < filled} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-6">
        <div className="rounded-xl p-4 bg-[var(--app-surface-2)]">
          <p className="text-sm app-muted">Remaining</p>
          <p className="text-2xl font-semibold mt-3">{total - done}</p>
        </div>
        <div className="rounded-xl p-4 bg-[var(--app-surface-2)]">
          <p className="text-sm app-muted">Planned time</p>
          <p className="text-2xl font-semibold mt-3">{plannedMs ? formatDuration(plannedMs) : "—"}</p>
        </div>
        <div className="rounded-xl p-4 bg-[var(--app-surface-2)] col-span-2 sm:col-span-1 min-w-0">
          <p className="text-sm app-muted">Next up</p>
          <p className="text-2xl font-semibold mt-3 truncate" title={nextUp?.title}>
            {nextUp ? nextUp.title : "All clear"}
          </p>
          {nextUp && <p className="text-sm app-muted">{formatTime(nextUp.start)}</p>}
        </div>
      </div>
    </section>
  );
}
