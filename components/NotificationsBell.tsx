"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { timeAgo } from "@/lib/format";
import { usePaper } from "./PaperProvider";

export default function NotificationsBell() {
  const { notifications, unreadCount, markAllRead } = usePaper();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div className="bell-wrap" ref={rootRef}>
      <button
        type="button"
        className="bell"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) markAllRead();
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unreadCount > 0 && <span className="bell-dot">{Math.min(unreadCount, 9)}</span>}
      </button>
      {open && (
        <div className="bell-panel">
          {notifications.length === 0 ? (
            <p className="bell-empty">No notifications yet — set alerts from any stock page.</p>
          ) : (
            notifications.slice(0, 8).map((n) => (
              <p key={n.id} className="bell-item">
                {n.text}
                <span className="headline-meta">{timeAgo(n.at)}</span>
              </p>
            ))
          )}
          <Link href="/alerts" className="bell-manage" onClick={() => setOpen(false)}>
            MANAGE ALERTS →
          </Link>
        </div>
      )}
    </div>
  );
}
