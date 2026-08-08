import type { Metadata } from "next";
import EarningsCalendar from "@/components/EarningsCalendar";

export const metadata: Metadata = {
  title: "Earnings Calendar · Trending Stocks",
  description:
    "Which companies report earnings this week and next, before open or after close.",
};

export default function EarningsPage() {
  return <EarningsCalendar />;
}
