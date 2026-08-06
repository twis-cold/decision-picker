import { timeAgo } from "@/lib/format";
import type { NewsItem } from "@/lib/types";

export default function NewsList({ items }: { items: NewsItem[] }) {
  if (items.length === 0) {
    return <p style={{ color: "var(--ink-3)", fontSize: 13 }}>No recent headlines found.</p>;
  }
  return (
    <div className="news-list">
      {items.map((n) => (
        <a
          key={n.id}
          className="headline"
          href={n.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="headline-title">{n.title}</span>
          {n.summary && <span className="headline-summary">{n.summary}</span>}
          <span className="headline-meta">
            {n.source} · {timeAgo(n.publishedAt)}
          </span>
        </a>
      ))}
    </div>
  );
}
