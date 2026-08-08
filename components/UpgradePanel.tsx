"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useApp } from "./AppProviders";

export default function UpgradePanel() {
  const { email, pro, userLoaded, refreshUser } = useApp();
  const searchParams = useSearchParams();
  const upgraded = searchParams.get("upgraded");
  const errorParam = searchParams.get("error");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upgrade = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !body.url) throw new Error(body.error ?? "Checkout failed.");
      if (body.url.startsWith("/")) {
        // Demo upgrade — no Stripe configured; session is already Pro.
        await refreshUser();
      }
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
      setBusy(false);
    }
  };

  return (
    <div className="upgrade-panel">
      {upgraded === "1" && (
        <p className="upgrade-banner ok">You&rsquo;re Pro now — thanks for the support! ✓</p>
      )}
      {upgraded === "demo" && (
        <p className="upgrade-banner ok">
          Demo upgrade applied ✓ (Stripe isn&rsquo;t configured — see the README to
          wire up real test-mode payments)
        </p>
      )}
      {upgraded === "already" && (
        <p className="upgrade-banner ok">You&rsquo;re already Pro ✓</p>
      )}
      {errorParam && (
        <p className="upgrade-banner err">
          Payment could not be verified — you have not been charged. Try again.
        </p>
      )}
      {error && <p className="upgrade-banner err">{error}</p>}

      {pro ? (
        <p className="upgrade-status">
          PRO is active on <strong>{email}</strong>. Enjoy the silence (no ads),
          unlimited jump lookups, and 30s refresh.
        </p>
      ) : !userLoaded ? null : email ? (
        <button
          type="button"
          className="upgrade-cta"
          onClick={upgrade}
          disabled={busy}
        >
          {busy ? "STARTING CHECKOUT…" : "UPGRADE — $5/MO"}
        </button>
      ) : (
        <Link href="/account?next=/pro" className="upgrade-cta">
          SIGN IN TO UPGRADE
        </Link>
      )}
    </div>
  );
}
