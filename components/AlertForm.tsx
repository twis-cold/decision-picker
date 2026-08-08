"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "./AppProviders";
import { usePaper } from "./PaperProvider";

/** Inline alert creation on the stock detail page. */
export default function AlertForm({
  symbol,
  price,
}: {
  symbol: string;
  price: number;
}) {
  const { email } = useApp();
  const { addAlert, alerts } = usePaper();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"above" | "below" | "volume">("above");
  const [value, setValue] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const existing = alerts.filter((a) => a.symbol === symbol);

  if (!email) {
    return (
      <p className="alert-signin">
        <Link href={`/account?next=/stock/${encodeURIComponent(symbol)}`}>
          Sign in
        </Link>{" "}
        to set price and volume alerts.
      </p>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = Number.parseFloat(value);
    if (kind !== "volume" && !(target > 0)) return;
    addAlert({
      symbol,
      kind,
      value: kind === "volume" ? null : target,
    });
    setConfirmation(
      kind === "volume"
        ? `Alert set: unusual volume on ${symbol}.`
        : `Alert set: ${symbol} ${kind} $${target.toFixed(2)}.`,
    );
    setValue("");
    setOpen(false);
  };

  return (
    <div className="alert-block">
      <button type="button" className="why-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="arrow" aria-hidden="true">▶</span>
        SET ALERT{existing.length > 0 ? ` (${existing.length} ACTIVE)` : ""}
      </button>
      {confirmation && !open && <p className="share-note">{confirmation} <Link href="/alerts">manage →</Link></p>}
      {open && (
        <form className="order-form alert-form" onSubmit={submit}>
          <div className="range-toggle" role="group" aria-label="Alert type">
            {(
              [
                ["above", "PRICE ABOVE"],
                ["below", "PRICE BELOW"],
                ["volume", "VOLUME SPIKE"],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
                {label}
              </button>
            ))}
          </div>
          {kind !== "volume" && (
            <label className="order-field">
              TARGET $
              <input
                type="number"
                min="0.01"
                step="any"
                value={value}
                placeholder={price.toFixed(2)}
                onChange={(e) => setValue(e.target.value)}
                required
              />
            </label>
          )}
          <button type="submit" className="tool-submit">SET</button>
          <span className="order-meta" style={{ margin: 0 }}>
            fires as an in-app notification while the site is open
          </span>
        </form>
      )}
    </div>
  );
}
