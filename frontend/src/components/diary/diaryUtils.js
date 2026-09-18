import { generateRecurringEvents } from "../../utils/calendar";

export const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_API_COLOR = "#3788d8";

export const TYPE_META = {
  task: { label: "Task", color: "#0a84ff" },
  project: { label: "Project", color: "#bf5af2" },
  workout: { label: "Workout", color: "#ff9f0a" },
  expense: { label: "Expense", color: "#30d158" },
};

export const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

// ---------- dates ----------

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isSameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

// Weeks start on Monday
export function startOfWeek(date) {
  const d = startOfDay(date);
  const offset = (d.getDay() + 6) % 7;
  return addDays(d, -offset);
}

// Same YYYY-MM-DD convention the calendar uses for exceptDates
export function exceptKey(date) {
  return new Date(date).toISOString().split("T")[0];
}

export function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function formatDuration(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// ---------- events ----------

export function eventColor(event) {
  if (event.color && event.color !== DEFAULT_API_COLOR) return event.color;
  return (TYPE_META[event.type] || TYPE_META.task).color;
}

export const isDone = (event) => event.status === "completed";

// Stored events + recurrence instances that fall inside [rangeStart, rangeEnd)
export function expandEvents(events, rangeStart, rangeEnd) {
  const out = [];
  for (const raw of events || []) {
    const event = { ...raw, start: new Date(raw.start), end: new Date(raw.end) };
    const inRange = event.start < rangeEnd && event.end >= rangeStart;
    const recurring = event.recurrence && event.recurrence !== "none";

    if (recurring) {
      const excepted = (event.exceptDates || []).includes(exceptKey(event.start));
      if (inRange && !excepted) out.push(event);
      out.push(...generateRecurringEvents(event, rangeStart, rangeEnd).map((e) => ({
        ...e,
        start: new Date(e.start),
        end: new Date(e.end),
      })));
    } else if (inRange) {
      out.push(event);
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

export function eventsOnDay(expanded, day) {
  const from = startOfDay(day);
  const to = addDays(from, 1);
  return expanded.filter((e) => e.start < to && (e.end > from || e.start >= from));
}

// Full payload the API's Create/UpdateEventRequest expects
export function toApiEvent(event) {
  const iso = (d) => new Date(d).toISOString().replace("Z", "+00:00");
  return {
    ...(event.id ? { id: event.id } : {}),
    title: event.title || "Untitled",
    start: iso(event.start),
    end: iso(event.end),
    allDay: Boolean(event.allDay),
    color: event.color || DEFAULT_API_COLOR,
    description: event.description || "",
    seriesId: event.seriesId ?? null,
    recurrence: event.recurrence || "none",
    recurrenceEnd: event.recurrenceEnd ? iso(event.recurrenceEnd) : null,
    recurrenceDays: event.recurrenceDays || [],
    recurrenceInterval: event.recurrenceInterval || 1,
    workoutLog: (event.workoutLog || []).map(({ name, type, sets, reps, value, completed, weight, comment, id }) => ({
      id, name: name || "", type: type || "tick", sets, reps, value, completed, weight, comment,
    })),
    type: event.type || "task",
    status: event.status || "pending",
    priority: event.priority || "medium",
    exceptDates: event.exceptDates || [],
    amount: event.amount === undefined || event.amount === null || event.amount === "" ? null : String(event.amount),
  };
}
