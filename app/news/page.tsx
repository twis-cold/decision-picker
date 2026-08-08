import type { Metadata } from "next";
import NewsFeed from "@/components/NewsFeed";

export const metadata: Metadata = {
  title: "News · Trending Stocks",
  description: "Live financial news feed, filterable by category or ticker.",
};

export default function NewsPage() {
  return <NewsFeed />;
}
