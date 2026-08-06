"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SearchResponse, SearchResult } from "@/lib/types";

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searched, setSearched] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Debounced lookup.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setOpen(false);
      setSearched(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const body = (await res.json()) as SearchResponse;
        setResults(body.results);
        setActive(-1);
        setOpen(true);
        setSearched(true);
      } catch {
        // Network hiccup — leave the dropdown as-is.
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const go = (symbol: string) => {
    setQuery("");
    setResults([]);
    setOpen(false);
    router.push(`/stock/${encodeURIComponent(symbol)}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && e.key === "Enter" && query.trim()) {
      go(query.trim().toUpperCase());
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && results[active]) go(results[active].symbol);
      else if (query.trim()) go(query.trim().toUpperCase());
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="search" ref={rootRef} role="search">
      <svg
        className="search-icon"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="text"
        value={query}
        placeholder="Search ticker or company…"
        aria-label="Search ticker or company"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className="search-results" role="listbox">
          {results.map((r, i) => (
            <li key={r.symbol} aria-selected={i === active} role="option">
              <button type="button" onClick={() => go(r.symbol)}>
                <span className="sym">{r.symbol}</span>
                <span className="nm">{r.name}</span>
                {r.exchange && <span className="exch">{r.exchange}</span>}
              </button>
            </li>
          ))}
          {searched && results.length === 0 && (
            <li className="search-empty">No matches — press Enter to try the ticker directly.</li>
          )}
        </ul>
      )}
    </div>
  );
}
