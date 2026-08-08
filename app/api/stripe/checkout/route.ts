import { NextResponse } from "next/server";
import Stripe from "stripe";
import { readSession, setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Starts a Stripe Checkout session for the Pro subscription.
 *
 * Configured with STRIPE_SECRET_KEY + STRIPE_PRICE_ID (test mode works):
 * returns a real Checkout URL; /api/stripe/success verifies payment.
 *
 * Without Stripe keys: falls back to a clearly-labeled demo upgrade so the
 * whole Pro flow can be exercised locally with zero setup.
 */
export async function POST(req: Request) {
  const session = readSession(req);
  if (!session) {
    return NextResponse.json(
      { error: "Sign in first so we know which account to upgrade." },
      { status: 401 },
    );
  }
  if (session.pro) {
    return NextResponse.json({ url: "/pro?upgraded=already" });
  }

  const key = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!key || !priceId) {
    // Demo mode — no Stripe configured.
    const res = NextResponse.json({ url: "/pro?upgraded=demo", demo: true });
    setSessionCookie(res, { ...session, pro: true });
    return res;
  }

  try {
    const stripe = new Stripe(key);
    const origin = new URL(req.url).origin;
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: session.email,
      success_url: `${origin}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pro?canceled=1`,
      metadata: { email: session.email },
    });
    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    console.error("Stripe checkout failed:", err);
    return NextResponse.json(
      { error: "Could not start checkout. Check the Stripe configuration." },
      { status: 502 },
    );
  }
}
