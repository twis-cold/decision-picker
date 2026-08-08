import type { Metadata } from "next";
import { Suspense } from "react";
import HindsightCalculator from "@/components/HindsightCalculator";

export const metadata: Metadata = {
  title: "What Would I Have Made · Trending Stocks",
  description:
    "Pick a ticker, a past date, and an amount — see what that investment would be worth today.",
};

export default function HindsightPage() {
  return (
    <Suspense>
      <HindsightCalculator />
    </Suspense>
  );
}
