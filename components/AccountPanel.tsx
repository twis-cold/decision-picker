"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useApp } from "./AppProviders";

export default function AccountPanel() {
  const { email, pro, userLoaded, refreshUser, signOut } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: input.trim() }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Sign-in failed.");
      await refreshUser();
      const next = searchParams.get("next");
      if (next?.startsWith("/")) router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!userLoaded) return null;

  if (email) {
    return (
      <div className="account-panel">
        <p className="account-row">
          <span className="account-label">SIGNED IN AS</span>
          <strong>{email}</strong>
          {pro && <span className="pro-badge">PRO</span>}
        </p>
        <p className="account-row">
          <span className="account-label">PLAN</span>
          {pro ? "Pro — unlimited lookups, no ads, 30s refresh" : "Free"}
          {!pro && (
            <Link href="/pro" className="upgrade-link">
              UPGRADE →
            </Link>
          )}
        </p>
        <button type="button" className="tool-submit ghost" onClick={signOut}>
          SIGN OUT
        </button>
      </div>
    );
  }

  return (
    <div className="account-panel">
      <form className="tool-form" onSubmit={signIn}>
        <label>
          EMAIL
          <input
            type="email"
            value={input}
            placeholder="you@example.com"
            required
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
        <button type="submit" className="tool-submit" disabled={busy}>
          {busy ? "SIGNING IN…" : "SIGN IN"}
        </button>
      </form>
      {error && <p className="upgrade-banner err">{error}</p>}
      <p className="fine-print">
        Demo auth: no password or verification email — your session lives in a
        signed cookie on this device. A production build would swap this for
        magic-link email sign-in.
      </p>
    </div>
  );
}
