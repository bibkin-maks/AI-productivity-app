import React, { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";

// Lazy Load Pages
const Main = React.lazy(() => import("./pages/Main"));
const Chat = React.lazy(() => import("./pages/Chat"));
const Login = React.lazy(() => import("./pages/Login"));
const Notes = React.lazy(() => import("./pages/Notes"));
const PurrAssist = React.lazy(() => import("./pages/PurrAssist"));
const CalendarPage = React.lazy(() => import("./pages/CalendarPage"));
const Diary = React.lazy(() => import("./pages/Diary"));

function App() {
  return (
    <>
      <ErrorBoundary>
        <Suspense fallback={
          <div className="flex items-center justify-center h-screen w-full bg-[#0f1115] text-cyan-500">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
          </div>
        }>
          <Routes>
            {/* Public Pages */}
            <Route path="/" element={<Main />} />
            <Route path="/login" element={<Login />} />

            {/* Chat (Protected) */}
            <Route path="/chat" element={<Chat />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/diary" element={<Diary />} />
            <Route path="/purr-assist" element={<PurrAssist />} />

            {/* Catch-all → redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
}

export default App;
