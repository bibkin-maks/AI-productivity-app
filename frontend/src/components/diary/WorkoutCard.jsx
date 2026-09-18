import Check from "./Check";
import { eventColor, formatTime } from "./diaryUtils";

function detail(item) {
  const parts = [];
  if (item.sets && item.reps) parts.push(`${item.sets}×${item.reps}`);
  else if (item.value) parts.push(item.value);
  if (item.weight) parts.push(`${item.weight} kg`);
  return parts.join(" · ");
}

export default function WorkoutCard({ workouts, onToggleExercise }) {
  return (
    <>
      {workouts.map((workout) => {
        const log = workout.workoutLog || [];
        const done = log.filter((i) => i.completed).length;
        const color = eventColor(workout);
        return (
          <section key={workout.id} className="app-card" aria-label={`Workout: ${workout.title}`}>
            <div className="flex items-baseline justify-between gap-4">
              <div className="min-w-0">
                <p className="app-label">Workout · {formatTime(workout.start)}</p>
                <h2 className="app-display text-3xl mt-1 truncate">{workout.title}</h2>
              </div>
              <p className="tabular-nums font-medium">{done}/{log.length}</p>
            </div>
            <ul className="mt-4 space-y-3">
              {log.map((item, index) => (
                <li key={item.id || index} className="flex items-center gap-3">
                  <Check
                    checked={Boolean(item.completed)}
                    color={color}
                    onToggle={() => onToggleExercise(workout, index)}
                    label={`Mark ${item.name} ${item.completed ? "not done" : "done"}`}
                  />
                  <span className={`flex-1 min-w-0 truncate ${item.completed ? "app-strike" : ""}`}>{item.name || "Exercise"}</span>
                  {detail(item) && <span className="app-muted text-sm tabular-nums">{detail(item)}</span>}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
