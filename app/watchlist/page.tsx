import type { Metadata } from "next";
import WatchlistView from "@/components/WatchlistView";

export const metadata: Metadata = {
  title: "Watchlist · Trending Stocks",
  description: "Your saved tickers with live prices.",
};

export default function WatchlistPage() {
  return <WatchlistView />;
}
