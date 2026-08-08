import type { Metadata } from "next";
import PortfolioView from "@/components/PortfolioView";

export const metadata: Metadata = {
  title: "Paper Portfolio · Trending Stocks",
  description:
    "Simulated portfolio with paper money — holdings, P&L, allocation, and performance vs the S&P 500.",
};

export default function PortfolioPage() {
  return <PortfolioView />;
}
