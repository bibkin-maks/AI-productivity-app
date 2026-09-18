import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import {
  CheckCheck, ChevronLeft, ChevronRight, Circle, Loader2, MoreHorizontal, Plus, Repeat, Search, Trash2, Undo2, X,
} from "lucide-react";
import AppShell, { useAppTheme } from "../components/app/AppShell";
import Toast from "../components/app/Toast";
import EventSheet from "../components/calendar/EventSheet";
import { ClearAllDialog, PresetsDialog, ScopeDialog } from "../components/calendar/CalendarDialogs";
import useCalendarActions from "../components/calendar/useCalendarActions";
import {
  baseIdOf, createOps, deleteOps, editOps, isRecurring, mergeOps, patchOccurrenceOps,
} from "../components/calendar/seriesOps";
import { TYPE_META, eventColor, expandEvents, formatTime, isDone } from "../components/diary/diaryUtils";
import { useAuth } from "../context/AuthContext";
import { useGetEventsQuery } from "../slices/apiSlice";

// Weeks start on Monday, matching the Diary
moment.updateLocale("en", { week: { dow: 1, doy: 4 } });
const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

const VIEWS = [["month", "Month"], ["week", "Week"], ["day", "Day"], ["agenda", "List"]];
// 24-hour times like the rest of the app; events show only their start so short blocks keep room for the title
const FORMATS = {
  timeGutterFormat: "HH:mm",
  eventTimeRangeFormat: ({ start }, culture, loc) => loc.format(start, "HH:mm", culture),
  eventTimeRangeStartFormat: ({ start }, culture, loc) => loc.format(start, "HH:mm", culture),
  eventTimeRangeEndFormat: ({ end }, culture, loc) => `until ${loc.format(end, "HH:mm", culture)}`,
  agendaTimeRangeFormat: ({ start, end }, culture, loc) => `${loc.format(start, "HH:mm", culture)} – ${loc.format(end, "HH:mm", culture)}`,
  agendaDateFormat: "ddd D MMM",
  dayFormat: "D ddd",
};
const STATUS_FILTERS = [["all", "Any status"], ["pending", "To do"], ["in_progress", "Doing"], ["completed", "Done"], ["blocked", "Blocked"]];
const AUTO_COLOR = "#3788d8";
const PRESETS_KEY = "workout_templates";
const DEFAULT_PRESETS = [
  { id: "t1", name: "Push Day", exercises: [{ name: "Bench Press", type: "count" }, { name: "Overhead Press", type: "count" }, { name: "Incline Dumbbell", type: "count" }, { name: "Tricep Pushdowns", type: "count" }] },
  { id: "t2", name: "Pull Day", exercises: [{ name: "Deadlift", type: "count" }, { name: "Pullups", type: "count" }, { name: "Barbell Rows", type: "count" }, { name: "Face Pulls", type: "count" }, { name: "Bicep Curls", type: "count" }] },
  { id: "t3", name: "Leg Day", exercises: [{ name: "Squat", type: "count" }, { name: "Romanian Deadlift", type: "count" }, { name: "Leg Press", type: "count" }, { name: "Calf Raises", type: "count" }] },
];

function usePresets() {
  const [presets, setPresets] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PRESETS_KEY));
      if (Array.isArray(saved)) {
        return saved.map((t) => ({ ...t, exercises: t.exercises.map((ex) => (typeof ex === "string" ? { name: ex, type: "count" } : ex)) }));
      }
    } catch {
      // fall through to defaults
    }
    return DEFAULT_PRESETS;
  });
  const save = useCallback((next) => {
    setPresets(next);
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable: presets last for this visit only
    }
  }, []);
  return [presets, save];
}

function viewRange(view, date) {
  const m = moment(date);
  if (view === "week") return [m.clone().startOf("week").toDate(), m.clone().endOf("week").toDate()];
  if (view === "day") return [m.clone().startOf("day").toDate(), m.clone().endOf("day").toDate()];
  if (view === "agenda") return [m.clone().startOf("day").toDate(), m.clone().add(30, "days").endOf("day").toDate()];
  return [m.clone().startOf("month").startOf("week").toDate(), m.clone().endOf("month").endOf("week").toDate()];
}

