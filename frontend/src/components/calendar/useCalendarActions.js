import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import {
  api,
  useCreateEventMutation,
  useDeleteAllEventsMutation,
  useDeleteEventMutation,
  useDeleteEventSeriesMutation,
  useUpdateEventMutation,
} from "../../slices/apiSlice";
import { toApiEvent } from "../diary/diaryUtils";

const UNDO_LIMIT = 20;

// Runs calendar operations against the API with optimistic cache updates.
// Every run records the inverse operations, so undo really reverts the server state.
export default function useCalendarActions(storedEvents) {
  const dispatch = useDispatch();
  const [createEvent] = useCreateEventMutation();
  const [updateEvent] = useUpdateEventMutation();
  const [deleteEvent] = useDeleteEventMutation();
  const [deleteSeries] = useDeleteEventSeriesMutation();
  const [deleteAll] = useDeleteAllEventsMutation();

  const eventsRef = useRef(storedEvents || []);
  useEffect(() => {
    eventsRef.current = storedEvents || [];
  }, [storedEvents]);

  // The stack lives in a ref so callbacks captured earlier (e.g. an Undo toast) always see the latest history
  const undoRef = useRef([]);
  const [undoCount, setUndoCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const setStack = (next) => {
    undoRef.current = next;
    setUndoCount(next.length);
  };

  const patchCache = useCallback(
    (recipe) => dispatch(api.util.updateQueryData("getEvents", undefined, recipe)),
    [dispatch]
  );

  const run = useCallback(
    async (ops) => {
      const inverse = [];
      const find = (id) => eventsRef.current.find((e) => e.id === id);
      try {
        for (const op of ops) {
          if (op.kind === "update") {
            const prev = find(op.event.id);
            const payload = toApiEvent(op.event);
            patchCache((draft) => {
              const i = draft.findIndex((e) => e.id === op.event.id);
              if (i !== -1) draft[i] = { ...draft[i], ...payload };
            });
            await updateEvent(payload).unwrap();
            if (prev) inverse.unshift({ kind: "update", event: prev });
          } else if (op.kind === "create") {
            const payload = toApiEvent({ ...op.event, id: undefined });
            const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            patchCache((draft) => {
              draft.push({ ...payload, id: tempId });
            });
            const created = await createEvent(payload).unwrap();
            inverse.unshift({ kind: "delete", id: created.id });
          } else if (op.kind === "delete") {
            const prev = find(op.id);
            patchCache((draft) => draft.filter((e) => e.id !== op.id));
            await deleteEvent(op.id).unwrap();
            if (prev) inverse.unshift({ kind: "create", event: prev });
          } else if (op.kind === "deleteSeries") {
            const prevs = eventsRef.current.filter((e) => e.seriesId === op.seriesId);
            patchCache((draft) => draft.filter((e) => e.seriesId !== op.seriesId));
            await deleteSeries(op.seriesId).unwrap();
            inverse.unshift(...prevs.map((event) => ({ kind: "create", event })));
          } else if (op.kind === "deleteAll") {
            const prevs = [...eventsRef.current];
            patchCache(() => []);
            await deleteAll().unwrap();
            inverse.unshift(...prevs.map((event) => ({ kind: "create", event })));
          }
        }
      } catch (err) {
        // resync with the server, then surface the failure
        dispatch(api.util.invalidateTags(["Events"]));
        const error = new Error(err?.data?.detail ? String(err.data.detail) : "The change couldn't be saved.");
        error.inverse = inverse;
        throw error;
      }
      return inverse;
    },
    [patchCache, createEvent, updateEvent, deleteEvent, deleteSeries, deleteAll, dispatch]
  );

  // Apply a change; `label` describes it in the undo toast
  const perform = useCallback(
    async (ops, label) => {
      if (!ops.length) return;
      setBusy(true);
      try {
        const inverse = await run(ops);
        setStack([...undoRef.current, { label, inverse }].slice(-UNDO_LIMIT));
      } finally {
        setBusy(false);
      }
    },
    [run]
  );

  const undo = useCallback(async () => {
    const last = undoRef.current[undoRef.current.length - 1];
    if (!last) return null;
    setStack(undoRef.current.slice(0, -1));
    setBusy(true);
    try {
      await run(last.inverse);
      return last.label;
    } finally {
      setBusy(false);
    }
  }, [run]);

  return { perform, undo, canUndo: undoCount > 0, busy };
}
