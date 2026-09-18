import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, isSameDay } from "./diaryUtils";

export default function WeekStrip({ weekStart, selected, today, busyDays, onSelect, onShiftWeek }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const month = selected.toLocaleDateString([], { month: "long", year: "numeric" }).toLowerCase();

  return (
    <section aria-label="Week">
      <div className="flex items-center justify-between mb-3">
        <button type="button" className="app-icon-btn" onClick={() => onShiftWeek(-1)} aria-label="Previous week">
          <ChevronLeft size={22} />
        </button>
        <p className="text-lg font-medium">{month}</p>
        <button type="button" className="app-icon-btn" onClick={() => onShiftWeek(1)} aria-label="Next week">
          <ChevronRight size={22} />
        </button>
      </div>
      <div className="week-strip">
        {days.map((day) => {
          const isToday = isSameDay(day, today);
          return (
            <button
              key={day.toISOString()}
              type="button"
              className="week-strip__day"
              aria-pressed={isSameDay(day, selected)}
              aria-label={day.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
              onClick={() => onSelect(day)}
            >
              <span className="text-sm">{isToday ? "today" : day.toLocaleDateString([], { weekday: "short" }).toLowerCase()}</span>
              <span className="week-strip__num">{day.getDate()}</span>
              {busyDays.has(day.toDateString()) && <span className="week-strip__dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
