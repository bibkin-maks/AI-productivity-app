import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type CalendarEvent = {
  id: string | number;
  title?: string;
  start?: string | Date;
  end?: string | Date;
  [key: string]: any;
};

type CalendarState = {
  events: CalendarEvent[];
};

const initialState: CalendarState = {
  events: [],
};

const calendarSlice = createSlice({
  name: 'calendar',
  initialState,
  reducers: {
    setEvents: (state, action: PayloadAction<CalendarEvent[]>) => {
      state.events = action.payload;
    },
    addEvent: (state, action: PayloadAction<CalendarEvent>) => {
      state.events.push(action.payload);
    },
    updateEvent: (state, action: PayloadAction<CalendarEvent>) => {
      const index = state.events.findIndex((e) => e.id === action.payload.id);
      if (index !== -1) {
        state.events[index] = action.payload;
      }
    },
    deleteEvent: (state, action: PayloadAction<string | number>) => {
      state.events = state.events.filter((e) => e.id !== action.payload);
    },
    resetCalendar: (state) => {
      state.events = [];
    },
  },
});

export const { setEvents, addEvent, updateEvent, deleteEvent, resetCalendar } = calendarSlice.actions;

export const selectEvents = (state: { calendar: CalendarState }) => state.calendar.events;

export default calendarSlice.reducer;
