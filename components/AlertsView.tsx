"use client";

import Link from "next/link";
import { formatPrice, timeAgo } from "@/lib/format";
import { usePaper } from "./PaperProvider";

export default function AlertsView() {
  const { alerts, removeAlert, notifications, clearNotifications } = usePaper();

  return (
    <div className="tool-page">
      <h1 className="dash-title">ALERTS &amp; NOTIFICATIONS</h1>
      <p className="tool-intro">
        Alerts are checked about once a minute while the site is open and fire
        as in-app notifications. (Real push notifications would need a service
        worker — noted as a future upgrade.)
      </p>

      <h2 className="detail-section-title">ACTIVE ALERTS</h2>
      {alerts.length === 0 ? (
        <p className="tool-intro">
          None yet — open any <Link href="/">stock page</Link> and use SET
          ALERT. Watchlist stocks reporting earnings notify automatically.
        </p>
      ) : (
        alerts.map((a) => (
          <p key={a.id} className="order-row">
            <Link href={`/stock/${encodeURIComponent(a.symbol)}`} className="ticker" style={{ textDecoration: "none" }}>
              {a.symbol}
            </Link>
            <span>
              {a.kind === "volume"
                ? "unusual volume (>2× 3-month average)"
                : `price ${a.kind} ${formatPrice(a.value)}`}
            </span>
            <button type="button" onClick={() => removeAlert(a.id)}>DELETE</button>
          </p>
        ))
      )}

      <h2 className="detail-section-title">NOTIFICATION HISTORY</h2>
      {notifications.length === 0 ? (
        <p className="tool-intro">Nothing yet.</p>
      ) : (
        <>
          {notifications.map((n) => (
            <p key={n.id} className="bell-item" style={{ padding: "8px 0" }}>
              {n.text}
              <span className="headline-meta">{timeAgo(n.at)}</span>
            </p>
          ))}
          <button type="button" className="tool-submit ghost" style={{ marginTop: 14 }} onClick={clearNotifications}>
            CLEAR HISTORY
          </button>
        </>
      )}
    </div>
  );
}
