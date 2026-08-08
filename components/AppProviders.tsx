"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { SessionInfo } from "@/lib/types";

interface AppState {
  email: string | null;
  pro: boolean;
  userLoaded: boolean;
  beginner: boolean;
  setBeginner: (on: boolean) => void;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppState>({
  email: null,
  pro: false,
  userLoaded: false,
  beginner: false,
  setBeginner: () => {},
  refreshUser: async () => {},
  signOut: async () => {},
});

const BEGINNER_KEY = "tsd-beginner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [pro, setPro] = useState(false);
  const [userLoaded, setUserLoaded] = useState(false);
  const [beginner, setBeginnerState] = useState(false);

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
    refreshUser();
  }, [refreshUser]);

  const setBeginner = useCallback((on: boolean) => {
    setBeginnerState(on);
    localStorage.setItem(BEGINNER_KEY, on ? "1" : "0");
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setEmail(null);
    setPro(false);
  }, []);

  return (
    <AppContext.Provider
      value={{ email, pro, userLoaded, beginner, setBeginner, refreshUser, signOut }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
