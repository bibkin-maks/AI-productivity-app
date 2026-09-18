"""Conversation memory for the assistant.

The model previously saw only the current question, so it had no idea what was just
discussed. We now replay recent turns, but bounded: history is the cheapest thing to
grow accidentally, and every request pays for it in latency and tokens.

Budget (gpt-4o-mini, 128k window — the cap here is about cost/latency, not the limit):
  · at most RECENT_TURNS exchanges (user+assistant pairs)
  · at most HISTORY_CHAR_BUDGET characters total (~4 chars per token → ~1.5k tokens)
  · a single long message is truncated to MESSAGE_CHAR_CAP so one pasted wall of text
    can't evict the rest of the conversation
Document context (~3 retrieved chunks) and the answer itself are extra, which still
leaves the prompt comfortably small.
"""

from datetime import datetime, timezone

RECENT_TURNS = 8                 # 8 exchanges ≈ 16 messages
HISTORY_CHAR_BUDGET = 6000       # ≈ 1.5k tokens
MESSAGE_CHAR_CAP = 1200          # per message
TRUNCATION_NOTE = "… (trimmed)"


def _truncate(text: str, cap: int = MESSAGE_CHAR_CAP) -> str:
    text = (text or "").strip()
    return text if len(text) <= cap else text[: cap - len(TRUNCATION_NOTE)].rstrip() + TRUNCATION_NOTE


def build_history(messages, recent_turns: int = RECENT_TURNS, char_budget: int = HISTORY_CHAR_BUDGET):
    """Newest-first walk back through the stored messages, stopping at the budget.

    Returns OpenAI-shaped messages (oldest first). The current question is NOT included;
    the caller appends it, so the last stored copy of it never duplicates.
    """
    picked = []
    used = 0
    for entry in reversed(messages or []):
        if len(picked) >= recent_turns * 2:
            break
        content = _truncate(entry.get("content", ""))
        if not content:
            continue
        if used + len(content) > char_budget:
            break
        role = "assistant" if str(entry.get("role", "")).lower() == "ai" else "user"
        picked.append({"role": role, "content": content})
        used += len(content)
    picked.reverse()
    return picked


def system_prompt(user: dict, document_name: str | None, has_context: bool) -> str:
    """Base instructions plus the few facts the assistant should always know."""
    name = (user or {}).get("name") or "the user"
    today = datetime.now(timezone.utc).strftime("%A %d %B %Y")
    lines = [
        f"You are Purr, the assistant inside a personal workspace app used by {name}.",
        f"Today is {today} (UTC).",
        "You remember the recent conversation shown in the messages above and can refer back to it.",
        "Be concise and concrete. Say plainly when you don't know something.",
    ]
    if has_context and document_name:
        lines.append(
            f'The user has uploaded "{document_name}". Relevant excerpts are provided with the question — '
            "answer from those excerpts and say so if the answer isn't in them."
        )
    elif document_name:
        lines.append(f'The user has uploaded "{document_name}", but no excerpt matched this question.')
    return " ".join(lines)
