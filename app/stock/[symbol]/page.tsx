import type { Metadata } from "next";
import StockDetail from "@/components/StockDetail";

interface Props {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params;
  const clean = decodeURIComponent(symbol).toUpperCase();
  return {
    title: `${clean} · Trending Stocks`,
    description: `Live price, chart, key stats, and why ${clean} is moving today.`,
  };
}

export default async function StockPage({ params }: Props) {
  const { symbol } = await params;
  return <StockDetail symbol={decodeURIComponent(symbol).toUpperCase()} />;
}
