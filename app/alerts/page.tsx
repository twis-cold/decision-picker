import type { Metadata } from "next";
import AlertsView from "@/components/AlertsView";

export const metadata: Metadata = {
  title: "Alerts · Trending Stocks",
  description: "Price, volume, and earnings alerts with an in-app notification inbox.",
};

export default function AlertsPage() {
  return <AlertsView />;
}
