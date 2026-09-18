import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, Eraser, History, Loader2, Mic, Sparkles, Square, Volume2, VolumeX } from "lucide-react";
import AppShell, { useAppTheme } from "../components/app/AppShell";
import Dialog from "../components/app/Dialog";
import Toast from "../components/app/Toast";
import AsciiOrb from "../components/purr/AsciiOrb";
import AsciiBackdrop from "../components/purr/AsciiBackdrop";
import { useAuth } from "../context/AuthContext";
import { useClearMessagesMutation, useSendMessageMutation } from "../slices/apiSlice";
import useVoice from "../hooks/useVoice";
import useSpeaker from "../hooks/useSpeaker";

// Answers come back as markdown (bold, lists) — render it like the chat page does
function Markdown({ text }) {
  return (
    <div className="purr__md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

const LANGUAGES = [["en-US", "EN"], ["ru-RU", "RU"]];
const VOICE_KEY = "purr-speaks";
const SUGGESTIONS = [
  "Summarise my document",
  "What should I focus on today?",
  "Explain this in simple terms",
  "Draft a short reply",
];

function historyFromUser(user) {
  return (user?.messages || []).map((m, i) => ({
    id: `srv-${i}`,
    role: m.role?.toLowerCase() === "ai" ? "ai" : "user",
    text: m.content || "",
  }));
}

function ConversationDialog({ open, theme, messages, onClose, onClear, clearing, onSpeak }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!open) setArmed(false);
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      theme={theme}
      title="Conversation"
      description={messages.length ? `${messages.length} message${messages.length === 1 ? "" : "s"} · Purr remembers the recent ones` : "Nothing yet."}
      footer={
        <button
          type="button"
          className={`app-button ${armed ? "app-button--danger" : ""}`}
          disabled={!messages.length || clearing}
          onClick={() => (armed ? onClear().then(() => setArmed(false)) : setArmed(true))}
        >
          {clearing ? <Loader2 size={16} className="animate-spin" /> : <Eraser size={16} />}
          {armed ? "Tap again to clear" : "Clear conversation"}
        </button>
      }
    >
      <ul className="space-y-5">
        {messages.map((m) => (
          <li key={m.id}>
            <p className="app-label mb-1 flex items-center gap-2">
              {m.role === "ai" ? "Purr" : "You"}
              {m.role === "ai" && onSpeak && (
                <button type="button" className="app-icon-btn !w-7 !h-7" onClick={() => onSpeak(m.text)} aria-label="Read this answer aloud">
                  <Volume2 size={14} />
                </button>
              )}
            </p>
            {m.role === "ai" ? <Markdown text={m.text} /> : <p className="whitespace-pre-wrap app-muted">{m.text}</p>}
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

export default function PurrAssist() {
  const [theme, toggleTheme] = useAppTheme();
  const { user, refreshUser } = useAuth();
  const [sendMessage, { isLoading: sending }] = useSendMessageMutation();
  const [clearMessages, { isLoading: clearing }] = useClearMessagesMutation();

  const [messages, setMessages] = useState(() => historyFromUser(user));
  const [input, setInput] = useState("");
  const [reaction, setReaction] = useState(null);
  const [mood, setMood] = useState(null);
  const [tint, setTint] = useState(null);
  const [toast, setToast] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [language, setLanguage] = useState("en-US");
  const [voiceOn, setVoiceOn] = useState(() => {
    try {
      return localStorage.getItem(VOICE_KEY) === "on";
    } catch {
      return false;
    }
  });

  const mic = useVoice(language);
  const speaker = useSpeaker(language);
  const inputRef = useRef(null);
  const syncedRef = useRef(false);

  // seed from the server history once; later turns are appended locally
  useEffect(() => {
    if (syncedRef.current || !user) return;
    syncedRef.current = true;
    setMessages(historyFromUser(user));
  }, [user]);

  // speech goes straight into the input — live in browser mode, after stopping in recorder mode
  useEffect(() => {
    if (mic.transcript) setInput(mic.transcript);
  }, [mic.transcript]);

  // surface microphone problems instead of a dead button
  useEffect(() => {
    if (mic.error) {
      setToast({ tone: mic.error.startsWith("Switched to") ? "info" : "error", message: mic.error });
      mic.clearError();
    }
  }, [mic]);

  useEffect(() => {
    try {
      localStorage.setItem(VOICE_KEY, voiceOn ? "on" : "off");
    } catch {
      // storage unavailable
    }
  }, [voiceOn]);

  const lastAnswer = useMemo(() => [...messages].reverse().find((m) => m.role === "ai"), [messages]);
  const lastQuestion = useMemo(() => [...messages].reverse().find((m) => m.role === "user"), [messages]);

  const orbState = sending || mic.transcribing ? "thinking" : mic.listening ? "listening" : speaker.speaking ? "speaking" : "idle";
  const statusText = sending
    ? "Thinking…"
    : mic.transcribing
      ? "Writing that down…"
      : mic.listening
        ? mic.mode === "recorder" ? "Recording… tap the mic to finish" : "Listening…"
        : speaker.speaking
        ? "Speaking…"
          : mood
            ? `Feeling ${mood}`
            : "Ask me anything";

  const ask = useCallback(
    async (text) => {
      const question = (text ?? input).trim();
      if (!question || sending) return;
      if (mic.listening) mic.stop();
      speaker.stop();
      setInput("");
      setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: "user", text: question }]);

      try {
        const response = await sendMessage({ question }).unwrap();
        setMessages((prev) => [...prev, { id: `local-${Date.now()}-ai`, role: "ai", text: response.answer }]);
        if (response.orb) {
          setMood(response.orb.mood || null);
          setTint(response.orb.hue ?? null);
          setReaction({ id: `${Date.now()}`, spec: response.orb });
        }
        if (voiceOn) speaker.speak(response.answer);
        refreshUser?.();
      } catch (err) {
        const expired = err?.status === 401 || err?.status === 402;
        setToast({ tone: "error", message: expired ? "Your session expired. Please sign in again." : "Purr couldn't answer just now. Try again." });
        setMessages((prev) => prev.slice(0, -1));
        setInput(question);
      } finally {
        inputRef.current?.focus();
      }
    },
    [input, sending, mic, speaker, sendMessage, voiceOn, refreshUser]
  );

  const clearConversation = async () => {
    try {
      await clearMessages().unwrap();
      setMessages([]);
      setMood(null);
      speaker.stop();
      await refreshUser?.();
      setHistoryOpen(false);
      setToast({ message: "Conversation cleared" });
    } catch {
      setToast({ tone: "error", message: "Couldn't clear the conversation." });
    }
  };

  const showSuggestions = !sending && !input.trim() && !mic.listening;

  return (
    <AppShell theme={theme} onToggleTheme={toggleTheme} fill>
      <div className="purr" style={tint == null ? undefined : { "--orb-hue": tint }}>
        <header className="purr__bar">
          <p className="app-label">Purr Assist</p>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              className="app-button !min-h-[36px] !px-3 !text-sm"
              onClick={() => setLanguage((l) => (l === "en-US" ? "ru-RU" : "en-US"))}
              aria-label={`Voice language: ${language === "en-US" ? "English" : "Russian"}`}
            >
              {LANGUAGES.find(([id]) => id === language)?.[1]}
            </button>
            {speaker.supported && (
              <button
                type="button"
                className={`app-icon-btn ${voiceOn ? "!text-[var(--app-signal)]" : ""}`}
                aria-pressed={voiceOn}
                aria-label={`Purr speaks answers: ${voiceOn ? "on" : "off"}${speaker.usingLocalVoice ? " (local voice)" : ""}`}
                title={speaker.usingLocalVoice ? "Purr's own voice (local)" : "Browser voice"}
                onClick={() => {
                  const next = !voiceOn;
                  setVoiceOn(next);
                  if (!next) speaker.stop();
                  else if (lastAnswer) speaker.speak(lastAnswer.text);
                }}
              >
                {voiceOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>
            )}
            <button type="button" className="app-icon-btn" onClick={() => setHistoryOpen(true)} aria-label="Conversation history">
              <History size={20} />
            </button>
          </div>
        </header>

        <div className="purr__stage">
          <AsciiBackdrop intensity={reaction ? 1.8 : sending ? 1.3 : speaker.speaking ? 1.4 : 1} />

          <h1 className="purr__headline">
            <span className="purr__headline-dim">
              {sending ? "Thinking about" : mic.listening ? "Go ahead," : speaker.speaking ? "Reading out" : mood ? "Purr replied" : "Ask Purr"}
            </span>
            <br />
            {sending
              ? `${(lastQuestion?.text || "your question").slice(0, 44)}…`
              : mic.listening
                ? "I'm listening."
                : speaker.speaking
                  ? "the answer."
                  : mood
                    ? `${mood}.`
                    : "anything."}
          </h1>

          <AsciiOrb state={orbState} reaction={reaction} tint={tint} onReactionEnd={() => setReaction(null)} />

          <p className="purr__status" role="status">
            {sending || mic.transcribing ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
            {statusText}
            {speaker.speaking && (
              <button type="button" className="purr__stop" onClick={speaker.stop}>
                <Square size={11} /> Stop
              </button>
            )}
          </p>

          <div className="purr__answer" aria-live="polite">
            {lastAnswer ? (
              <Markdown text={lastAnswer.text} />
            ) : (
              <p className="app-muted">Purr remembers your recent messages and answers from your uploaded document when there is one.</p>
            )}
          </div>
        </div>

        {showSuggestions && (
          <div className="purr__suggestions" aria-label="Suggestions">
            {SUGGESTIONS.map((suggestion) => (
              <button key={suggestion} type="button" className="cal-chip" onClick={() => ask(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <form
          className="chat-composer purr__composer"
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
        >
          {mic.supported && (
            <button
              type="button"
              className={`app-icon-btn ${mic.listening ? "!text-[var(--app-signal)]" : ""}`}
              onClick={mic.toggle}
              aria-pressed={mic.listening}
              disabled={mic.transcribing}
              aria-label={mic.listening ? "Stop listening" : "Speak your question"}
              title={mic.mode === "recorder" ? "Record, then Purr transcribes it" : "Speak your question"}
            >
              {mic.transcribing ? <Loader2 size={18} className="animate-spin" /> : mic.listening ? <Square size={18} /> : <Mic size={19} />}
            </button>
          )}
          <label className="sr-only" htmlFor="purr-input">Message</label>
          <input
            id="purr-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mic.listening ? (mic.mode === "recorder" ? "Recording…" : "Listening…") : mic.transcribing ? "Writing that down…" : "Ask Purr anything"}
            autoComplete="off"
          />
          <button type="submit" className="chat-send" disabled={!input.trim() || sending} aria-label="Send">
            {sending ? <Loader2 size={20} className="animate-spin" /> : <ArrowUp size={22} strokeWidth={2.4} />}
          </button>
        </form>
      </div>

      <ConversationDialog
        open={historyOpen}
        theme={theme}
        messages={messages}
        clearing={clearing}
        onClose={() => setHistoryOpen(false)}
        onClear={clearConversation}
        onSpeak={speaker.supported ? speaker.speak : null}
      />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </AppShell>
  );
}
