import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ChevronDown, Eraser, FileText, Moon, Sun } from "lucide-react";
import AppShell, { useAppTheme } from "../components/app/AppShell";
import ChatInterface from "../components/ChatInterface";
import FileUpload from "../components/FileUpload";
import { useAuth } from "../context/AuthContext";
import { useClearMessagesMutation } from "../slices/apiSlice";
import { setMessages } from "../store/chatSlice";

// Two-tap clear so history isn't wiped by a stray click
function ClearHistoryButton({ disabled }) {
  const dispatch = useDispatch();
  const { refreshUser } = useAuth();
  const [clearMessages, { isLoading }] = useClearMessagesMutation();
  const [armed, setArmed] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  const onClick = async () => {
    if (!armed) {
      setArmed(true);
      setFailed(false);
      return;
    }
    try {
      await clearMessages().unwrap();
      dispatch(setMessages([]));
      await refreshUser();
      setArmed(false);
    } catch {
      setFailed(true);
      setArmed(false);
    }
  };

  return (
    <button
      type="button"
      className={`app-button !min-h-[40px] !px-3 !text-sm ${armed ? "!bg-[var(--app-high)] !text-[#1a0505]" : ""}`}
      onClick={onClick}
      disabled={disabled || isLoading}
    >
      <Eraser size={16} aria-hidden="true" />
      <span className="hidden sm:inline">{failed ? "Couldn't clear" : armed ? "Tap again to clear" : "Clear chat"}</span>
      <span className="sm:hidden">{armed ? "Confirm" : "Clear"}</span>
    </button>
  );
}

function SessionCard({ questions, documentName }) {
  return (
    <div className="app-card">
      <p className="app-label">This session</p>
      <div className="grid grid-cols-2 gap-2 mt-4">
        <div className="rounded-xl p-4 bg-[var(--app-surface-2)]">
          <p className="text-sm app-muted">Questions</p>
          <p className="text-4xl font-light mt-2 tabular-nums">{questions}</p>
        </div>
        <div className="rounded-xl p-4 bg-[var(--app-surface-2)]">
          <p className="text-sm app-muted">Source</p>
          <p className="text-lg font-semibold mt-3 leading-tight">{documentName ? "1 document" : "None yet"}</p>
        </div>
      </div>
      <p className="app-muted text-sm mt-4 leading-relaxed">
        Purr answers from the uploaded document only. Replacing it starts a new source for your next questions.
      </p>
    </div>
  );
}

export default function Chat() {
  const [theme, toggleTheme] = useAppTheme();
  const { user } = useAuth();
  const messages = useSelector((state) => state.chat.messages);

  const documentName = user?.document?.name || null;
  const questions = messages.filter((m) => m.sender === "user").length;

  return (
    <AppShell theme={theme} onToggleTheme={toggleTheme} fill>
      <div className="chat-layout">
        {/* Mobile: document panel folds above the conversation */}
        <details className="doc-mobile app-card !p-0">
          <summary className="flex items-center gap-3 px-4 py-3">
            <FileText size={18} className="text-[var(--app-signal)] flex-none" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate font-medium">{documentName || "Add a document"}</span>
            <ChevronDown size={18} className="doc-mobile__chevron transition-transform" aria-hidden="true" />
          </summary>
          <div className="px-3 pb-3">
            <FileUpload variant="app" />
          </div>
        </details>

        <section className="chat-main" aria-labelledby="chat-title">
          <header className="chat-head">
            <div className="min-w-0">
              <h1 id="chat-title" className="app-display text-[clamp(30px,3vw,40px)]">Chat</h1>
              <p className="app-muted text-sm truncate">{documentName ? `Asking about ${documentName}` : "No document loaded"}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="app-icon-btn app-icon-btn--mobile"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              >
                {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <ClearHistoryButton disabled={messages.length === 0} />
            </div>
          </header>
          <ChatInterface documentName={documentName} />
        </section>

        <aside className="doc-panel" aria-label="Document">
          <FileUpload variant="app" />
          <SessionCard questions={questions} documentName={documentName} />
        </aside>
      </div>
    </AppShell>
  );
}
