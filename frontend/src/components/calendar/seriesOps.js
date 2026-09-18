// Pure builders for calendar changes. Each returns a list of operations:
//   { kind: "update", event } | { kind: "create", event } | { kind: "delete", id } | { kind: "deleteSeries", seriesId }
// A repeating event is stored once (the "base") with its rule; occurrences are generated
// in the UI and identified by `${baseId}_recur_${timestamp}`. Changing one occurrence adds
// its date to the base's exceptDates and saves a standalone copy.

import { exceptKey } from "../diary/diaryUtils";

export const isRecurring = (event) => Boolean(event?.recurrence && event.recurrence !== "none");

export const baseIdOf = (occurrence) => String(occurrence.id).split("_recur_")[0];

// Fields a user edits in the sheet (everything except identity / series bookkeeping)
const CONTENT_FIELDS = [
  "title", "description", "type", "status", "priority", "color", "amount", "workoutLog", "allDay",
];
const RULE_FIELDS = ["recurrence", "recurrenceDays", "recurrenceInterval", "recurrenceEnd"];

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

const newSeriesId = () => `series_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

function standaloneFrom(event) {
  const { id: _id, isInstance: _i, ...rest } = event;
  return { ...rest, seriesId: null, recurrence: "none", recurrenceDays: [], recurrenceEnd: null, exceptDates: [] };
}

const isFirstOccurrence = (occurrence, base) => exceptKey(occurrence.start) === exceptKey(base.start);

// ---------------------------------------------------------------- create

export function createOps(draft) {
  const event = { ...draft };
  delete event.id;
  if (isRecurring(event)) event.seriesId = event.seriesId || newSeriesId();
  else Object.assign(event, { seriesId: null, recurrenceDays: [], recurrenceEnd: null });
  return [{ kind: "create", event }];
}

// ---------------------------------------------------------------- edit

// occurrence: the item that was opened (keeps its original start/end)
// draft: edited values from the sheet
// scope: "this" | "following" | "all" (ignored for non-repeating events)
export function editOps({ base, occurrence, draft, scope }) {
  if (!isRecurring(base)) {
    return [{ kind: "update", event: { ...base, ...pick(draft, [...CONTENT_FIELDS, ...RULE_FIELDS]), start: draft.start, end: draft.end } }];
  }

  const occKey = exceptKey(occurrence.start);

  if (scope === "this") {
    return [
      { kind: "update", event: { ...base, exceptDates: [...(base.exceptDates || []), occKey] } },
      { kind: "create", event: standaloneFrom({ ...base, ...pick(draft, CONTENT_FIELDS), start: draft.start, end: draft.end }) },
    ];
  }

  // Shift the series by however far this occurrence was moved, keeping the series' own start date
  const shift = new Date(draft.start) - new Date(occurrence.start);
  const duration = new Date(draft.end) - new Date(draft.start);

  if (scope === "all" || isFirstOccurrence(occurrence, base)) {
    const start = new Date(new Date(base.start).getTime() + shift);
    return [{
      kind: "update",
      event: { ...base, ...pick(draft, [...CONTENT_FIELDS, ...RULE_FIELDS]), start, end: new Date(start.getTime() + duration) },
    }];
  }

  // "following": end the old series just before this occurrence, start a new one from here
  const cut = new Date(new Date(occurrence.start).getTime() - 1);
  const laterSkips = (base.exceptDates || []).filter((d) => d > occKey);
  return [
    { kind: "update", event: { ...base, recurrenceEnd: cut } },
    {
      kind: "create",
      event: {
        ...base,
        ...pick(draft, [...CONTENT_FIELDS, ...RULE_FIELDS]),
        id: undefined,
        seriesId: newSeriesId(),
        start: draft.start,
        end: draft.end,
        exceptDates: laterSkips,
      },
    },
  ];
}

// ---------------------------------------------------------------- delete

export function deleteOps({ base, occurrence, scope }) {
  if (!isRecurring(base)) return [{ kind: "delete", id: base.id }];

  const occKey = exceptKey(occurrence.start);
  if (scope === "this") {
    return [{ kind: "update", event: { ...base, exceptDates: [...(base.exceptDates || []), occKey] } }];
  }
  if (scope === "following" && !isFirstOccurrence(occurrence, base)) {
    return [{ kind: "update", event: { ...base, recurrenceEnd: new Date(new Date(occurrence.start).getTime() - 1) } }];
  }
  // whole series; the series endpoint also removes legacy per-occurrence copies
  return base.seriesId ? [{ kind: "deleteSeries", seriesId: base.seriesId }] : [{ kind: "delete", id: base.id }];
}

// ---------------------------------------------------------------- move / resize / status

// Drag, resize and quick status changes only ever affect the occurrence that was touched
export function patchOccurrenceOps({ base, occurrence, patch }) {
  if (!isRecurring(base)) return [{ kind: "update", event: { ...base, ...patch } }];
  return [
    { kind: "update", event: { ...base, exceptDates: [...(base.exceptDates || []), exceptKey(occurrence.start)] } },
    { kind: "create", event: standaloneFrom({ ...base, start: occurrence.start, end: occurrence.end, ...patch }) },
  ];
}

// Merge several op lists so one base event collecting multiple skips gets a single update
export function mergeOps(lists) {
  const updates = new Map();
  const rest = [];
  for (const op of lists.flat()) {
    if (op.kind !== "update") {
      rest.push(op);
      continue;
    }
    const prev = updates.get(op.event.id);
    if (!prev) {
      updates.set(op.event.id, op);
    } else {
      const exceptDates = [...new Set([...(prev.event.exceptDates || []), ...(op.event.exceptDates || [])])];
      updates.set(op.event.id, { kind: "update", event: { ...prev.event, ...op.event, exceptDates } });
    }
  }
  const deleted = new Set(rest.filter((op) => op.kind === "delete").map((op) => op.id));
  return [...[...updates.values()].filter((op) => !deleted.has(op.event.id)), ...rest];
}
