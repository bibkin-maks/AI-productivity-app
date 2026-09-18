from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Literal
from enum import Enum
import uuid
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class RecurrenceType(str, Enum):
    none = "none"
    daily = "daily"
    weekly = "weekly"
    biweekly = "biweekly"
    monthly = "monthly"
    yearly = "yearly"
    weekdays = "weekdays"          # repeat on specific days of the week
    every_n_weeks = "every_n_weeks"  # repeat every N weeks

class EventType(str, Enum):
    task = "task"
    project = "project"
    expense = "expense"
    workout = "workout"

class EventStatus(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    blocked = "blocked"

class EventPriority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"

# ---------------------------------------------------------------------------
# WorkoutLogItem
# ---------------------------------------------------------------------------

class WorkoutLogItem(BaseModel):
    id: Optional[str] = None
    name: str
    type: Literal["count", "single", "tick", "text"]
    sets: Optional[str | int] = None
    reps: Optional[str | int] = None
    value: Optional[str | int] = None
    completed: Optional[bool] = None
    weight: Optional[str | int] = None
    comment: Optional[str] = None

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_iso(value: str, field: str) -> datetime:
    """Parse an ISO 8601 string; raise ValueError with a clear message."""
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise ValueError(f"'{field}' must be a valid ISO 8601 datetime string, got: {value!r}")


# ---------------------------------------------------------------------------
# Event models
# ---------------------------------------------------------------------------

class Event(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    start: str
    end: str
    allDay: bool = False
    color: str = "#3788d8"
    description: str = ""
    seriesId: Optional[str] = None
    recurrence: RecurrenceType = RecurrenceType.none
    recurrenceEnd: Optional[str] = None
    recurrenceDays: List[int] = []       # weekday numbers [0=Mon…6=Sun] for 'weekdays' mode
    recurrenceInterval: int = 1          # N for 'every_n_weeks' mode
    workoutLog: List[WorkoutLogItem] = []
    type: EventType = EventType.task
    status: EventStatus = EventStatus.pending
    priority: EventPriority = EventPriority.medium
    exceptDates: List[str] = []
    amount: Optional[str] = None


class CreateEventRequest(BaseModel):
    title: str
    start: str
    end: str
    allDay: bool = False
    color: str = "#3788d8"
    description: str = ""
    seriesId: Optional[str] = None
    recurrence: RecurrenceType = RecurrenceType.none
    recurrenceEnd: Optional[str] = None
    recurrenceDays: List[int] = []
    recurrenceInterval: int = 1
    workoutLog: List[WorkoutLogItem] = []
    type: EventType = EventType.task
    status: EventStatus = EventStatus.pending
    priority: EventPriority = EventPriority.medium
    exceptDates: List[str] = []
    amount: Optional[str] = None

    @model_validator(mode="after")
    def validate_dates(self):
        start_dt = _parse_iso(self.start, "start")
        end_dt = _parse_iso(self.end, "end")
        if not self.allDay and end_dt < start_dt:
            raise ValueError(f"'end' ({self.end}) must not be before 'start' ({self.start})")
        return self


class UpdateEventRequest(BaseModel):
    title: str
    start: str
    end: str
    allDay: bool
    color: str
    description: str
    seriesId: Optional[str] = None
    recurrence: RecurrenceType
    recurrenceEnd: Optional[str] = None
    recurrenceDays: List[int] = []
    recurrenceInterval: int = 1
    workoutLog: List[WorkoutLogItem]
    type: EventType
    status: EventStatus
    priority: EventPriority
    exceptDates: List[str] = []
    amount: Optional[str] = None

    @model_validator(mode="after")
    def validate_dates(self):
        start_dt = _parse_iso(self.start, "start")
        end_dt = _parse_iso(self.end, "end")
        if not self.allDay and end_dt < start_dt:
            raise ValueError(f"'end' ({self.end}) must not be before 'start' ({self.start})")
        return self
