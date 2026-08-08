import type { Metadata } from "next";
import { Suspense } from "react";
import CompareView from "@/components/CompareView";

export const metadata: Metadata = {
  title: "Compare · Trending Stocks",
  description:
    "Put $100 into two or three tickers on the same day and compare the outcome on one chart.",
};

export default function ComparePage() {
  return (
    <Suspense>
      <CompareView />
    </Suspense>
  );
}
