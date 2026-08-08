"use client";

import { useState } from "react";
import { GLOSSARY } from "@/lib/glossary";

/**
 * The "?" bubble shown next to jargon when Beginner Mode is on.
 * Click (or focus + hover) reveals a one-sentence plain-English explanation.
 */
export default function GlossaryTip({ term }: { term: string }) {
  const [open, setOpen] = useState(false);
  const text = GLOSSARY[term];
  if (!text) return null;

  return (
    <span className="tip-wrap">
      <button
        type="button"
        className="tip"
        aria-label={`What does ${term} mean?`}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onBlur={() => setOpen(false)}
      >
        ?
      </button>
      {open && (
        <span role="tooltip" className="tip-pop">
          {text}
        </span>
      )}
    </span>
  );
}
