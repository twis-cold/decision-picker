"use client";

import Link from "next/link";
import { useApp } from "./AppProviders";

/** Right side of the nav bar: Beginner Mode switch + account chip. */
export default function HeaderControls() {
  const { email, pro, beginner, setBeginner } = useApp();

  return (
    <span className="nav-right">
      <button
        type="button"
        className="beginner-toggle"
        role="switch"
        aria-checked={beginner}
        onClick={() => setBeginner(!beginner)}
        title="Beginner Mode: plain-English explanations of financial terms"
      >
        BEGINNER
        <span className="switch" aria-hidden="true">
          <span className="knob" />
        </span>
      </button>
      {email ? (
        <Link href="/account" className="account-chip" title={email}>
          {email.split("@")[0]}
          {pro && <span className="pro-badge">PRO</span>}
        </Link>
      ) : (
        <Link href="/account" className="account-chip">
          SIGN IN
        </Link>
      )}
    </span>
  );
}
