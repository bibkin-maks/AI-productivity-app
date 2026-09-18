"""Create (or reset) the demo account used to film the promo video.

Run inside the backend container:
    docker compose exec -T backend python - < promo/seed_demo.py > promo/out/demo-token.txt

Prints a JWT for the demo user. Only the user with DEMO_ID is touched.
Remove it (and all its data) with:
    docker compose exec -T backend python - --delete < promo/seed_demo.py
"""

import asyncio
import sys
import uuid
from datetime import datetime, timedelta, timezone
from secrets import token_hex

from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings
from app.core.security import create_jwt

DEMO_ID = "demo-purr-assist"
TZ = timezone(timedelta(hours=10))  # Melbourne (AEST) — times below are local
NOW = datetime.now(TZ)
TODAY = NOW.replace(hour=0, minute=0, second=0, microsecond=0)
MONDAY = TODAY - timedelta(days=TODAY.weekday())


def at(day_offset, hour, minute=0, base=TODAY):
    return (base + timedelta(days=day_offset, hours=hour, minutes=minute)).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def event(title, day, start, end, type_="task", priority="medium", status="pending", **extra):
    h1, m1 = start
    h2, m2 = end
    return {
        "id": str(uuid.uuid4()), "title": title,
        "start": at(day, h1, m1), "end": at(day, h2, m2),
        "allDay": False, "color": "", "description": extra.pop("description", ""),
        "seriesId": None, "recurrence": "none", "recurrenceEnd": None,
        "recurrenceDays": [], "recurrenceInterval": 1,
        "workoutLog": extra.pop("workoutLog", []),
        "type": type_, "status": status, "priority": priority,
        "exceptDates": [], "amount": extra.pop("amount", None),
    }


def workout(*items):
    return [{"id": str(uuid.uuid4()), "name": n, "type": "count", "sets": s, "reps": r, "weight": w,
             "value": None, "completed": done, "comment": None} for n, s, r, w, done in items]


events = [
    # today
    event("Morning run — 5 km", 0, (7, 0), (7, 40), "workout", status="completed",
          workoutLog=workout(("Easy pace", 1, "5 km", None, True))),
    event("Review Q3 research findings", 0, (9, 30), (11, 0), "project", "high", "completed"),
    event("Design sync with product team", 0, (11, 30), (12, 15), "task", "medium", "completed"),
    event("Draft onboarding flow v2", 0, (13, 30), (15, 30), "project", "high", "in_progress"),
    event("Upper body strength", 0, (17, 30), (18, 30), "workout",
          workoutLog=workout(("Bench press", 4, 8, 60, False), ("Pull-ups", 3, 10, None, False), ("Overhead press", 3, 10, 35, False))),
    event("Groceries", 0, (19, 0), (19, 30), "expense", "low", amount="64.20"),
    event("Read 20 pages", 0, (21, 30), (22, 0), "task", "low"),
    # rest of the week
    event("Stakeholder presentation", 1, (10, 0), (11, 0), "project", "high"),
    event("1:1 with Sam", 1, (14, 0), (14, 30), "task"),
    event("Leg day", 1, (18, 0), (19, 0), "workout", workoutLog=workout(("Squats", 4, 6, 80, False), ("Lunges", 3, 12, 20, False))),
    event("Usability test session", 2, (9, 0), (10, 30), "project", "high"),
    event("Pay electricity bill", 2, (12, 0), (12, 15), "expense", "medium", amount="112.00"),
    event("Write weekly update", 3, (16, 0), (16, 45), "task"),
    event("Tennis with Jordan", 4, (8, 0), (9, 30), "workout"),
    event("Ship onboarding v2 to beta", 4, (15, 0), (16, 0), "project", "high"),
    # earlier this week (for progress + calendar density)
    event("Sprint planning", -1, (10, 0), (11, 0), "project", "medium", "completed"),
    event("Gym — push day", -1, (18, 0), (19, 0), "workout", status="completed"),
    event("Competitor teardown", -2, (13, 0), (15, 0), "project", "high", "completed"),
    event("Coffee with mentor", -2, (8, 30), (9, 15), "task", "low", "completed"),
    event("Internet bill", -3, (9, 0), (9, 10), "expense", "low", "completed", amount="79.00"),
]

nb_work, nb_ideas, nb_study = (str(uuid.uuid4()) for _ in range(3))
created = NOW - timedelta(days=12)


def note(nb, title, html, order, fav=False, age_h=0):
    t = NOW - timedelta(hours=age_h)
    return {"id": str(uuid.uuid4()), "notebook_id": nb, "title": title, "content": html,
            "is_favorite": fav, "order": order, "created_at": created, "updated_at": t}


