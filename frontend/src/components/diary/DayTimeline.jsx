import { Fragment } from "react";
import { Dumbbell, FolderKanban, ListTodo, Moon, Plus, Sun, Wallet } from "lucide-react";
import Check from "./Check";
import { eventColor, formatDuration, formatTime, isDone } from "./diaryUtils";

const TYPE_ICON = { task: ListTodo, project: FolderKanban, workout: Dumbbell, expense: Wallet };

function endOfDayLabel(now) {
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  const ms = end - now;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h} hrs, ${m} min`;
}

export default function DayTimeline({ events, allDay, now, isToday, onToggle, onCreate }) {
  const nowIndex = isToday ? events.findIndex((e) => e.start > now) : -1;
  const showNow = isToday && events.length > 0;
  const nowAt = nowIndex === -1 ? events.length : nowIndex;

  return (
    <section className="app-card" aria-labelledby="timeline-title">
      <div className="flex items-baseline justify-between mb-6">
        <h2 id="timeline-title" className="app-display text-3xl">Your day at a glance</h2>
        <p className="app-label">{events.length + allDay.length} items</p>
      </div>

      {allDay.length > 0 && (
        <ul className="flex flex-wrap gap-2 mb-6" aria-label="All-day">
          {allDay.map((e) => (
            <li key={e.id} className="app-pill !text-sm" style={{ boxShadow: `inset 3px 0 0 ${eventColor(e)}` }}>
              All day · {e.title}
            </li>
          ))}
        </ul>
      )}

      {events.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-xl font-semibold">Nothing scheduled</p>
          <p className="app-muted mt-1">Add a task and it will show up here.</p>
          <button type="button" className="app-button mt-5" onClick={onCreate}>
            <Plus size={18} /> Create event
          </button>
        </div>
      ) : (
        <ol className="timeline">
          <li className="timeline__cap" aria-hidden="true"><Sun size={16} /></li>
          <li aria-hidden="true" />

          {events.map((event, i) => {
            const Icon = TYPE_ICON[event.type] || ListTodo;
            const color = eventColor(event);
            const done = isDone(event);
            const duration = event.end - event.start;
            const hour = event.start.getHours();
            const showHour = i === 0 || events[i - 1].start.getHours() !== hour;
            const height = Math.min(Math.max((duration / 60000) * 1.6, 76), 170);

            return (
              <Fragment key={event.id}>
                {showNow && i === nowAt && (
                  <li className="timeline__now" aria-label={`Now, ${formatTime(now)}`}>
                    <span>{formatTime(now)}</span>
                  </li>
                )}
                <li className="contents">
                  <span className="timeline__hour" aria-hidden="true">{showHour ? String(hour).padStart(2, "0") : ""}</span>
                  <span
                    className="timeline__block"
                    data-done={done}
                    style={{ background: color, "--app-block": color, minHeight: height }}
                    aria-hidden="true"
                  >
                    <Icon size={18} strokeWidth={2.2} />
                  </span>
                  <div className="timeline__item" style={{ minHeight: height }}>
                    <div className="min-w-0">
                      <p className={`timeline__title ${done ? "app-strike" : ""}`}>{event.title}</p>
                      <p className="app-muted mt-1 tabular-nums">
                        {formatTime(event.start)}–{formatTime(event.end)} ({formatDuration(duration)})
                      </p>
                    </div>
                    <Check checked={done} color={color} onToggle={() => onToggle(event)} label={`Mark ${event.title} ${done ? "not done" : "done"}`} />
                  </div>
                </li>
              </Fragment>
            );
          })}

          {showNow && nowAt === events.length && (
            <li className="timeline__now" aria-label={`Now, ${formatTime(now)}`}>
              <span>{formatTime(now)}</span>
            </li>
          )}

          <li aria-hidden="true" />
          <li aria-hidden="true" />
          <li className="flex flex-col items-start gap-3 pt-2">
            {isToday && <p className="app-muted">End of day: {endOfDayLabel(now)}</p>}
            <button type="button" className="app-button !min-h-[40px] !text-sm" onClick={onCreate}>
              <Plus size={16} /> Create event
            </button>
          </li>
          <li aria-hidden="true" />
          <li className="timeline__cap" aria-hidden="true"><Moon size={16} /></li>
        </ol>
      )}
    </section>
  );
}
