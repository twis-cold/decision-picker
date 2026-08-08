"use client";

import { useApp } from "./AppProviders";

/**
 * Placeholder ad slot, sized and styled to match the theme. Hidden for Pro.
 *
 * To go live with AdSense:
 * 1. Add the AdSense loader <script> in app/layout.tsx (with your client id
 *    in NEXT_PUBLIC_ADSENSE_CLIENT).
 * 2. Replace the placeholder markup below with the matching
 *    <ins className="adsbygoogle" …> unit and push to `adsbygoogle`.
 * The three variants map to: `rail` = 300x600 desktop sidebar,
 * `banner` = responsive horizontal unit, `native` = in-feed unit.
 *
 * Deliberately never rendered on /hindsight or /jump results — those are
 * built to be screenshot-clean.
 */
export default function AdSlot({
  variant,
}: {
  variant: "rail" | "banner" | "native";
}) {
  const { pro } = useApp();
  if (pro) return null;

  return (
    <div className={`ad-slot ad-${variant}`} aria-label="Advertisement">
      <span className="ad-tag">{variant === "native" ? "SPONSORED" : "AD"}</span>
      <span className="ad-hint">ad slot · {variant}</span>
    </div>
  );
}
