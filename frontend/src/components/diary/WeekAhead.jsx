import { ArrowRight } from "lucide-react";

export default function WeekAhead({ days, onSelect }) {
  return (
    <section className="app-card !pb-2" aria-labelledby="ahead-title">
      <h2 id="ahead-title" className="app-label mb-2">Coming up</h2>
      <ul>
        {days.map(({ day, count }) => (
          <li key={day.toISOString()}>
            <button type="button" className="week-row" onClick={() => onSelect(day)}>
              <span>
                <span className="app-display week-row__name block">{day.toLocaleDateString([], { weekday: "long" })}</span>
                <span className="app-muted text-sm">{day.toLocaleDateString([], { month: "long", day: "numeric" })}</span>
              </span>
              <span className="flex items-center gap-3 app-muted">
                <span className="tabular-nums">{count ? `${count} planned` : "free"}</span>
                <ArrowRight size={18} aria-hidden="true" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
