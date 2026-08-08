import { NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook endpoint (configure the URL + STRIPE_WEBHOOK_SECRET in the
 * Stripe dashboard). Because this project stores Pro status in a signed
 * cookie instead of a database, the handlers below only log; in production
 * you would persist `email → subscription status` here (this is the source
 * of truth for renewals, cancellations, and failed payments — the success
 * redirect alone can't cover those).
 */
export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured." },
      { status: 501 },
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(key);
    event = stripe.webhooks.constructEvent(
      await req.text(),
      signature,
      webhookSecret,
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const checkout = event.data.object;
      console.log("Pro subscription started:", checkout.metadata?.email);
      // TODO(production): mark this email as Pro in your database.
      break;
    }
    case "customer.subscription.deleted": {
      console.log("Pro subscription canceled:", event.data.object.id);
      // TODO(production): remove Pro from the matching user in your database.
      break;
    }
    case "invoice.payment_failed": {
      console.log("Pro payment failed:", event.data.object.id);
      // TODO(production): flag the account / send a dunning email.
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
