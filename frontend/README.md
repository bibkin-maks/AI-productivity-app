# Frontend — React + Vite

The web app: landing page, Google sign-in, document chat, notes, calendar, diary and the
Purr Assist voice assistant.

## Run

With Docker, from the repo root: `docker compose up --build` (see the root README).

Without Docker (backend running on http://localhost:8000):

```bash
cd frontend
npm install
cp .env.example .env    # Google client ID + backend URL
npm run dev             # http://localhost:5173
```

## Stack

React 19, React Router, Redux Toolkit (RTK Query for the API), Tailwind CSS, Framer Motion,
Three.js (landing page particles), Tiptap (notes editor), react-big-calendar,
`@react-oauth/google`.

## Layout

```
src/
  pages/        one file per route: Main, Login, Chat, Notes, CalendarPage, Diary, PurrAssist
  components/
    home/       landing page particles, cursor, reveal animation, palettes
    landing/    landing page sections
    app/        signed-in shell, dialogs, toasts, shared styles
    calendar/ diary/ notes/ purr/   feature components
  slices/       RTK Query API + auth and calendar state
  store/        Redux store and chat state
  hooks/        voice input and speech output
```
