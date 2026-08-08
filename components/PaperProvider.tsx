"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type AppNotification,
  emptyPaperState,
  evaluateOrders,
  executeTrade,
  type OpenOrder,
  type PaperState,
  type PriceAlert,
  uid,
} from "@/lib/paper";
import type { QuotesResponse } from "@/lib/types";
import { useApp } from "./AppProviders";

const PAPER_KEY = "tsd-paper";
const ALERTS_KEY = "tsd-alerts";
const NOTIFS_KEY = "tsd-notifs";

interface PaperContextValue {
  paper: PaperState;
  trade: (
    side: "buy" | "sell",
    symbol: string,
    shares: number,
    price: number,
  ) => string | null;
  placeOrder: (order: Omit<OpenOrder, "id" | "createdAt">) => void;
  cancelOrder: (id: string) => void;
  resetPaper: () => void;
  alerts: PriceAlert[];
  addAlert: (alert: Omit<PriceAlert, "id" | "createdAt">) => void;
  removeAlert: (id: string) => void;
  notifications: AppNotification[];
  unreadCount: number;
  markAllRead: () => void;
  clearNotifications: () => void;
}

const PaperContext = createContext<PaperContextValue | null>(null);

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
  } catch {
    return fallback;
  }
}

function loadArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function PaperProvider({ children }: { children: React.ReactNode }) {
  const { watchlist, earningsToday } = useApp();
  const [paper, setPaper] = useState<PaperState>(emptyPaperState);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const notifiedEarnings = useRef<Set<string>>(new Set());

  useEffect(() => {
    setPaper(load(PAPER_KEY, emptyPaperState()));
    setAlerts(loadArray<PriceAlert>(ALERTS_KEY));
    setNotifications(loadArray<AppNotification>(NOTIFS_KEY));
    setHydrated(true);
  }, []);

  const persistPaper = useCallback((next: PaperState) => {
    setPaper(next);
    localStorage.setItem(PAPER_KEY, JSON.stringify(next));
  }, []);

  const persistAlerts = useCallback((next: PriceAlert[]) => {
    setAlerts(next);
    localStorage.setItem(ALERTS_KEY, JSON.stringify(next));
  }, []);

  const persistNotifs = useCallback((next: AppNotification[]) => {
    setNotifications(next);
    localStorage.setItem(NOTIFS_KEY, JSON.stringify(next.slice(0, 100)));
  }, []);

  const notify = useCallback(
    (text: string) => {
      // TODO(production): real push notifications need a service worker +
      // subscription store; in-app inbox only for now.
      setNotifications((current) => {
        const next = [
          { id: uid(), at: new Date().toISOString(), text, read: false },
          ...current,
        ].slice(0, 100);
        localStorage.setItem(NOTIFS_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  const trade = useCallback(
    (side: "buy" | "sell", symbol: string, shares: number, price: number) => {
      const result = executeTrade(paper, side, symbol, shares, price, "market");
      if (result.error) return result.error;
      persistPaper(result.state);
      notify(
        `Paper ${side === "buy" ? "bought" : "sold"} ${shares} ${symbol.toUpperCase()} @ $${price.toFixed(2)} (simulated)`,
      );
      return null;
    },
    [paper, persistPaper, notify],
  );

  const placeOrder = useCallback(
    (order: Omit<OpenOrder, "id" | "createdAt">) => {
      persistPaper({
        ...paper,
        orders: [
          ...paper.orders,
          { ...order, id: uid(), createdAt: new Date().toISOString() },
        ],
      });
    },
    [paper, persistPaper],
  );

  const cancelOrder = useCallback(
    (id: string) => {
      persistPaper({
        ...paper,
        orders: paper.orders.filter((o) => o.id !== id),
      });
    },
    [paper, persistPaper],
  );

  const resetPaper = useCallback(() => {
    persistPaper(emptyPaperState());
    notify("Paper portfolio reset to $100,000 (simulated).");
  }, [persistPaper, notify]);

  const addAlert = useCallback(
    (alert: Omit<PriceAlert, "id" | "createdAt">) => {
      persistAlerts([
        ...alerts,
        { ...alert, id: uid(), createdAt: new Date().toISOString() },
      ]);
    },
    [alerts, persistAlerts],
  );

  const removeAlert = useCallback(
    (id: string) => persistAlerts(alerts.filter((a) => a.id !== id)),
    [alerts, persistAlerts],
  );

  // ── Engine: every 60s, evaluate open orders + price/volume alerts ──────
  useEffect(() => {
    if (!hydrated) return;
    const symbols = new Set<string>([
      ...paper.orders.map((o) => o.symbol),
      ...alerts.map((a) => a.symbol),
    ]);
    if (symbols.size === 0) return;

    let cancelled = false;
    const run = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(
          `/api/quotes?symbols=${encodeURIComponent([...symbols].join(","))}`,
        );
        if (!res.ok) return;
        const body = (await res.json()) as QuotesResponse;
        if (cancelled) return;

        const prices: Record<string, number> = {};
        for (const q of body.quotes) prices[q.symbol] = q.price;

        // Orders
        setPaper((current) => {
          const { state, fills } = evaluateOrders(current, prices);
          if (state === current) return current;
          localStorage.setItem(PAPER_KEY, JSON.stringify(state));
          for (const id of fills) {
            const order = current.orders.find((o) => o.id === id);
            if (order) {
              notify(
                `${order.kind === "stop" ? "Stop-loss" : "Limit"} order filled: ${order.side} ${order.shares} ${order.symbol} (simulated)`,
              );
            }
          }
          return state;
        });

        // Alerts (one-shot: remove after firing)
        const fired: string[] = [];
        for (const alert of alerts) {
          const q = body.quotes.find((x) => x.symbol === alert.symbol);
          if (!q) continue;
          if (alert.kind === "above" && alert.value != null && q.price >= alert.value) {
            notify(`${alert.symbol} crossed above $${alert.value.toFixed(2)} (now $${q.price.toFixed(2)})`);
            fired.push(alert.id);
          } else if (alert.kind === "below" && alert.value != null && q.price <= alert.value) {
            notify(`${alert.symbol} fell below $${alert.value.toFixed(2)} (now $${q.price.toFixed(2)})`);
            fired.push(alert.id);
          } else if (alert.kind === "volume") {
            const quote = q as { volume?: number; avgVolume?: number | null };
            const avg = (quote as { avgVolume?: number | null }).avgVolume;
            if (avg && quote.volume && quote.volume > 2 * avg) {
              notify(`${alert.symbol} unusual volume: ${(quote.volume / avg).toFixed(1)}× its 3-month average`);
              fired.push(alert.id);
            }
          }
        }
        if (fired.length > 0) {
          setAlerts((current) => {
            const next = current.filter((a) => !fired.includes(a.id));
            localStorage.setItem(ALERTS_KEY, JSON.stringify(next));
            return next;
          });
        }
      } catch {
        // Engine is best-effort; try again next tick.
      }
    };

    run();
    const id = setInterval(run, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [hydrated, paper.orders, alerts, notify]);

  // Watchlist stocks reporting earnings today → one notification per day.
  useEffect(() => {
    if (!hydrated) return;
    const today = new Date().toISOString().slice(0, 10);
    for (const symbol of watchlist) {
      const hour = earningsToday[symbol];
      const key = `${today}:${symbol}`;
      if (hour && !notifiedEarnings.current.has(key)) {
        const already = notifications.some(
          (n) => n.at.slice(0, 10) === today && n.text.includes(`${symbol} reports earnings`),
        );
        notifiedEarnings.current.add(key);
        if (!already) {
          notify(
            `${symbol} reports earnings today (${hour === "bmo" ? "before open" : hour === "amc" ? "after close" : "time TBD"})`,
          );
        }
      }
    }
  }, [hydrated, watchlist, earningsToday, notifications, notify]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = useCallback(() => {
    persistNotifs(notifications.map((n) => ({ ...n, read: true })));
  }, [notifications, persistNotifs]);

  const clearNotifications = useCallback(() => persistNotifs([]), [persistNotifs]);

  return (
    <PaperContext.Provider
      value={{
        paper,
        trade,
        placeOrder,
        cancelOrder,
        resetPaper,
        alerts,
        addAlert,
        removeAlert,
        notifications,
        unreadCount,
        markAllRead,
        clearNotifications,
      }}
    >
      {children}
    </PaperContext.Provider>
  );
}

export function usePaper(): PaperContextValue {
  const ctx = useContext(PaperContext);
  if (!ctx) throw new Error("usePaper must be used inside PaperProvider");
  return ctx;
}
