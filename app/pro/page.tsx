import type { Metadata } from "next";
import { Suspense } from "react";
import UpgradePanel from "@/components/UpgradePanel";

export const metadata: Metadata = {
  title: "Pro · Trending Stocks",
  description:
    "Unlimited Explain-the-Jump lookups, no ads, and faster refresh.",
};

const FREE = [
  "Full market movers dashboard",
  "Stock detail pages & charts",
  "“Why is this moving” explanations",
  "Hindsight calculator",
  "3 Explain-the-Jump lookups / day",
  "60s data refresh",
];

const PRO = [
  "Everything in Free",
  "Unlimited Explain-the-Jump lookups",
  "No ads",
  "30s priority data refresh",
  "Correlated movers (coming soon)",
];

export default function ProPage() {
  return (
    <div className="tool-page">
      <h1 className="dash-title">GO PRO</h1>
      <p className="tool-intro">
        The core dashboard is free, forever. Pro removes the limits for people
        who live in this thing.
      </p>

      <div className="pricing-grid">
        <section className="plan">
          <h2 className="plan-name">FREE</h2>
          <p className="plan-price">$0</p>
          <ul>
            {FREE.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>
        <section className="plan plan-pro">
          <h2 className="plan-name">
            PRO <span className="pro-badge">RECOMMENDED</span>
          </h2>
          <p className="plan-price">
            $5<span className="plan-per">/month</span>
          </p>
          <ul>
            {PRO.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <Suspense>
            <UpgradePanel />
          </Suspense>
        </section>
      </div>

      <p className="fine-print">
        Payments run through Stripe Checkout (test mode until configured —
        no real charges). Cancel anytime.
      </p>
    </div>
  );
}
