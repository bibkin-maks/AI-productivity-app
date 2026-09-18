import { useEffect, useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import Dialog from "../app/Dialog";

// Create, rename and delete notebooks. Deleting asks for a second tap and says how many notes go with it.
export default function NotebooksDialog({ open, theme, notebooks, counts, onCreate, onRename, onDelete, onClose }) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(null); // { id, name }
  const [armed, setArmed] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setEditing(null);
      setArmed(null);
      setError("");
    }
  }, [open]);

  const run = async (fn) => {
    setError("");
    try {
      await fn();
      return true;
    } catch {
      setError("That didn't save. Please try again.");
      return false;
    }
  };

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (await run(() => onCreate(name.trim()))) setName("");
  };

  const rename = async (e) => {
    e.preventDefault();
    if (!editing?.name.trim()) return;
    if (await run(() => onRename(editing.id, editing.name.trim()))) setEditing(null);
  };

  return (
    <Dialog open={open} onClose={onClose} theme={theme} title="Notebooks" description="Group notes by project, topic or anything else.">
      <form onSubmit={create} className="flex gap-2 mb-6">
        <label htmlFor="new-notebook" className="sr-only">New notebook name</label>
        <input id="new-notebook" className="app-input" placeholder="New notebook name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        <button type="submit" className="app-button app-button--signal flex-none" disabled={!name.trim()}>Create</button>
      </form>

      {notebooks.length === 0 ? (
        <p className="app-muted">No notebooks yet.</p>
      ) : (
        <ul>
          {notebooks.map((nb) => (
            <li key={nb.id} className="flex items-center gap-2 py-3 border-t border-[var(--app-line-strong)] last:border-b">
              {editing?.id === nb.id ? (
                <form onSubmit={rename} className="flex flex-1 items-center gap-2">
                  <label htmlFor={`rename-${nb.id}`} className="sr-only">Notebook name</label>
                  <input
                    id={`rename-${nb.id}`}
                    className="app-input"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    autoFocus
                  />
                  <button type="submit" className="app-icon-btn" aria-label="Save name"><Check size={18} /></button>
                  <button type="button" className="app-icon-btn" aria-label="Cancel rename" onClick={() => setEditing(null)}><X size={18} /></button>
                </form>
              ) : (
                <>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold truncate">{nb.name}</span>
                    <span className="block text-sm app-muted">{counts[nb.id] || 0} note{counts[nb.id] === 1 ? "" : "s"}</span>
                  </span>
                  {armed === nb.id ? (
                    <>
                      <button type="button" className="app-button app-button--danger !min-h-[36px] !text-sm" onClick={() => run(() => onDelete(nb.id)).then(() => setArmed(null))}>
                        Delete{counts[nb.id] ? ` with ${counts[nb.id]} note${counts[nb.id] === 1 ? "" : "s"}` : ""}
                      </button>
                      <button type="button" className="app-icon-btn" aria-label="Keep notebook" onClick={() => setArmed(null)}><X size={18} /></button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="app-icon-btn" aria-label={`Rename ${nb.name}`} onClick={() => setEditing({ id: nb.id, name: nb.name })}><Pencil size={17} /></button>
                      <button type="button" className="app-icon-btn" aria-label={`Delete ${nb.name}`} onClick={() => setArmed(nb.id)}><Trash2 size={17} /></button>
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm mt-3 text-[var(--app-high)]" role="alert">{error}</p>}
    </Dialog>
  );
}
