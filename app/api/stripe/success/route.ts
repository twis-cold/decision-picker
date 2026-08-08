import { NextResponse } from "next/server";
import Stripe from "stripe";
import { readSession, setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Stripe Checkout redirects here after payment. We verify the checkout
 * session server-side before marking the cookie session as Pro — never
 * trust the redirect alone.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id");
  const key = process.env.STRIPE_SECRET_KEY;
  const session = readSession(req);

  if (!key || !sessionId || !session) {
    return NextResponse.redirect(new URL("/pro?error=verify", url.origin));
  }

  try {
    const stripe = new Stripe(key);
    const checkout = await stripe.checkout.sessions.retrieve(sessionId);
    const paid =
      checkout.payment_status === "paid" || checkout.status === "complete";
    if (!paid) {
      return NextResponse.redirect(new URL("/pro?error=payment", url.origin));
    }
    const res = NextResponse.redirect(new URL("/pro?upgraded=1", url.origin));
    setSessionCookie(res, { ...session, pro: true });
    return res;
  } catch (err) {
    console.error("Stripe verify failed:", err);
    return NextResponse.redirect(new URL("/pro?error=verify", url.origin));
  }
}
