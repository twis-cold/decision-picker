import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "@fontsource/jetbrains-mono/700.css";
import "./globals.css";
import SearchBar from "@/components/SearchBar";

export const metadata: Metadata = {
  title: "Trending Stocks Dashboard",
  description:
    "Today's top gainers, losers, and most active stocks — with plain-English explanations of why they're moving.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container">
            <Link href="/" className="logo">
              TRENDING·STOCKS
              <span className="cursor" aria-hidden="true" />
            </Link>
            <SearchBar />
          </div>
        </header>
        <main className="container page">{children}</main>
        <footer className="site-footer">
          <div className="container">
            Market data from Yahoo Finance (unofficial API) and Finnhub. Quotes
            may be delayed. This is a portfolio project — nothing here is
            investment advice.
          </div>
        </footer>
      </body>
    </html>
  );
}
