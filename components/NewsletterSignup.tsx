"use client";

import { useState } from "react";

/**
 * Newsletter signup — footer variant everywhere, inline variant after the
 * hindsight / jump results (the "aha" moments).
 */
export default function NewsletterSignup({
  variant = "footer",
}: {
  variant?: "footer" | "inline";
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || state === "busy") return;
    setState("busy");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        demo?: boolean;
        error?: string;
      };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Signup failed.");
      setState("done");
      setMessage(
        body.demo
          ? "Signed up ✓ (demo mode — no email service configured)"
          : "Signed up ✓ — first digest lands tomorrow morning",
      );
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Signup failed.");
    }
  };

  if (state === "done") {
    return <p className={`newsletter newsletter-${variant} newsletter-done`}>{message}</p>;
  }

  return (
    <form className={`newsletter newsletter-${variant}`} onSubmit={subscribe}>
      <span className="newsletter-pitch">
        {variant === "inline"
          ? "Liked that? Get the top 3 unusual moves in your inbox every morning."
          : "TOP 3 UNUSUAL MOVES — free daily digest"}
      </span>
      <span className="newsletter-controls">
        <input
          type="email"
          required
          value={email}
          placeholder="you@example.com"
          aria-label="Email address"
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" disabled={state === "busy"}>
          {state === "busy" ? "…" : "SUBSCRIBE"}
        </button>
      </span>
      {state === "error" && <span className="newsletter-error">{message}</span>}
    </form>
  );
}