notes = [
    note(nb_work, "Onboarding flow v2", """<h2>Goal</h2><p>Get new users to their <strong>first answered question in under 60 seconds</strong>.</p>
<h2>Changes</h2><ul data-type="taskList">
<li data-type="taskItem" data-checked="true"><p>Skip the empty dashboard — open straight into upload</p></li>
<li data-type="taskItem" data-checked="true"><p>Suggest three starter questions per document</p></li>
<li data-type="taskItem" data-checked="false"><p>Voice prompt for first-time users</p></li>
<li data-type="taskItem" data-checked="false"><p>Measure drop-off at each step</p></li></ul>
<h2>Metrics</h2><table><tbody><tr><th><p>Step</p></th><th><p>Now</p></th><th><p>Target</p></th></tr>
<tr><td><p>Sign-in → upload</p></td><td><p>62%</p></td><td><p>80%</p></td></tr>
<tr><td><p>Upload → first question</p></td><td><p>48%</p></td><td><p>70%</p></td></tr></tbody></table>""", 0, True, 1),
    note(nb_work, "Q3 research — key findings", """<p>Interviewed <strong>14 users</strong> across students and small teams.</p>
<ol><li><p>People keep PDFs, notes and plans in <em>four different apps</em>.</p></li>
<li><p>The most-loved moment: asking a question and getting the exact page back.</p></li>
<li><p>Voice is used mostly while cooking or commuting.</p></li></ol>
<blockquote><p>"I just want one place that remembers what I read." — P7</p></blockquote>""", 1, True, 5),
    note(nb_work, "Stakeholder deck outline", "<ol><li><p>Problem</p></li><li><p>What we learned</p></li><li><p>Onboarding v2</p></li><li><p>Timeline &amp; asks</p></li></ol>", 2, False, 20),
    note(nb_ideas, "Weekend project ideas", "<ul><li><p>ASCII art animator for the terminal</p></li><li><p>Habit tracker that reads my calendar</p></li><li><p>Recipe PDF → shopping list</p></li></ul>", 0, False, 30),
    note(nb_ideas, "Books to read", "<ul><li><p><em>Thinking in Systems</em> — Donella Meadows</p></li><li><p><em>The Design of Everyday Things</em></p></li><li><p><em>Deep Work</em></p></li></ul>", 1, False, 60),
    note(nb_study, "Kalman filter — summary", "<p>Estimates a system's state from <strong>noisy measurements</strong> by alternating <em>predict</em> and <em>update</em> steps.</p><pre><code>x̂ = x̂ + K (z − H x̂)</code></pre>", 0, False, 90),
]

notebooks = [
    {"id": nb_work, "name": "Work", "created_at": created},
    {"id": nb_ideas, "name": "Ideas", "created_at": created},
    {"id": nb_study, "name": "Study", "created_at": created},
]

messages = [
    {"role": "AI", "content": "Hello Alex! How can I assist you?"},
    {"role": "user", "content": "What were the three biggest findings in this report?"},
    {"role": "AI", "content": "The report highlights three findings:\n\n1. **Scattered tools** — most participants juggle PDFs, notes and plans across four or more apps.\n2. **Answers with sources win** — the moment people valued most was getting an answer *with the exact page* it came from.\n3. **Voice is situational** — it's used mainly while cooking or commuting, not at a desk.\n\nWant me to turn these into slide bullets?"},
    {"role": "user", "content": "Yes — three short bullets for the stakeholder deck."},
    {"role": "AI", "content": "- **One home for your work** — documents, notes and plans in a single place.\n- **Answers you can trust** — every reply points back to its source page.\n- **Hands-free when it matters** — voice for the moments you can't type."},
]

document = {
    "name": "Q3 User Research Report.pdf",
    "chunks": [
        "Q3 User Research Report. We interviewed 14 participants (students, freelancers and small teams) about how they read, plan and take notes.",
        "Finding 1: participants keep documents, notes and plans in four or more separate apps and lose context switching between them.",
        "Finding 2: the most valued moment was asking a question and receiving an answer with the exact source page.",
        "Finding 3: voice input is used situationally — mostly while cooking or commuting, rarely at a desk.",
    ],
}


COLLECTIONS = ("events", "notebooks", "notes", "chunks")


async def main():
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client["pdfAIReader"]
    for name in COLLECTIONS:                                   # start clean either way
        await db[name].delete_many({"user_id": DEMO_ID})
    if "--delete" in sys.argv:
        result = await db.users.delete_one({"_id": DEMO_ID})
        print(f"deleted {result.deleted_count} demo user and their data", file=sys.stderr)
        return

    user = {
        "_id": DEMO_ID, "email": "alex.rivera@example.com", "name": "Alex Rivera", "picture": None,
        "jwt_secret": token_hex(32), "messages": messages, "schema": 2,
        "document": {"name": document["name"], "chunk_count": len(document["chunks"])},
    }
    await db.users.replace_one({"_id": DEMO_ID}, user, upsert=True)
    own = lambda items: [{**item, "_id": item["id"], "user_id": DEMO_ID} for item in items]  # noqa: E731
    await db.events.insert_many(own(events))
    await db.notebooks.insert_many(own(notebooks))
    await db.notes.insert_many(own(notes))
    # chunks are embedded by the backend on the first question
    await db.chunks.insert_many([{"user_id": DEMO_ID, "index": i, "text": t} for i, t in enumerate(document["chunks"])])
    print(create_jwt(user))
    print(f"seeded demo user: {len(events)} events, {len(notes)} notes", file=sys.stderr)


asyncio.run(main())