function heading(view, date) {
  const m = moment(date);
  if (view === "week") {
    const s = m.clone().startOf("week");
    const e = m.clone().endOf("week");
    return { title: s.month() === e.month() ? s.format("MMMM") : `${s.format("MMM")} – ${e.format("MMM")}`, sub: `${s.format("D")}–${e.format("D MMM YYYY")}` };
  }
  if (view === "day") return { title: m.format("dddd"), sub: m.format("D MMMM YYYY") };
  if (view === "agenda") return { title: "Next 30 days", sub: `From ${m.format("D MMMM YYYY")}` };
  return { title: m.format("MMMM"), sub: m.format("YYYY") };
}

function blankDraft(start, end, allDay = false) {
  return {
    title: "", description: "", type: "task", status: "pending", priority: "medium", color: AUTO_COLOR, amount: "",
    allDay, start, end, recurrence: "none", recurrenceDays: [], recurrenceInterval: 2, recurrenceEnd: null, workoutLog: [],
  };
}

const describe = (event) => `“${event.title || "Untitled"}”`;

export default function CalendarPage() {
  const [theme, toggleTheme] = useAppTheme();
  const { token } = useAuth();
  const { data, isLoading, isError, refetch } = useGetEventsQuery(undefined, { skip: !token });
  const stored = useMemo(() => data || [], [data]);
  const { perform, undo, canUndo, busy } = useCalendarActions(stored);
  const [presets, setPresets] = usePresets();

  const [view, setView] = useState(() => (window.innerWidth < 768 ? "agenda" : "month"));
  const [date, setDate] = useState(() => new Date());
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState(() => new Set());
  const [sheet, setSheet] = useState({ open: false });
  const [scope, setScope] = useState({ open: false });
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const searchRef = useRef(null);

  // ---------------------------------------------------------------- data for the visible range
  const [rangeStart, rangeEnd] = viewRange(view, date);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return expandEvents(stored, rangeStart, rangeEnd).filter((e) =>
      (typeFilter === "all" || (e.type || "task") === typeFilter) &&
      (statusFilter === "all" || (e.status || "pending") === statusFilter) &&
      (!q || e.title?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored, rangeStart.getTime(), rangeEnd.getTime(), typeFilter, statusFilter, query]);

  const selected = visible.filter((e) => selection.has(e.id));
  const findBase = useCallback((occurrence) => stored.find((e) => e.id === baseIdOf(occurrence)), [stored]);
  const filtersActive = typeFilter !== "all" || statusFilter !== "all" || query.trim();

  // ---------------------------------------------------------------- running changes
  const handleUndo = useCallback(async () => {
    try {
      const label = await undo();
      if (label) setToast({ message: `Undone: ${label}` });
    } catch (err) {
      setToast({ tone: "error", message: `Couldn't undo. ${err.message}` });
    }
  }, [undo]);

  const apply = useCallback(
    async (ops, label, { rethrow = false } = {}) => {
      try {
        await perform(ops, label);
        setToast({ message: label, action: { label: "Undo", onClick: handleUndo } });
        return true;
      } catch (err) {
        if (rethrow) throw err;
        setToast({ tone: "error", message: err.message });
        return false;
      }
    },
    [perform, handleUndo]
  );

  // ---------------------------------------------------------------- open sheet
  // No slot: next full hour today. Month cell: 09:00–10:00 that day.
  // Week/day grid: the dragged range (a plain click gets one hour). All-day row: an all-day event.
  const openCreate = useCallback(
    (slot) => {
      const hour = 3600000;
      let start;
      let end;
      let allDay = false;
      if (!slot) {
        start = new Date();
        start.setHours(start.getHours() + 1, 0, 0, 0);
        end = new Date(start.getTime() + hour);
      } else if (view === "month") {
        start = new Date(slot.start);
        start.setHours(9, 0, 0, 0);
        end = new Date(start.getTime() + hour);
      } else {
        start = new Date(slot.start);
        end = new Date(slot.end);
        allDay = end - start >= 86400000 && start.getHours() === 0 && start.getMinutes() === 0;
        if (allDay) end = new Date(end.getTime() - 60000);
        else if (end - start <= 15 * 60000) end = new Date(start.getTime() + hour);
      }
      setSheet({ open: true, mode: "create", initial: blankDraft(start, end, allDay) });
    },
    [view]
  );

  const openEdit = useCallback(
    (occurrence) => {
      const base = findBase(occurrence);
      if (!base) return;
      setSheet({
        open: true,
        mode: "edit",
        base,
        occurrence,
        initial: {
          ...blankDraft(occurrence.start, occurrence.end),
          ...base,
          start: new Date(occurrence.start),
          end: new Date(occurrence.end),
          recurrenceEnd: base.recurrenceEnd ? new Date(base.recurrenceEnd) : null,
          recurrenceInterval: base.recurrenceInterval || 2,
          amount: base.amount ?? "",
          color: base.color || AUTO_COLOR,
        },
      });
    },
    [findBase]
  );

  const closeSheet = useCallback(() => setSheet({ open: false }), []);

  // ---------------------------------------------------------------- save / delete
  const saveSheet = async (draft) => {
    if (sheet.mode === "create") {
      await apply(createOps(draft), `Created ${describe(draft)}`, { rethrow: true });
      closeSheet();
      return;
    }
    if (isRecurring(sheet.base)) {
      setScope({ open: true, action: "edit", draft });
      return;
    }
    await apply(editOps({ base: sheet.base, occurrence: sheet.occurrence, draft }), `Saved ${describe(draft)}`, { rethrow: true });
    closeSheet();
  };

  const deleteFromSheet = async () => {
    if (isRecurring(sheet.base)) {
      setScope({ open: true, action: "delete" });
      return;
    }
    if (await apply(deleteOps({ base: sheet.base, occurrence: sheet.occurrence }), `Deleted ${describe(sheet.base)}`)) closeSheet();
  };

  const chooseScope = async (choice) => {
    const { action, draft } = scope;
    setScope({ open: false });
    const args = { base: sheet.base, occurrence: sheet.occurrence, scope: choice };
    const ok = action === "delete"
      ? await apply(deleteOps(args), `Deleted ${describe(sheet.base)}${choice === "this" ? " on one date" : ""}`)
      : await apply(editOps({ ...args, draft }), `Saved ${describe(draft)}`);
    if (ok) closeSheet();
  };

  // ---------------------------------------------------------------- drag, resize, bulk
  const moveOccurrence = useCallback(
    ({ event, start, end, isAllDay }) => {
      const base = findBase(event);
      if (!base || String(base.id).startsWith("temp_")) return;
      const patch = { start: new Date(start), end: new Date(end), allDay: typeof isAllDay === "boolean" ? isAllDay : event.allDay };
      apply(patchOccurrenceOps({ base, occurrence: event, patch }), `Moved ${describe(event)} to ${moment(start).format("ddd D MMM")}${patch.allDay ? "" : `, ${formatTime(start)}`}`);
    },
    [findBase, apply]
  );

  const setSelectedStatus = (status) => {
    const ops = mergeOps(selected.map((occ) => {
      const base = findBase(occ);
      return base ? patchOccurrenceOps({ base, occurrence: occ, patch: { status } }) : [];
    }));
    const n = selected.length;
    apply(ops, `Marked ${n} event${n === 1 ? "" : "s"} ${status === "completed" ? "done" : "to do"}`);
    setSelection(new Set());
  };

  const deleteSelected = useCallback(() => {
    if (!selected.length) return;
    const ops = mergeOps(selected.map((occ) => {
      const base = findBase(occ);
      return base ? deleteOps({ base, occurrence: occ, scope: "this" }) : [];
    }));
    const n = selected.length;
    apply(ops, `Deleted ${n} event${n === 1 ? "" : "s"}`);
    setSelection(new Set());
  }, [selected, findBase, apply]);

  const onSelectEvent = (event, e) => {
    const native = e?.nativeEvent || e;
    if (native?.shiftKey || native?.ctrlKey || native?.metaKey) {
      setSelection((prev) => {
        const next = new Set(prev);
        next.has(event.id) ? next.delete(event.id) : next.add(event.id);
        return next;
      });
      return;
    }
    openEdit(event);
  };

  // ---------------------------------------------------------------- navigation
  const unit = view === "agenda" ? "month" : view;
  const navigate = useCallback((dir) => setDate((d) => (dir === 0 ? new Date() : moment(d).add(dir, unit).toDate())), [unit]);

  // Keyboard shortcuts (ignored while typing or when a dialog is open)
  useEffect(() => {
    const onKey = (e) => {
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) || e.target.isContentEditable;
      if (typing || document.querySelector(".app-overlay")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      } else if (e.key === "n") {
        e.preventDefault();
        openCreate();
      } else if (e.key === "t") {
        navigate(0);
      } else if (e.key === "ArrowLeft") {
        navigate(-1);
      } else if (e.key === "ArrowRight") {
        navigate(1);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selection.size) {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === "Escape") {
        setSelection(new Set());
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleUndo, openCreate, navigate, deleteSelected, selection.size]);

  // ---------------------------------------------------------------- rendering helpers
  const eventPropGetter = useCallback(
    (event) => ({
      className: `cal-event ${isDone(event) ? "is-done" : ""} ${selection.has(event.id) ? "is-selected" : ""}`,
      style: { "--ev": eventColor(event) },
    }),
    [selection]
  );

  const components = useMemo(
    () => ({
      toolbar: () => null,
      event: ({ event }) => (
        <span className="cal-event__inner" title={event.title}>
          {isDone(event) && <CheckCheck size={12} aria-label="Done" className="flex-none" />}
          {isRecurring(event) && <Repeat size={11} aria-label="Repeats" className="flex-none opacity-80" />}
          {view === "month" && !event.allDay && <span className="cal-event__time">{formatTime(event.start)}</span>}
          <span className="truncate">{event.title || "Untitled"}</span>
        </span>
      ),
    }),
    [view]
  );

  const { title, sub } = heading(view, date);
  const typeChips = [["all", "All", null], ...Object.entries(TYPE_META).map(([id, m]) => [id, m.label, m.color])];

  return (
    <AppShell theme={theme} onToggleTheme={toggleTheme} fill>
      <div className="cal-page">
        {/* ------------------------------------------------ header */}
        <header className="cal-head">
          <div className="min-w-0">
            <h1 className="app-display text-[clamp(44px,6vw,80px)] truncate">{title}</h1>
            <p className="app-muted text-lg tabular-nums">{sub}</p>
          </div>

          <div className="cal-controls">
            <div className="flex items-center gap-1">
              <button type="button" className="app-icon-btn" onClick={() => navigate(-1)} aria-label={`Previous ${unit}`}>
                <ChevronLeft size={22} />
              </button>
              <button type="button" className="app-button !min-h-[40px] !px-4" onClick={() => navigate(0)}>Today</button>
              <button type="button" className="app-icon-btn" onClick={() => navigate(1)} aria-label={`Next ${unit}`}>
                <ChevronRight size={22} />
              </button>
            </div>

            <div role="radiogroup" aria-label="View" className="app-seg">
              {VIEWS.map(([id, label]) => (
                <button key={id} type="button" role="radio" aria-checked={view === id} className="app-seg__opt" onClick={() => setView(id)}>
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {canUndo && (
                <button type="button" className="app-button !min-h-[40px] !px-3" onClick={handleUndo} disabled={busy} title="Undo (Ctrl+Z)" aria-label="Undo">
                  <Undo2 size={16} /> <span className="hidden sm:inline">Undo</span>
                </button>
              )}
              <div className="relative">
                <button type="button" className="app-icon-btn" aria-haspopup="menu" aria-expanded={menuOpen} aria-label="More actions" onClick={() => setMenuOpen((o) => !o)}>
                  <MoreHorizontal size={20} />
                </button>
                {menuOpen && (
                  <div role="menu" className="cal-menu" onMouseLeave={() => setMenuOpen(false)}>
                    <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setPresetsOpen(true); }}>Workout presets</button>
                    <button type="button" role="menuitem" className="text-[var(--app-high)]" disabled={!stored.length} onClick={() => { setMenuOpen(false); setClearOpen(true); }}>
                      Delete all events…
                    </button>
                  </div>
                )}
              </div>
              <button type="button" className="app-button app-button--signal !min-h-[40px]" onClick={() => openCreate()} aria-label="New event">
                <Plus size={18} /> <span className="hidden sm:inline">New event</span>
              </button>
            </div>
          </div>
        </header>

        {/* ------------------------------------------------ filters / selection */}
        {selection.size > 0 ? (
          <div className="cal-bar cal-bar--selection" role="region" aria-label="Selection">
            <span className="font-semibold tabular-nums">{selected.length} selected</span>
            <button type="button" className="app-button !min-h-[36px] !text-sm" onClick={() => setSelectedStatus("completed")}><CheckCheck size={16} /> Mark done</button>
            <button type="button" className="app-button !min-h-[36px] !text-sm" onClick={() => setSelectedStatus("pending")}><Circle size={16} /> Mark to do</button>
            <button type="button" className="app-button !min-h-[36px] !text-sm !text-[var(--app-high)]" onClick={deleteSelected}><Trash2 size={16} /> Delete</button>
            <button type="button" className="app-icon-btn ml-auto" onClick={() => setSelection(new Set())} aria-label="Clear selection"><X size={18} /></button>
          </div>
        ) : (
          <div className="cal-bar">
            <label className="cal-search">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">Search events</span>
              <input ref={searchRef} type="search" placeholder="Search events" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <div className="cal-chips" role="group" aria-label="Filter by type">
              {typeChips.map(([id, label, color]) => (
                <button key={id} type="button" aria-pressed={typeFilter === id} className="cal-chip" onClick={() => setTypeFilter(id)}>
                  {color && <span className="w-2 h-2 rounded-full" style={{ background: color }} aria-hidden="true" />}
                  {label}
                </button>
              ))}
            </div>
            <label className="sr-only" htmlFor="status-filter">Filter by status</label>
            <select id="status-filter" className="app-input !w-auto !py-2 !min-h-[40px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {STATUS_FILTERS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            {filtersActive && (
              <button type="button" className="text-sm underline underline-offset-4 app-muted" onClick={() => { setTypeFilter("all"); setStatusFilter("all"); setQuery(""); }}>
                Reset filters
              </button>
            )}
            <p className="hidden xl:block ml-auto text-xs app-muted">Shift-click to select · N new · T today · ← → move</p>
          </div>
        )}

        {/* ------------------------------------------------ calendar */}
        <section className="cal-card" aria-label="Calendar" aria-busy={isLoading || busy}>
          {isError ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
              <p className="text-xl font-semibold">Couldn&apos;t load your events</p>
              <button type="button" className="app-button" onClick={refetch}>Retry</button>
            </div>
          ) : (
            <>
              {isLoading && (
                <div className="cal-loading"><Loader2 size={28} className="animate-spin" aria-label="Loading events" /></div>
              )}
              <DnDCalendar
                localizer={localizer}
                formats={FORMATS}
                events={visible}
                startAccessor="start"
                endAccessor="end"
                allDayAccessor="allDay"
                view={view}
                views={VIEWS.map(([id]) => id)}
                onView={setView}
                date={date}
                onNavigate={setDate}
                step={15}
                timeslots={4}
                scrollToTime={new Date(1970, 0, 1, 7, 0)}
                selectable
                resizable
                popup
                onSelectSlot={openCreate}
                onSelectEvent={onSelectEvent}
                onEventDrop={moveOccurrence}
                onEventResize={moveOccurrence}
                draggableAccessor={(e) => !String(e.id).startsWith("temp_")}
                eventPropGetter={eventPropGetter}
                components={components}
                messages={{ noEventsInRange: filtersActive ? "No events match these filters." : "Nothing planned in the next 30 days." }}
                style={{ height: "100%" }}
              />
            </>
          )}
        </section>
      </div>

      <EventSheet
        open={sheet.open}
        mode={sheet.mode}
        initial={sheet.initial}
        isOccurrence={sheet.mode === "edit" && isRecurring(sheet.base)}
        theme={theme}
        presets={presets}
        saving={busy}
        onClose={closeSheet}
        onSave={saveSheet}
        onDelete={deleteFromSheet}
        onManagePresets={() => setPresetsOpen(true)}
      />
      <ScopeDialog
        open={scope.open}
        action={scope.action}
        occurrenceDate={sheet.occurrence?.start}
        theme={theme}
        onChoose={chooseScope}
        onClose={() => setScope({ open: false })}
      />
      <PresetsDialog open={presetsOpen} presets={presets} theme={theme} onChange={setPresets} onClose={() => setPresetsOpen(false)} />
      <ClearAllDialog
        open={clearOpen}
        count={stored.length}
        theme={theme}
        busy={busy}
        onClose={() => setClearOpen(false)}
        onConfirm={async () => {
          setClearOpen(false);
          await apply([{ kind: "deleteAll" }], "Deleted all events");
        }}
      />
      <Toast toast={toast} onDismiss={dismissToast} />
    </AppShell>
  );
}
