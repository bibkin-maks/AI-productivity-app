import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BookOpenCheck, CalendarDays, MessageSquare, NotebookPen, Sparkles, Moon, Sun, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSignoutMutation } from "../../slices/apiSlice";
import { PurrAssistLogo } from "../../assets/svgAssets";
import "./app.css";

export const APP_NAV = [
  { label: "Diary", path: "/diary", icon: BookOpenCheck },
  { label: "Chat", path: "/chat", icon: MessageSquare },
  { label: "Notes", path: "/notes", icon: NotebookPen },
  { label: "Calendar", path: "/calendar", icon: CalendarDays },
  { label: "Purr", path: "/purr-assist", icon: Sparkles },
];

const THEME_KEY = "app-theme";

function readTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // storage unavailable
  }
  return "dark";
}

export function useAppTheme() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // storage unavailable: theme just won't persist
    }
  }, [theme]);
  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  return [theme, toggle];
}

// Shared frame for the signed-in pages: side rail on desktop, floating tab bar on mobile.
export default function AppShell({ children, theme, onToggleTheme, fill = false }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { token, logout } = useAuth();
  const [signout] = useSignoutMutation();

  useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);

  const handleSignOut = async () => {
    try {
      await signout().unwrap();
    } catch {
      // sign out locally even if the server call fails
    }
    logout();
    navigate("/login");
  };

  return (
    <div className="app" data-theme={theme}>
      <nav className="app-rail" aria-label="App">
        <Link to="/" className="mb-4" aria-label="ChatDoc home">
          <PurrAssistLogo className="w-9 h-9" />
        </Link>
        {APP_NAV.map(({ label, path, icon: Icon }) => (
          <Link key={path} to={path} className="app-rail__link" aria-current={pathname === path ? "page" : undefined}>
            <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
            {label}
          </Link>
        ))}
        <div className="mt-auto flex flex-col items-center gap-2">
          <button type="button" className="app-icon-btn" onClick={onToggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button type="button" className="app-icon-btn" onClick={handleSignOut} aria-label="Sign out">
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      <main className={`app-main ${fill ? "app-main--fill" : ""}`}>{children}</main>

      <nav className="app-tabbar" aria-label="App">
        {APP_NAV.slice(0, 4).map(({ label, path, icon: Icon }) => (
          <Link key={path} to={path} className="app-tabbar__link" aria-current={pathname === path ? "page" : undefined}>
            <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
