import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { Reorder } from "framer-motion";
import { BookText, FileText, GripVertical, Loader2, Plus, Search, Settings2, Star } from "lucide-react";
import AppShell, { useAppTheme } from "../components/app/AppShell";
import Toast from "../components/app/Toast";
import NoteEditor from "../components/notes/NoteEditor";
import NotebooksDialog from "../components/notes/NotebooksDialog";
import { displayTitle, htmlToText, preview, relativeTime } from "../components/notes/noteUtils";
import { useAuth } from "../context/AuthContext";
import {
  api,
  useCreateNotebookMutation,
  useCreateNoteMutation,
  useDeleteNotebookMutation,
  useDeleteNoteMutation,
  useGetAllNotesQuery,
  useGetNotebooksQuery,
  useReorderNotesMutation,
  useUpdateNotebookMutation,
  useUpdateNoteMutation,
} from "../slices/apiSlice";

const COLLECTION_KEY = "notes-collection";
const isDesktop = () => window.matchMedia("(min-width: 768px)").matches;

function readCollection() {
  try {
    return localStorage.getItem(COLLECTION_KEY) || "all";
  } catch {
    return "all";
  }
}

export default function Notes() {
  const [theme, toggleTheme] = useAppTheme();
  const { token } = useAuth();
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: notebooks = [], isLoading: notebooksLoading } = useGetNotebooksQuery(undefined, { skip: !token });
  const { data: allNotes = [], isLoading: notesLoading, isError, refetch } = useGetAllNotesQuery(undefined, { skip: !token });
  const [createNotebook] = useCreateNotebookMutation();
  const [updateNotebook] = useUpdateNotebookMutation();
  const [deleteNotebook] = useDeleteNotebookMutation();
  const [createNote] = useCreateNoteMutation();
  const [updateNote] = useUpdateNoteMutation();
  const [deleteNote] = useDeleteNoteMutation();
  const [reorderNotes] = useReorderNotesMutation();

  const [collection, setCollection] = useState(readCollection);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [pane, setPane] = useState("list");
  const [notebooksOpen, setNotebooksOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [creating, setCreating] = useState(false);
  // A note we just created, held until the refetched list contains it
  const [pendingNote, setPendingNote] = useState(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const editorRef = useRef(null);
  const loading = notebooksLoading || notesLoading;

  const patchNotes = useCallback((recipe) => dispatch(api.util.updateQueryData("getAllNotes", undefined, recipe)), [dispatch]);
  // Put created items in the cache right away so selection logic never sees them "missing" before the refetch
  const cacheNote = useCallback((note) => patchNotes((draft) => {
    if (!draft.some((n) => n.id === note.id)) draft.unshift(note);
  }), [patchNotes]);
  const cacheNotebook = useCallback((nb) => dispatch(api.util.updateQueryData("getNotebooks", undefined, (draft) => {
    if (!draft.some((x) => x.id === nb.id)) draft.push(nb);
  })), [dispatch]);

  // ------------------------------------------------------------ derived data
  const notebookById = useMemo(() => Object.fromEntries(notebooks.map((nb) => [nb.id, nb])), [notebooks]);
  const counts = useMemo(() => {
    const c = {};
    for (const n of allNotes) c[n.notebook_id] = (c[n.notebook_id] || 0) + 1;
    return c;
  }, [allNotes]);
  const favouriteCount = allNotes.filter((n) => n.is_favorite).length;
  const texts = useMemo(() => Object.fromEntries(allNotes.map((n) => [n.id, htmlToText(n.content)])), [allNotes]);

  const inNotebook = Boolean(notebookById[collection]);
  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    let list = allNotes;
    if (collection === "favorites") list = list.filter((n) => n.is_favorite);
    else if (collection !== "all") list = list.filter((n) => n.notebook_id === collection);
    if (q) list = list.filter((n) => displayTitle(n).toLowerCase().includes(q) || texts[n.id]?.toLowerCase().includes(q));
    const byRecent = (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
    return [...list].sort(inNotebook && !q ? (a, b) => (a.order ?? 0) - (b.order ?? 0) : byRecent);
  }, [allNotes, collection, q, texts, inNotebook]);

  const canReorder = inNotebook && !q;
  const [ordered, setOrdered] = useState(visible);
  useEffect(() => setOrdered(visible), [visible]);
  const reorderTimer = useRef(null);
  const onReorder = (next) => {
    setOrdered(next);
    clearTimeout(reorderTimer.current);
    reorderTimer.current = setTimeout(() => {
      reorderNotes({ notebookId: collection, notes: next.map((n, i) => ({ id: n.id, order: i })) })
        .unwrap()
        .catch(() => setToast({ tone: "error", message: "Couldn't save the new order." }));
    }, 700);
  };

  const selected = allNotes.find((n) => n.id === selectedId) || (pendingNote?.id === selectedId ? pendingNote : null);
  const collectionTitle = collection === "all" ? "All notes" : collection === "favorites" ? "Favourites" : notebookById[collection]?.name || "Notes";

  // ------------------------------------------------------------ keeping state valid
  useEffect(() => {
    try {
      localStorage.setItem(COLLECTION_KEY, collection);
    } catch {
      // storage unavailable
    }
  }, [collection]);

  useEffect(() => {
    if (!notebooksLoading && collection !== "all" && collection !== "favorites" && !notebookById[collection]) setCollection("all");
  }, [collection, notebookById, notebooksLoading]);

  // deep link: /notes?noteId=…
  const linkedId = searchParams.get("noteId");
  useEffect(() => {
    if (!linkedId || notesLoading) return;
    const note = allNotes.find((n) => n.id === linkedId);
    if (note) {
      setCollection(note.notebook_id);
      setSelectedId(note.id);
      setPane("editor");
    } else {
      setToast({ tone: "error", message: "That note doesn't exist anymore." });
    }
    setSearchParams({}, { replace: true });
  }, [linkedId, notesLoading, allNotes, setSearchParams]);

  // on wider screens keep something open
  useEffect(() => {
    if (loading || linkedId) return;
    if (pendingNote) {
      if (allNotes.some((n) => n.id === pendingNote.id)) setPendingNote(null);
      if (selectedId === pendingNote.id) return;
    }
    if (selectedId && !allNotes.some((n) => n.id === selectedId)) setSelectedId(null);
    if (isDesktop() && (!selectedId || !visible.some((n) => n.id === selectedId)) && visible.length) {
      setSelectedId(visible[0].id);
    }
  }, [loading, linkedId, visible, selectedId, allNotes, pendingNote]);

  // ------------------------------------------------------------ actions
  const notify = useCallback((t) => setToast(t), []);
  const flush = async () => {
    try {
      await editorRef.current?.flush();
    } catch {
      // the editor shows its own save error
    }
  };

  const openNote = async (id) => {
    if (id !== selectedId) await flush();
    setSelectedId(id);
    setPane("editor");
  };

  const openCollection = async (id) => {
    await flush();
    setCollection(id);
    setPane("list");
  };

  const focusTitleSoon = () => setTimeout(() => document.getElementById("note-title")?.focus(), 80);

  const newNote = async () => {
    if (creating) return;
    setCreating(true);
    await flush();
    try {
      let target = inNotebook ? collection : selected?.notebook_id || notebooks[0]?.id;
      if (!target) {
        const nb = await createNotebook({ name: "Notes" }).unwrap();
        cacheNotebook(nb);
        target = nb.id;
      }
      const note = await createNote({ notebookId: target, title: "", content: "" }).unwrap();
      cacheNote(note);
      setPendingNote(note);
      if (!inNotebook) setCollection(target);
      setQuery("");
      setSelectedId(note.id);
      setPane("editor");
      focusTitleSoon();
    } catch {
      setToast({ tone: "error", message: "Couldn't create a note. Please try again." });
    } finally {
      setCreating(false);
    }
  };

  const toggleFavourite = async (note) => {
    const next = !note.is_favorite;
    patchNotes((draft) => {
      const n = draft.find((x) => x.id === note.id);
      if (n) n.is_favorite = next;
    });
    try {
      await updateNote({ id: note.id, isFavorite: next }).unwrap();
    } catch {
      refetch();
      setToast({ tone: "error", message: "Couldn't update favourites." });
    }
  };

  const moveNote = async (note, notebookId, { quiet = false } = {}) => {
    if (note.notebook_id === notebookId) return;
    const from = note.notebook_id;
    patchNotes((draft) => {
      const n = draft.find((x) => x.id === note.id);
      if (n) n.notebook_id = notebookId;
    });
    if (collection === from) setCollection(notebookId);
    try {
      await updateNote({ id: note.id, notebookId }).unwrap();
      if (!quiet) {
        setToast({
          message: `Moved to ${notebookById[notebookId]?.name || "notebook"}`,
          action: { label: "Undo", onClick: () => moveNote({ ...note, notebook_id: notebookId }, from, { quiet: true }) },
        });
      }
    } catch {
      refetch();
      setToast({ tone: "error", message: "Couldn't move the note." });
    }
  };

  const duplicate = async (note) => {
    const latest = editorRef.current?.getDraft() || note;
    try {
      const copy = await createNote({ notebookId: note.notebook_id, title: `${displayTitle(latest)} (copy)`, content: latest.content || "" }).unwrap();
      cacheNote(copy);
      setPendingNote(copy);
      setSelectedId(copy.id);
      setToast({ message: "Duplicated" });
    } catch {
      setToast({ tone: "error", message: "Couldn't duplicate the note." });
    }
  };

  const copyLink = async (note) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/notes?noteId=${note.id}`);
      setToast({ message: "Link copied" });
    } catch {
      setToast({ tone: "error", message: "Couldn't copy. Your browser blocked clipboard access." });
    }
  };

  const restoreNote = async (snapshot) => {
    try {
      const notebookId = notebookById[snapshot.notebook_id] ? snapshot.notebook_id : notebooks[0]?.id;
      const note = await createNote({ notebookId, title: snapshot.title, content: snapshot.content }).unwrap();
      cacheNote({ ...note, is_favorite: Boolean(snapshot.is_favorite) });
      setPendingNote({ ...note, is_favorite: Boolean(snapshot.is_favorite) });
      if (snapshot.is_favorite) await updateNote({ id: note.id, isFavorite: true }).unwrap();
      setCollection(notebookId);
      setSelectedId(note.id);
      setToast({ message: "Note restored" });
    } catch {
      setToast({ tone: "error", message: "Couldn't restore the note." });
    }
  };

  const removeNote = async (note, latest) => {
    const snapshot = { ...note, ...(latest || {}) };
    const index = visible.findIndex((n) => n.id === note.id);
    const next = visible[index + 1] || visible[index - 1];
    patchNotes((draft) => draft.filter((n) => n.id !== note.id));
    setSelectedId(isDesktop() && next ? next.id : null);
    setPane("list");
    try {
      await deleteNote(note.id).unwrap();
      setToast({ message: `Deleted “${displayTitle(snapshot)}”`, action: { label: "Undo", onClick: () => restoreNote(snapshot) } });
    } catch {
      refetch();
      setToast({ tone: "error", message: "Couldn't delete the note." });
    }
  };

  const createNotebookNamed = async (name) => {
    const nb = await createNotebook({ name }).unwrap();
    cacheNotebook(nb);
    setNotebooksOpen(false); // jump straight into the new notebook
    await openCollection(nb.id);
  };

  const removeNotebook = async (id) => {
    const nb = notebookById[id];
    const notes = allNotes.filter((n) => n.notebook_id === id);
    await deleteNotebook(id).unwrap();
    if (collection === id) setCollection("all");
    setToast({
      message: `Deleted notebook “${nb?.name}”${notes.length ? ` and ${notes.length} note${notes.length === 1 ? "" : "s"}` : ""}`,
      action: {
        label: "Undo",
        onClick: async () => {
          try {
            const restored = await createNotebook({ name: nb.name }).unwrap();
            cacheNotebook(restored);
            for (const n of [...notes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
              const copy = await createNote({ notebookId: restored.id, title: n.title, content: n.content }).unwrap();
              if (n.is_favorite) await updateNote({ id: copy.id, isFavorite: true }).unwrap();
            }
            setCollection(restored.id);
            setToast({ message: "Notebook restored" });
          } catch {
            setToast({ tone: "error", message: "Couldn't fully restore the notebook." });
          }
        },
      },
    });
  };

  // ------------------------------------------------------------ rendering
  const collectionButtons = [
    { id: "all", label: "All notes", count: allNotes.length },
    { id: "favorites", label: "Favourites", count: favouriteCount },
  ];

  const renderRow = (note) => {
    const active = note.id === selectedId;
    return (
      <div className="note-row" data-active={active}>
        {canReorder && (
          <span className="note-row__grip" aria-hidden="true">
            <GripVertical size={14} />
          </span>
        )}
        <button type="button" className="note-row__body" aria-current={active ? "true" : undefined} onClick={() => openNote(note.id)}>
          <span className="flex items-center gap-2">
            <span className="note-row__title">{displayTitle(note)}</span>
            {note.is_favorite && <Star size={13} className="flex-none fill-[var(--app-signal)] text-[var(--app-signal)]" aria-label="Favourite" />}
          </span>
          <span className="note-row__preview">{preview(note.content) || "No text yet"}</span>
          <span className="note-row__meta">
            {relativeTime(note.updated_at || note.created_at)}
            {!inNotebook && notebookById[note.notebook_id] && <> · {notebookById[note.notebook_id].name}</>}
          </span>
        </button>
      </div>
    );
  };

  const emptyList = () => {
    if (q) return { title: `Nothing matches “${query.trim()}”`, body: "Try another word, or search all notes." };
    if (collection === "favorites") return { title: "No favourites yet", body: "Star a note to keep it here." };
    if (!allNotes.length) return { title: "Your first note", body: "Capture ideas, meeting notes and checklists." };
    return { title: "This notebook is empty", body: "Create a note to get started." };
  };

  return (
    <AppShell theme={theme} onToggleTheme={toggleTheme} fill>
      <div className="notes-layout" data-pane={pane}>
        {/* ------------------------------------------------ collections (desktop) */}
        <aside className="notes-collections" aria-label="Collections">
          <h1 className="app-display text-[52px] mb-6">Notes</h1>
          <nav className="grid gap-1">
            {collectionButtons.map((c) => (
              <button key={c.id} type="button" className="notes-collection" aria-current={collection === c.id ? "true" : undefined} onClick={() => openCollection(c.id)}>
                {c.id === "favorites" ? <Star size={17} aria-hidden="true" /> : <FileText size={17} aria-hidden="true" />}
                <span className="flex-1 truncate">{c.label}</span>
                <span className="tabular-nums opacity-70">{c.count}</span>
              </button>
            ))}
          </nav>
          <div className="flex items-center justify-between mt-8 mb-2">
            <p className="app-label">Notebooks</p>
            <button type="button" className="app-icon-btn !w-8 !h-8" onClick={() => setNotebooksOpen(true)} aria-label="Manage notebooks">
              <Settings2 size={16} />
            </button>
          </div>
          <nav className="grid gap-1 overflow-y-auto min-h-0" aria-label="Notebooks">
            {notebooks.map((nb) => (
              <button key={nb.id} type="button" className="notes-collection" aria-current={collection === nb.id ? "true" : undefined} onClick={() => openCollection(nb.id)}>
                <BookText size={17} aria-hidden="true" />
                <span className="flex-1 truncate">{nb.name}</span>
                <span className="tabular-nums opacity-70">{counts[nb.id] || 0}</span>
              </button>
            ))}
            <button type="button" className="notes-collection app-muted" onClick={() => setNotebooksOpen(true)}>
              <Plus size={17} aria-hidden="true" /> New notebook
            </button>
          </nav>
        </aside>

        {/* ------------------------------------------------ note list */}
        <section className="notes-list" aria-labelledby="notes-list-title">
          <header className="notes-list__head">
            <div className="min-w-0">
              <h2 id="notes-list-title" className="app-display text-[34px] truncate">{collectionTitle}</h2>
              <p className="app-muted text-sm tabular-nums">{visible.length} note{visible.length === 1 ? "" : "s"}{q ? " found" : ""}</p>
            </div>
            <button type="button" className="app-button app-button--signal !min-h-[40px]" onClick={newNote} disabled={creating} aria-label="New note">
              {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              <span className="notes-list__new-label">New</span>
            </button>
          </header>

          <div className="notes-chips cal-chips" role="group" aria-label="Collections">
            {[...collectionButtons, ...notebooks.map((nb) => ({ id: nb.id, label: nb.name }))].map((c) => (
              <button key={c.id} type="button" className="cal-chip" aria-pressed={collection === c.id} onClick={() => openCollection(c.id)}>{c.label}</button>
            ))}
            <button type="button" className="cal-chip" onClick={() => setNotebooksOpen(true)}><Settings2 size={15} aria-hidden="true" /> Notebooks</button>
          </div>

          <label className="cal-search !max-w-none mx-3 mb-2">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Search notes</span>
            <input type="search" placeholder={inNotebook ? `Search ${collectionTitle}` : "Search notes"} value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>

          <div className="notes-list__scroll">
            {isError ? (
              <div className="p-6 text-center">
                <p className="font-semibold">Couldn't load your notes</p>
                <button type="button" className="app-button mt-3" onClick={refetch}>Retry</button>
              </div>
            ) : loading ? (
              <div className="p-6 flex justify-center app-muted"><Loader2 size={22} className="animate-spin" aria-label="Loading notes" /></div>
            ) : visible.length === 0 ? (
              <div className="p-6">
                <p className="text-xl font-semibold">{emptyList().title}</p>
                <p className="app-muted mt-1">{emptyList().body}</p>
                {!q && collection !== "favorites" && (
                  <button type="button" className="app-button mt-4" onClick={newNote}><Plus size={16} /> New note</button>
                )}
              </div>
            ) : canReorder ? (
              <Reorder.Group as="ul" axis="y" values={ordered} onReorder={onReorder}>
                {ordered.map((note) => (
                  <Reorder.Item as="li" key={note.id} value={note}>{renderRow(note)}</Reorder.Item>
                ))}
              </Reorder.Group>
            ) : (
              <ul>
                {visible.map((note) => <li key={note.id}>{renderRow(note)}</li>)}
              </ul>
            )}
          </div>
        </section>

        {/* ------------------------------------------------ editor */}
        <section className="notes-editor-pane" aria-label="Editor">
          {selected ? (
            <NoteEditor
              key={selected.id}
              ref={editorRef}
              note={selected}
              notebooks={notebooks}
              onBack={() => setPane("list")}
              onMove={(notebookId) => moveNote(selected, notebookId)}
              onToggleFavorite={() => toggleFavourite(selected)}
              onDuplicate={() => duplicate(selected)}
              onDelete={(latest) => removeNote(selected, latest)}
              onCopyLink={() => copyLink(selected)}
              onNotify={notify}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <p className="text-[clamp(30px,3.5vw,44px)] font-semibold leading-tight tracking-tight">
                <span className="text-[var(--app-text-3)]">{allNotes.length ? "Pick a note" : "Nothing here yet"}</span>
                <br />
                {allNotes.length ? "or start a new one." : "Write your first note."}
              </p>
              <button type="button" className="app-button app-button--signal mt-6" onClick={newNote} disabled={creating}>
                <Plus size={18} /> New note
              </button>
            </div>
          )}
        </section>
      </div>

      <NotebooksDialog
        open={notebooksOpen}
        theme={theme}
        notebooks={notebooks}
        counts={counts}
        onCreate={createNotebookNamed}
        onRename={(id, name) => updateNotebook({ id, name }).unwrap()}
        onDelete={removeNotebook}
        onClose={() => setNotebooksOpen(false)}
      />
      <Toast toast={toast} onDismiss={dismissToast} />
    </AppShell>
  );
}
