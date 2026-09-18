import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import {
  ArrowLeft, Bold, Code, Columns3, Copy, Download, FilePlus2, Heading1, Heading2, Heading3, Italic, Link2, List,
  ListChecks, ListOrdered, Loader2, MoreHorizontal, Quote, Redo2, Rows3, Star, Strikethrough, Table2, Trash2, Undo2,
} from "lucide-react";
import { useUpdateNoteMutation } from "../../slices/apiSlice";
import { countWords, displayTitle, downloadText, firstTableCsv, htmlToText, readingTime, relativeTime, safeFilename } from "./noteUtils";

const SAVE_DELAY = 800;

function ToolButton({ label, active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      className="note-tool"
      aria-label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep the editor selection
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      task: e.isActive("taskList"),
      quote: e.isActive("blockquote"),
      table: e.isActive("table"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const run = (fn) => () => fn(editor.chain().focus()).run();

  return (
    <div className="note-toolbar" role="toolbar" aria-label="Formatting">
      <ToolButton label="Heading 1" active={s.h1} onClick={run((c) => c.toggleHeading({ level: 1 }))}><Heading1 size={18} /></ToolButton>
      <ToolButton label="Heading 2" active={s.h2} onClick={run((c) => c.toggleHeading({ level: 2 }))}><Heading2 size={18} /></ToolButton>
      <ToolButton label="Heading 3" active={s.h3} onClick={run((c) => c.toggleHeading({ level: 3 }))}><Heading3 size={18} /></ToolButton>
      <span className="note-toolbar__sep" aria-hidden="true" />
      <ToolButton label="Bold" active={s.bold} onClick={run((c) => c.toggleBold())}><Bold size={17} /></ToolButton>
      <ToolButton label="Italic" active={s.italic} onClick={run((c) => c.toggleItalic())}><Italic size={17} /></ToolButton>
      <ToolButton label="Strikethrough" active={s.strike} onClick={run((c) => c.toggleStrike())}><Strikethrough size={17} /></ToolButton>
      <ToolButton label="Inline code" active={s.code} onClick={run((c) => c.toggleCode())}><Code size={17} /></ToolButton>
      <span className="note-toolbar__sep" aria-hidden="true" />
      <ToolButton label="Bullet list" active={s.bullet} onClick={run((c) => c.toggleBulletList())}><List size={18} /></ToolButton>
      <ToolButton label="Numbered list" active={s.ordered} onClick={run((c) => c.toggleOrderedList())}><ListOrdered size={18} /></ToolButton>
      <ToolButton label="Checklist" active={s.task} onClick={run((c) => c.toggleTaskList())}><ListChecks size={18} /></ToolButton>
      <ToolButton label="Quote" active={s.quote} onClick={run((c) => c.toggleBlockquote())}><Quote size={17} /></ToolButton>
      <span className="note-toolbar__sep" aria-hidden="true" />
      {s.table ? (
        <>
          <ToolButton label="Add column" onClick={run((c) => c.addColumnAfter())}><Columns3 size={17} /></ToolButton>
          <ToolButton label="Add row" onClick={run((c) => c.addRowAfter())}><Rows3 size={17} /></ToolButton>
          <ToolButton label="Delete row" onClick={run((c) => c.deleteRow())}><span className="text-xs font-bold">−R</span></ToolButton>
          <ToolButton label="Delete column" onClick={run((c) => c.deleteColumn())}><span className="text-xs font-bold">−C</span></ToolButton>
          <ToolButton label="Delete table" onClick={run((c) => c.deleteTable())}><Trash2 size={16} /></ToolButton>
        </>
      ) : (
        <ToolButton label="Insert table" onClick={run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))}><Table2 size={17} /></ToolButton>
      )}
      <span className="note-toolbar__sep" aria-hidden="true" />
      <ToolButton label="Undo" disabled={!s.canUndo} onClick={run((c) => c.undo())}><Undo2 size={17} /></ToolButton>
      <ToolButton label="Redo" disabled={!s.canRedo} onClick={run((c) => c.redo())}><Redo2 size={17} /></ToolButton>
    </div>
  );
}

