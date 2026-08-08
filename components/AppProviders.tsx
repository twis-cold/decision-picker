"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { EarningsHour, EarningsResponse, SessionInfo } from "@/lib/types";

interface AppState {
  email: string | null;
  pro: boolean;
  userLoaded: boolean;
  beginner: boolean;
  setBeginner: (on: boolean) => void;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
  watchlist: string[];
  isWatched: (symbol: string) => boolean;
  toggleWatch: (symbol: string) => void;
  earningsToday: Record<string, EarningsHour>;
}

const AppContext = createContext<AppState>({
  email: null,
  pro: false,
  userLoaded: false,
  beginner: false,
  setBeginner: () => {},
  refreshUser: async () => {},
  signOut: async () => {},
  watchlist: [],
  isWatched: () => false,
  toggleWatch: () => {},
  earningsToday: {},
});

const BEGINNER_KEY = "tsd-beginner";
const WATCHLIST_KEY = "tsd-watchlist";

// TODO(production): the watchlist lives in localStorage, so it's per-browser
// even when signed in — the demo auth has no database to attach it to. When
// real auth + a DB land, add /api/watchlist CRUD keyed by the session email
// and hydrate from there when `email` is set, keeping localStorage as the
// signed-out fallback.

function loadWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === "string").slice(0, 30)
      : [];
  } catch {
    return [];
  }
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [pro, setPro] = useState(false);
  const [userLoaded, setUserLoaded] = useState(false);
  const [beginner, setBeginnerState] = useState(false);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [earningsToday, setEarningsToday] = useState<Record<string, EarningsHour>>({});

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const info = (await res.json()) as SessionInfo;
      setEmail(info.email);
      setPro(info.pro);
    } catch {
      // Stay signed out on error.
    } finally {
      setUserLoaded(true);
    }
  }, []);

  useEffect(() => {
    setBeginnerState(localStorage.getItem(BEGINNER_KEY) === "1");
    setWatchlist(loadWatchlist());
    refreshUser();
    // "Reporting today" badges across the app (server caches this 6h).
    (async () => {
      try {
        const res = await fetch("/api/earnings?scope=today");
        if (!res.ok) return;
        const body = (await res.json()) as EarningsResponse;
        const map: Record<string, EarningsHour> = {};
        for (const item of body.items) map[item.symbol] = item.hour;
        setEarningsToday(map);
      } catch {
        // Badges are a nice-to-have.
      }
    })();
  }, [refreshUser]);

  const setBeginner = useCallback((on: boolean) => {
    setBeginnerState(on);
    localStorage.setItem(BEGINNER_KEY, on ? "1" : "0");
  }, []);

  const toggleWatch = useCallback((symbol: string) => {
    setWatchlist((current) => {
      const sym = symbol.toUpperCase();
      const next = current.includes(sym)
        ? current.filter((s) => s !== sym)
        : [...current, sym].slice(0, 30);
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isWatched = useCallback(
    (symbol: string) => watchlist.includes(symbol.toUpperCase()),
    [watchlist],
  );

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setEmail(null);
    setPro(false);
  }, []);

  return (
    <AppContext.Provider
      value={{
        email,
        pro,
        userLoaded,
        beginner,
        setBeginner,
        refreshUser,
        signOut,
        watchlist,
        isWatched,
        toggleWatch,
        earningsToday,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
