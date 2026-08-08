/**
 * Paper-trading engine: simulated cash, holdings, orders, and alerts.
 * Everything is SIMULATED — no real money, no brokerage, no order routing;
 * "fills" happen against the site's own delayed quotes. State lives in
 * localStorage (per-browser). TODO(production): persist per-account server-
 * side once real auth + a database exist.
 */

export const STARTING_CASH = 100_000;

export interface Holding {
  shares: number;
  cost: number; // total cost basis in dollars
}

export interface PaperTxn {
  id: string;
  at: string; // ISO
  symbol: string;
  side: "buy" | "sell";
  shares: number;
  price: number;
  total: number; // signed cash impact is -total for buys, +total handled by caller
  kind: "market" | "limit" | "stop";
}

export interface OpenOrder {
  id: string;
  createdAt: string; // ISO
  symbol: string;
  side: "buy" | "sell";
  kind: "limit" | "stop";
  triggerPrice: number;
  shares: number;
  gtc: boolean;
}

export interface PaperState {
  cash: number;
  holdings: Record<string, Holding>;
  txns: PaperTxn[];
  orders: OpenOrder[];
}

export interface PriceAlert {
  id: string;
  createdAt: string;
  symbol: string;
  kind: "above" | "below" | "volume";
  value: number | null; // target price; null for volume spike
}

export interface AppNotification {
  id: string;
  at: string;
  text: string;
  read: boolean;
}

export const emptyPaperState = (): PaperState => ({
  cash: STARTING_CASH,
  holdings: {},
  txns: [],
  orders: [],
});

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function executeTrade(
  state: PaperState,
  side: "buy" | "sell",
  symbol: string,
  shares: number,
  price: number,
  kind: PaperTxn["kind"],
): { state: PaperState; error?: string; txn?: PaperTxn } {
  const sym = symbol.toUpperCase();
  if (!(shares > 0) || !(price > 0)) {
    return { state, error: "Invalid share count." };
  }
  const total = shares * price;
  const holding = state.holdings[sym] ?? { shares: 0, cost: 0 };

  if (side === "buy") {
    if (total > state.cash + 1e-6) {
      return { state, error: "Not enough simulated cash for that order." };
    }
  } else if (shares > holding.shares + 1e-9) {
    return { state, error: "You don't hold that many shares." };
  }

  const txn: PaperTxn = {
    id: uid(),
    at: new Date().toISOString(),
    symbol: sym,
    side,
    shares,
    price,
    total,
    kind,
  };

  const holdings = { ...state.holdings };
  if (side === "buy") {
    holdings[sym] = { shares: holding.shares + shares, cost: holding.cost + total };
  } else {
    const remaining = holding.shares - shares;
    const costOut = holding.cost * (shares / holding.shares);
    if (remaining < 1e-9) delete holdings[sym];
    else holdings[sym] = { shares: remaining, cost: holding.cost - costOut };
  }

  return {
    state: {
      cash: state.cash + (side === "buy" ? -total : total),
      holdings,
      txns: [txn, ...state.txns].slice(0, 500),
      orders: state.orders,
    },
    txn,
  };
}

/**
 * Evaluate open orders against fresh quotes. Limit buys fill when price is
 * at/below the limit; limit sells at/above; stop-loss sells when price is
 * at/below the stop. Day orders (non-GTC) expire after their creation day.
 */
export function evaluateOrders(
  state: PaperState,
  prices: Record<string, number>,
): { state: PaperState; fills: string[]; expired: string[] } {
  const fills: string[] = [];
  const expired: string[] = [];
  let next = state;
  const today = new Date().toISOString().slice(0, 10);

  for (const order of state.orders) {
    if (!order.gtc && order.createdAt.slice(0, 10) !== today) {
      expired.push(order.id);
      continue;
    }
    const price = prices[order.symbol];
    if (price == null || price <= 0) continue;
    const shouldFill =
      order.kind === "limit"
        ? order.side === "buy"
          ? price <= order.triggerPrice
          : price >= order.triggerPrice
        : order.side === "sell" && price <= order.triggerPrice; // stop-loss
    if (!shouldFill) continue;
    const result = executeTrade(
      next,
      order.side,
      order.symbol,
      order.shares,
      price,
      order.kind,
    );
    if (!result.error) {
      next = result.state;
      fills.push(order.id);
    } else {
      // Can't afford / can't cover anymore — drop the order.
      expired.push(order.id);
    }
  }

  if (fills.length === 0 && expired.length === 0) {
    return { state, fills, expired };
  }
  const gone = new Set([...fills, ...expired]);
  return {
    state: { ...next, orders: state.orders.filter((o) => !gone.has(o.id)) },
    fills,
    expired,
  };
}

/** Signed transaction list for the performance endpoint. */
export function txnsForPerformance(
  state: PaperState,
): { symbol: string; shares: number; total: number; at: string }[] {
  return [...state.txns]
    .reverse()
    .map((t) => ({
      symbol: t.symbol,
      shares: t.side === "buy" ? t.shares : -t.shares,
      total: t.side === "buy" ? t.total : -t.total,
      at: t.at,
    }));
}
