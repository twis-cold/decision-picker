"use client";

import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";

/** Price display that briefly flashes green/red when the value ticks. */
export default function PriceTicker({
  value,
  className = "price",
}: {
  value: number;
  className?: string;
}) {
  const prev = useRef(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (value !== prev.current) {
      setFlash(value > prev.current ? "up" : "down");
      prev.current = value;
      const timer = setTimeout(() => setFlash(null), 850);
      return () => clearTimeout(timer);
    }
  }, [value]);

  return (
    <span
      className={`${className}${flash ? ` flash-${flash}` : ""}`}
      aria-live="off"
    >
      {formatPrice(value)}
    </span>
  );
}
