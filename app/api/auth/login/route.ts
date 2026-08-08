import { NextResponse } from "next/server";
import { isValidEmail, readSession, setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Demo email sign-in: no password, no verification email — this project has
 * no database, so a session is just a signed cookie. In production, replace
 * with a real provider (magic links / NextAuth / Clerk) — this route is the
 * single place the UI creates sessions, so it's the one seam to swap.
 */
export async function POST(req: Request) {
  let email = "";
  try {
    const body = (await req.json()) as { email?: string };
    email = (body.email ?? "").trim().toLowerCase();
  } catch {
    // fall through to validation error
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  // Keep Pro if the same person signs in again mid-session.
  const existing = readSession(req);
  const pro = existing?.email === email ? existing.pro : false;

  const res = NextResponse.json({ email, pro });
  setSessionCookie(res, { email, pro });
  return res;
}
