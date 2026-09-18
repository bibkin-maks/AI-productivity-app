import { useCallback } from "react";
import { useCreateEventMutation, useUpdateEventMutation } from "../../slices/apiSlice";
import { exceptKey, toApiEvent } from "./diaryUtils";

// Mutations for the diary. Changing one day of a repeating event follows the calendar's
// "this occurrence" rule: skip that date on the series and save a standalone copy.
export default function useDiaryActions(storedEvents) {
  const [createEvent, createState] = useCreateEventMutation();
  const [updateEvent, updateState] = useUpdateEventMutation();

  const saveOccurrence = useCallback(
    async (occurrence, changes) => {
      const baseId = String(occurrence.id).split("_recur_")[0];
      const base = (storedEvents || []).find((e) => e.id === baseId);
      const recurring = base && base.recurrence && base.recurrence !== "none";

      if (!recurring) {
        await updateEvent(toApiEvent({ ...(base || occurrence), ...changes })).unwrap();
        return;
      }

      await updateEvent(
        toApiEvent({ ...base, exceptDates: [...(base.exceptDates || []), exceptKey(occurrence.start)] })
      ).unwrap();
      const { id: _id, isInstance: _instance, ...rest } = { ...occurrence, ...changes };
      await createEvent(
        toApiEvent({ ...rest, seriesId: null, recurrence: "none", recurrenceDays: [], recurrenceEnd: null, exceptDates: [] })
      ).unwrap();
    },
    [storedEvents, createEvent, updateEvent]
  );

  const toggleDone = useCallback(
    (occurrence) => saveOccurrence(occurrence, { status: occurrence.status === "completed" ? "pending" : "completed" }),
    [saveOccurrence]
  );

  const toggleExercise = useCallback(
    (occurrence, index) =>
      saveOccurrence(occurrence, {
        workoutLog: (occurrence.workoutLog || []).map((item, i) => (i === index ? { ...item, completed: !item.completed } : item)),
      }),
    [saveOccurrence]
  );

  const addTask = useCallback(
    (title, day) => {
      const now = new Date();
      const start = new Date(day);
      if (start.toDateString() === now.toDateString()) {
        // next half hour today
        start.setHours(now.getHours(), now.getMinutes() < 30 ? 30 : 60, 0, 0);
      } else {
        start.setHours(9, 0, 0, 0);
      }
      const end = new Date(start.getTime() + 30 * 60000);
      return createEvent(toApiEvent({ title, start, end, type: "task", priority: "medium", status: "pending" })).unwrap();
    },
    [createEvent]
  );

  return {
    toggleDone,
    toggleExercise,
    addTask,
    isSaving: createState.isLoading || updateState.isLoading,
  };
}
