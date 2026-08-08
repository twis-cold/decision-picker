import type { Metadata } from "next";
import { Suspense } from "react";
import JumpExplainer from "@/components/JumpExplainer";

export const metadata: Metadata = {
  title: "Explain the Jump · Trending Stocks",
  description:
    "Enter a ticker and a past date — see how the stock moved that day and why.",
};

export default function JumpPage() {
  return (
    <Suspense>
      <JumpExplainer />
    </Suspense>
  );
}
