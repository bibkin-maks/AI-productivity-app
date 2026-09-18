import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import AppShell, { useAppTheme } from "../components/app/AppShell";
import { useAuth } from "../context/AuthContext";
import { useGetEventsQuery } from "../slices/apiSlice";
import WeekStrip from "../components/diary/WeekStrip";
import ProgressCard from "../components/diary/ProgressCard";
import DayTimeline from "../components/diary/DayTimeline";
import HitList from "../components/diary/HitList";
import WorkoutCard from "../components/diary/WorkoutCard";
import WeekAhead from "../components/diary/WeekAhead";
import AssistCard from "../components/diary/AssistCard";
import useDiaryActions from "../components/diary/useDiaryActions";
import { addDays, eventsOnDay, expandEvents, greeting, isDone, isSameDay, startOfDay, startOfWeek } from "../components/diary/diaryUtils";

function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function Diary() {
  const [theme, toggleTheme] = useAppTheme();
  const { user, token } = useAuth();
  const now = useNow();
  const today = startOfDay(now);
  const [selected, setSelected] = useState(today);
  const [actionError, setActionError] = useState("");
  const topRef = useRef(null);

  const { data: storedEvents, isLoading, isError, refetch } = useGetEventsQuery(undefined, { skip: !token });
  const { toggleDone, toggleExercise, addTask } = useDiaryActions(storedEvents);

  const weekStart = startOfWeek(selected);
  const rangeEnd = addDays(selected, 7) > addDays(weekStart, 7) ? addDays(selected, 7) : addDays(weekStart, 7);
  const expanded = useMemo(
    () => expandEvents(storedEvents, weekStart, rangeEnd),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storedEvents, weekStart.getTime(), rangeEnd.getTime()]
  );

  const dayEvents = eventsOnDay(expanded, selected);
  const timed = dayEvents.filter((e) => !e.allDay);
  const allDay = dayEvents.filter((e) => e.allDay);
  const tasks = dayEvents.filter((e) => e.type === "task" || e.type === "project" || !e.type);
  const workouts = dayEvents.filter((e) => e.type === "workout" && (e.workoutLog || []).length > 0);
  const done = dayEvents.filter(isDone).length;
  const plannedMs = timed.reduce((sum, e) => sum + (e.end - e.start), 0);
  const isToday = isSameDay(selected, today);
  const nextUp = timed.find((e) => !isDone(e) && (isToday ? e.end > now : true));

  const busyDays = useMemo(() => new Set(expanded.map((e) => e.start.toDateString())), [expanded]);
  const ahead = Array.from({ length: 6 }, (_, i) => {
    const day = addDays(selected, i + 1);
    return { day, count: eventsOnDay(expanded, day).length };
  });

  const run = useCallback(async (action) => {
    setActionError("");
    try {
      await action();
    } catch {
      setActionError("That change didn't save. Check your connection and try again.");
    }
  }, []);

  const selectDay = useCallback((day) => {
    setSelected(startOfDay(day));
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const focusQuickAdd = useCallback(() => {
    const input = document.getElementById("quick-add");
    input?.scrollIntoView({ behavior: "smooth", block: "center" });
    input?.focus({ preventScroll: true });
  }, []);

  const firstName = user?.name?.split(" ")[0];
  const initials = (user?.name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <AppShell theme={theme} onToggleTheme={toggleTheme}>
      <div className="diary-grid" ref={topRef}>
        <header className="diary-grid__full flex items-start justify-between gap-4 scroll-mt-10">
          <div>
            <p className="app-label">
              {greeting(now)}
              {firstName ? `, ${firstName}` : ""}
            </p>
            <h1 className="app-display text-[clamp(56px,9vw,112px)] mt-2">
              {selected.toLocaleDateString([], { weekday: "long" })}
            </h1>
            <p className="app-muted text-lg mt-2 tabular-nums">
              {selected.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}
              {isToday && <> — {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase()}</>}
              {!isToday && (
                <button type="button" className="ml-3 underline underline-offset-4 text-[var(--app-text)]" onClick={() => selectDay(today)}>
                  Back to today
                </button>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              className="app-icon-btn app-icon-btn--mobile"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            >
              {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <span className="app-avatar" aria-label={user?.name || "Account"}>{initials}</span>
          </div>
        </header>

        <div className="diary-grid__full">
          <WeekStrip
            weekStart={weekStart}
            selected={selected}
            today={today}
            busyDays={busyDays}
            onSelect={selectDay}
            onShiftWeek={(dir) => setSelected((d) => addDays(d, dir * 7))}
          />
        </div>

        {(isError || actionError) && (
          <div className="diary-grid__full app-card flex items-center justify-between gap-4 !py-4" role="alert">
            <p>{isError ? "Couldn't load your events." : actionError}</p>
            {isError && (
              <button type="button" className="app-button" onClick={refetch}>Retry</button>
            )}
          </div>
        )}

        <div className="diary-stack">
          {isLoading ? (
            <>
              <div className="app-card h-[320px] animate-pulse" aria-label="Loading" />
              <div className="app-card h-[420px] animate-pulse" />
            </>
          ) : (
            <>
              <ProgressCard done={done} total={dayEvents.length} plannedMs={plannedMs} nextUp={nextUp} isToday={isToday} />
              <DayTimeline
                events={timed}
                allDay={allDay}
                now={now}
                isToday={isToday}
                onToggle={(e) => run(() => toggleDone(e))}
                onCreate={focusQuickAdd}
              />
            </>
          )}
          <WeekAhead days={ahead} onSelect={selectDay} />
        </div>

        <div className="diary-stack">
          <HitList items={tasks} isToday={isToday} onToggle={(e) => run(() => toggleDone(e))} onAdd={(title) => addTask(title, selected)} />
          <WorkoutCard workouts={workouts} onToggleExercise={(w, i) => run(() => toggleExercise(w, i))} />
          <AssistCard remaining={dayEvents.length - done} />
        </div>
      </div>
    </AppShell>
  );
}
