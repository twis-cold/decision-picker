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
import { AppProviders } from "@/components/AppProviders";
import HeaderControls from "@/components/HeaderControls";
import NewsletterSignup from "@/components/NewsletterSignup";
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
        <AppProviders>
          <header className="site-header">
            <div className="container">
              <Link href="/" className="logo">
                TRENDING·STOCKS
                <span className="cursor" aria-hidden="true" />
              </Link>
              <SearchBar />
            </div>
          </header>
          <nav className="site-nav" aria-label="Main">
            <div className="container">
              <Link href="/">MOVERS</Link>
              <Link href="/hindsight">HINDSIGHT</Link>
              <Link href="/jump">EXPLAIN A JUMP</Link>
              <Link href="/pro">PRO</Link>
              <HeaderControls />
            </div>
          </nav>
          <main className="container page">{children}</main>
          <footer className="site-footer">
            <div className="container">
              <NewsletterSignup variant="footer" />
              <p className="footer-legal">
                Market data from Yahoo Finance (unofficial API) and Finnhub.
                Quotes may be delayed. <strong>Not financial advice</strong> —
                this site explains stock movements for education and
                entertainment; nothing here is a recommendation to buy or sell
                anything.
              </p>
            </div>
          </footer>
        </AppProviders>
      </body>
    </html>
  );
}