function StatusPill({ status, savedAt, onRetry }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  if (status === "saving") return <span className="note-status"><Loader2 size={13} className="animate-spin" /> Saving…</span>;
  if (status === "unsaved") return <span className="note-status">Unsaved changes</span>;
  if (status === "error") {
    return (
      <span className="note-status note-status--error" role="alert">
        Couldn&apos;t save <button type="button" className="underline underline-offset-2 font-semibold" onClick={onRetry}>Retry</button>
      </span>
    );
  }
  return <span className="note-status"><span className="note-status__dot" aria-hidden="true" />{savedAt ? `Saved ${relativeTime(savedAt)}` : "Saved"}</span>;
}

// Editor for one note. Keyed by note id by the parent, so it never re-syncs from props mid-edit.
// Saves 800ms after typing stops, immediately via flush(), and on unmount if anything is pending.
const NoteEditor = forwardRef(function NoteEditor(
  { note, notebooks, onBack, onMove, onToggleFavorite, onDuplicate, onDelete, onCopyLink, onNotify },
  ref
) {
  const [updateNote] = useUpdateNoteMutation();
  const [title, setTitle] = useState(note.title || "");
  const [status, setStatus] = useState("saved");
  const [savedAt, setSavedAt] = useState(note.updated_at ? new Date(note.updated_at) : null);
  const [stats, setStats] = useState({ words: 0 });
  const [menuOpen, setMenuOpen] = useState(false);

  const draft = useRef({ title: note.title || "", content: note.content || "" });
  const saved = useRef({ ...draft.current });
  const timer = useRef(null);
  const mounted = useRef(true);
  const titleRef = useRef(null);
  const menuRef = useRef(null);

  const isDirty = () => draft.current.title !== saved.current.title || draft.current.content !== saved.current.content;

  const save = useCallback(async () => {
    clearTimeout(timer.current);
    if (!isDirty()) return;
    const snapshot = { ...draft.current };
    if (mounted.current) setStatus("saving");
    try {
      await updateNote({ id: note.id, title: snapshot.title, content: snapshot.content }).unwrap();
      saved.current = snapshot;
      if (mounted.current) {
        setSavedAt(new Date());
        setStatus(isDirty() ? "unsaved" : "saved");
      }
    } catch {
      if (mounted.current) setStatus("error");
    }
  }, [note.id, updateNote]);

  const schedule = useCallback(() => {
    setStatus("unsaved");
    clearTimeout(timer.current);
    timer.current = setTimeout(save, SAVE_DELAY);
  }, [save]);

  useImperativeHandle(ref, () => ({ flush: save, getDraft: () => ({ ...draft.current }) }), [save]);

  // flush on unmount (switching notes, leaving the page)
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      save();
    };
  }, [save]);

  // warn before closing the tab with unsaved edits
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!isDirty()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const updateStats = (html) => setStats({ words: countWords(htmlToText(html)) });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true, defaultProtocol: "https" } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: "Start writing, or type a list with “- ”, a checklist with “[ ] ”…" }),
    ],
    content: note.content || "",
    editorProps: { attributes: { class: "note-prose", "aria-label": "Note body" } },
    onCreate: ({ editor: e }) => updateStats(e.getHTML()),
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      draft.current.content = html === "<p></p>" ? "" : html;
      updateStats(html);
      schedule();
    },
  });

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (e.type === "keydown" && e.key !== "Escape") return;
      if (e.type === "mousedown" && menuRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  // auto-grow title
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  const menuAction = (fn) => async () => {
    setMenuOpen(false);
    await save();
    fn();
  };

  const exportCsv = () => {
    const csv = firstTableCsv(draft.current.content);
    if (!csv) {
      onNotify({ message: "This note has no table to export." });
      return;
    }
    downloadText(`${safeFilename(draft.current.title)}.csv`, csv, "text/csv");
  };

  const exportText = () => downloadText(`${safeFilename(draft.current.title)}.txt`, `${draft.current.title}\n\n${htmlToText(draft.current.content)}`);

  return (
    <article className="note-editor" aria-label={displayTitle({ title })}>
      <header className="note-editor__bar">
        {onBack && (
          <button type="button" className="app-icon-btn note-back" onClick={async () => { await save(); onBack(); }} aria-label="Back to notes">
            <ArrowLeft size={20} />
          </button>
        )}
        <label className="sr-only" htmlFor="note-notebook">Notebook</label>
        <select
          id="note-notebook"
          className="note-notebook-select"
          value={note.notebook_id}
          onChange={async (e) => {
            const target = e.target.value; // read before awaiting: the controlled select snaps back
            await save();
            onMove(target);
          }}
        >
          {notebooks.map((nb) => <option key={nb.id} value={nb.id}>{nb.name}</option>)}
        </select>
        <StatusPill status={status} savedAt={savedAt} onRetry={save} />
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="app-icon-btn"
            aria-pressed={Boolean(note.is_favorite)}
            aria-label={note.is_favorite ? "Remove from favourites" : "Add to favourites"}
            onClick={onToggleFavorite}
          >
            <Star size={19} className={note.is_favorite ? "fill-[var(--app-signal)] text-[var(--app-signal)]" : ""} />
          </button>
          <div className="relative" ref={menuRef}>
            <button type="button" className="app-icon-btn" aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Note actions" onClick={() => setMenuOpen((o) => !o)}>
              <MoreHorizontal size={20} />
            </button>
            {menuOpen && (
              <div role="menu" className="cal-menu">
                <button type="button" role="menuitem" onClick={menuAction(onDuplicate)}><FilePlus2 size={16} className="inline mr-2" />Duplicate</button>
                <button type="button" role="menuitem" onClick={menuAction(onCopyLink)}><Link2 size={16} className="inline mr-2" />Copy link</button>
                <button type="button" role="menuitem" onClick={menuAction(exportText)}><Download size={16} className="inline mr-2" />Download as text</button>
                <button type="button" role="menuitem" onClick={menuAction(exportCsv)}><Copy size={16} className="inline mr-2" />Export table as CSV</button>
                <button type="button" role="menuitem" className="text-[var(--app-high)]" onClick={() => {
                    setMenuOpen(false);
                    clearTimeout(timer.current);
                    // hand the latest text to onDelete (for undo) and skip the pending save
                    const latest = { ...draft.current };
                    saved.current = latest;
                    onDelete(latest);
                  }}>
                  <Trash2 size={16} className="inline mr-2" />Delete note
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="note-editor__scroll">
        <div className="note-editor__page">
          <label className="sr-only" htmlFor="note-title">Title</label>
          <textarea
            id="note-title"
            ref={titleRef}
            rows={1}
            className="note-title"
            placeholder="Untitled"
            value={title}
            onChange={(e) => {
              const value = e.target.value.replace(/\n/g, " ");
              setTitle(value);
              draft.current.title = value;
              schedule();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || (e.key === "ArrowDown" && e.target.selectionStart === e.target.value.length)) {
                e.preventDefault();
                editor?.commands.focus("start");
              }
            }}
          />
          <p className="note-meta">
            <span>{stats.words} word{stats.words === 1 ? "" : "s"}</span>
            <span aria-hidden="true">·</span>
            <span>{readingTime(stats.words)} min read</span>
            {note.created_at && (
              <>
                <span aria-hidden="true">·</span>
                <span>Created {new Date(note.created_at).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}</span>
              </>
            )}
          </p>
          {editor && <Toolbar editor={editor} />}
          <EditorContent editor={editor} />
        </div>
      </div>
    </article>
  );
});

export default NoteEditor;
