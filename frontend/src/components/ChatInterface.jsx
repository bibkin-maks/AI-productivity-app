import { useState, useRef, useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight, ArrowUp, Check, Copy, Loader2 } from "lucide-react";
import { addUserMessage, addBotMessage, setMessages } from "../store/chatSlice";
import { useAuth } from "../context/AuthContext";
import { useSendMessageMutation } from "../slices/apiSlice";

// --- Suggested starter prompts ---
const SUGGESTED_PROMPTS = [
  "Summarise this document",
  "What are the key takeaways?",
  "List the main conclusions",
  "What questions does this document answer?",
];

function formatTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Small spinning gradient orb that stands in for the assistant's avatar
export const PurrOrb = ({ size = "sm" }) => (
  <span className={`assist-orb assist-orb--${size} block`} aria-hidden="true">
    <span className="assist-orb__inner" />
  </span>
);

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable: nothing to do
    }
  }, [text]);

  return (
    <button type="button" onClick={handleCopy} className="chat-copy app-icon-btn !w-8 !h-8" aria-label={copied ? "Copied" : "Copy answer"}>
      {copied ? <Check size={15} /> : <Copy size={15} />}
    </button>
  );
}

const markdownComponents = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

const MessageBubble = ({ message }) => {
  if (message.sender === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
        className="chat-msg-user"
      >
        {message.text}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      className="chat-msg-bot"
    >
      <PurrOrb />
      <div className="min-w-0">
        <div className="chat-msg-meta">
          <span className="app-label">Purr</span>
          <span className="text-xs app-muted tabular-nums">{formatTime(message.timestamp)}</span>
          <CopyButton text={message.text} />
        </div>
        <div className="chat-prose">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {message.text}
          </ReactMarkdown>
        </div>
      </div>
    </motion.div>
  );
};

const EmptyState = ({ documentName, onPromptClick }) => (
  <div className="flex-1 flex flex-col justify-center py-6">
    <PurrOrb size="md" />
    <h2 className="text-[clamp(34px,4.5vw,52px)] font-semibold leading-[1.02] tracking-tight mt-8">
      <span className="text-[var(--app-text-3)]">{documentName ? "Ask anything" : "Upload a document"}</span>
      <br />
      {documentName ? "about your document." : "to start chatting."}
    </h2>
    <p className="app-muted text-lg mt-4 max-w-lg">
      {documentName
        ? <>Answers come straight from <span className="text-[var(--app-text)] font-medium break-words">{documentName}</span>.</>
        : "Drop a PDF into the document panel, then ask questions about it."}
    </p>

    {documentName && (
      <ul className="mt-10" aria-label="Suggested questions">
        {SUGGESTED_PROMPTS.map((prompt, i) => (
          <li key={prompt}>
            <button type="button" className="chat-suggest" onClick={() => onPromptClick(prompt)}>
              <span className="app-label tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex-1">{prompt}</span>
              <ArrowRight size={18} className="text-[var(--app-text-3)]" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    )}
  </div>
);

// ============================================================
// Main Component
// ============================================================
const ChatInterface = ({ documentName }) => {
  const dispatch = useDispatch();
  const messages = useSelector((state) => state.chat.messages);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { user, logout } = useAuth();
  const [sendMessage] = useSendMessageMutation();

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // --- Sync with the history stored on the user ---
  useEffect(() => {
    if (!user || !user.messages) {
      if (messages.length > 0) dispatch(setMessages([]));
      return;
    }

    const formatted = user.messages.map((m, i) => ({
      id: i + 1,
      text: m.content,
      sender: m.role.toLowerCase() === "ai" ? "bot" : "user",
      timestamp: Date.now() - (user.messages.length - i) * 60000, // approximate past times
    }));

    if (JSON.stringify(formatted.map((m) => m.text)) !== JSON.stringify(messages.map((m) => m.text))) {
      dispatch(setMessages(formatted));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dispatch]);

  // --- Auto-scroll ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, isLoading]);

  // --- Auto-resize textarea ---
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  }, [input]);

  const handleSendMessage = useCallback(async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text || isLoading) return;

    dispatch(addUserMessage({ text, timestamp: Date.now() }));
    setInput("");
    setIsLoading(true);

    try {
      const response = await sendMessage({ question: text }).unwrap();
      dispatch(addBotMessage({ text: response.answer, timestamp: Date.now() }));
    } catch (err) {
      if (err.status === 401 || err.status === 402) {
        dispatch(setMessages([]));
        dispatch(addBotMessage({ text: "Your session expired. Please sign in again.", timestamp: Date.now() }));
        logout && logout();
      } else {
        dispatch(addBotMessage({ text: "I couldn't get a response just now. Please try again.", timestamp: Date.now() }));
      }
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  }, [input, isLoading, sendMessage, dispatch, logout]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const canSend = Boolean(input.trim()) && !isLoading;

  return (
    <>
      <div className="chat-scroll" aria-live="polite">
        <div className="chat-thread">
          {messages.length === 0 && !isLoading ? (
            <EmptyState documentName={documentName} onPromptClick={(p) => handleSendMessage(p)} />
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </AnimatePresence>
          )}

          {isLoading && (
            <div className="chat-msg-bot">
              <PurrOrb />
              <div>
                <div className="chat-msg-meta"><span className="app-label">Purr</span></div>
                <span className="chat-typing" aria-label="Purr is thinking">
                  <span /><span /><span />
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="chat-composer-wrap">
        <form
          className="chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
        >
          <label htmlFor="chat-input" className="sr-only">Message</label>
          <textarea
            id="chat-input"
            ref={textareaRef}
            placeholder={documentName ? "Ask about your document…" : "Ask a question…"}
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button type="submit" className="chat-send" disabled={!canSend} aria-label="Send message">
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <ArrowUp size={22} strokeWidth={2.4} />}
          </button>
        </form>
        <p className="text-center text-xs app-muted mt-2 hidden sm:block">
          Enter to send · Shift+Enter for a new line · Answers are AI-generated, check important details
        </p>
      </div>
    </>
  );
};

export default ChatInterface;
