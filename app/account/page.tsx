import type { Metadata } from "next";
import { Suspense } from "react";
import AccountPanel from "@/components/AccountPanel";

export const metadata: Metadata = {
  title: "Account · Trending Stocks",
};

export default function AccountPage() {
  return (
    <div className="tool-page">
      <h1 className="dash-title">ACCOUNT</h1>
      <Suspense>
        <AccountPanel />
      </Suspense>
    </div>
  );
}
