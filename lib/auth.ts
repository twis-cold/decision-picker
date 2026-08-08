import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";

/**
 * Minimal HMAC-signed cookie sessions — deliberately database-free for a
 * portfolio project. The email "sign in" has no password or verification
 * (the UI says so); in production you'd swap this for a real auth provider
 * (magic links, NextAuth, Clerk, …) and persist Pro status in a database
 * keyed by Stripe customer id instead of a cookie.
 */

export const SESSION_COOKIE = "tsd_session";
export const QUOTA_COOKIE = "tsd_jumps";
export const FREE_JUMPS_PER_DAY = 3;

export interface Session {
  email: string;
  pro: boolean;
}

interface Quota {
  date: string; // YYYY-MM-DD (UTC)
  count: number;
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === "production") {
    console.warn("AUTH_SECRET is not set — sessions use an insecure dev secret.");
  }
  return s ?? "dev-secret-change-me";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function pack(data: unknown): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function unpack<T>(token: string | undefined): T | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const sig = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(payload));
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as T;
  } catch {
    return null;
  }
}

function cookieValue(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq > -1 && part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

export function readSession(req: Request): Session | null {
  const s = unpack<Session>(cookieValue(req, SESSION_COOKIE));
  return s && typeof s.email === "string" ? s : null;
}

export function setSessionCookie(res: NextResponse, session: Session): void {
  res.cookies.set(SESSION_COOKIE, pack(session), {
    ...COOKIE_OPTS,
    maxAge: 30 * 24 * 3600,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", { ...COOKIE_OPTS, maxAge: 0 });
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Free-tier "Explain the Jump" quota, tracked in a signed cookie. */
export function readQuota(req: Request): Quota {
  const q = unpack<Quota>(cookieValue(req, QUOTA_COOKIE));
  if (!q || q.date !== todayUTC() || typeof q.count !== "number") {
    return { date: todayUTC(), count: 0 };
  }
  return q;
}

export function setQuotaCookie(res: NextResponse, quota: Quota): void {
  res.cookies.set(QUOTA_COOKIE, pack(quota), {
    ...COOKIE_OPTS,
    maxAge: 2 * 24 * 3600,
  });
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}
