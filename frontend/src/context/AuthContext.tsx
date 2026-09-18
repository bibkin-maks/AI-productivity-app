import {
    createContext,
    useContext,
    useState,
    useEffect,
    useMemo,
    ReactNode,
} from "react";
import { useGetUserQuery, api } from "../slices/apiSlice";
import { dispatch } from "../store/store";
import { setCredentials, logOut } from "../slices/authSlice";
import { resetCalendar } from "../slices/calendarSlice";

import { User } from "../types";

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (userData: User, jwtToken: string) => void;
    logout: () => void;
    refreshUser: () => Promise<void>;
    isAuthenticated: boolean;
    isUserLoading: boolean;
    userErr: unknown;
    userStorageKey: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

const isTokenExpired = (token: string): boolean => {
    try {
        const [, payload] = token.split(".");
        const decoded = JSON.parse(atob(payload));
        if (!decoded.exp) return false;
        return decoded.exp * 1000 < Date.now();
    } catch {
        return false;
    }
};

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);

    const {
        data: fetchedUser,
        isLoading: isUserLoading,
        error: userErr,
        refetch,
    } = useGetUserQuery(undefined, {
        skip: !token,
    });

    // Load user + token on mount
    useEffect(() => {
        try {
            const storedUser = localStorage.getItem("user");
            const storedToken = localStorage.getItem("token");

            if (storedToken) {
                if (isTokenExpired(storedToken)) {
                    localStorage.removeItem("user");
                    localStorage.removeItem("token");
                    return;
                }
                setToken(storedToken);
            }

            if (storedUser) {
                setUser(JSON.parse(storedUser));
            }
        } catch (err) {
            console.error("Failed to load auth from storage:", err);
        }
    }, []);

    // When backend user arrives, sync it
    useEffect(() => {
        if (fetchedUser) {
            setUser(fetchedUser);
            localStorage.setItem("user", JSON.stringify(fetchedUser));
        }
    }, [fetchedUser]);

    const login = (userData: User, jwtToken: string) => {
        setUser(userData);
        setToken(jwtToken);
        localStorage.setItem("user", JSON.stringify(userData));
        localStorage.setItem("token", jwtToken);
        // Sync with Redux
        dispatch(setCredentials({ user: userData, token: jwtToken }));
    };

    const logout = () => {
        // 1. Identify key before clearing user
        // FIX: Usage of _id instead of id
        const keyToRemove = user ? `calendar_events_${user._id}` : null;

        // 2. Clear Context State
        setUser(null);
        setToken(null);

        // 3. Clear Storage
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        if (keyToRemove) {
            localStorage.removeItem(keyToRemove);
        }

        // 4. Reset Redux State
        dispatch(logOut());
        dispatch(api.util.resetApiState());
        dispatch(resetCalendar());
    };

    const refreshUser = async () => {
        if (!token) return;

        const result = await refetch();
        if (result.data) {
            setUser(result.data);
            localStorage.setItem("user", JSON.stringify(result.data));
        }
    };

    // Derived storage key for user-specific data (e.g. calendar events)
    const userStorageKey = useMemo(() => {
        // FIX: Usage of _id instead of id
        return user ? `calendar_events_${user._id}` : null;
    }, [user]);

    const value = useMemo(
        () => ({
            user,
            token,
            login,
            logout,
            refreshUser,
            isAuthenticated: Boolean(token),
            isUserLoading,
            userErr,
            userStorageKey,
        }),
        [user, token, isUserLoading, userErr, userStorageKey]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
