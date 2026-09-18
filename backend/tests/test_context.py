from app.services.context import (
    HISTORY_CHAR_BUDGET,
    MESSAGE_CHAR_CAP,
    RECENT_TURNS,
    build_history,
    system_prompt,
)


def test_history_maps_roles_and_keeps_order():
    history = build_history([{"role": "user", "content": "hi"}, {"role": "AI", "content": "hello"}])
    assert history == [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}]


def test_history_keeps_only_recent_turns():
    messages = [{"role": "user", "content": f"m{i}"} for i in range(100)]
    history = build_history(messages)
    assert len(history) == RECENT_TURNS * 2
    assert history[-1]["content"] == "m99"


def test_history_respects_the_character_budget_and_truncates_long_messages():
    messages = [{"role": "user", "content": "x" * 5000} for _ in range(10)]
    history = build_history(messages)
    assert all(len(m["content"]) <= MESSAGE_CHAR_CAP for m in history)
    assert sum(len(m["content"]) for m in history) <= HISTORY_CHAR_BUDGET


def test_system_prompt_mentions_the_document_only_when_there_is_one():
    assert "uploaded" not in system_prompt({"name": "Alex"}, None, False)
    assert '"report.pdf"' in system_prompt({"name": "Alex"}, "report.pdf", True)
