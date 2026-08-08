import { NextResponse } from "next/server";
import { isValidEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Newsletter signup. Wired for Buttondown (simplest free-tier email API:
 * one endpoint, one token — https://buttondown.com/features/api). Without
 * BUTTONDOWN_API_KEY it accepts the email in demo mode so the UI flow works.
 * The intended content is the "Top 3 Unusual Moves" digest at /api/digest.
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

  const key = process.env.BUTTONDOWN_API_KEY;
  if (!key) {
    console.log("Newsletter signup (demo mode, not stored):", email);
    return NextResponse.json({ ok: true, demo: true });
  }

  try {
    const res = await fetch("https://api.buttondown.com/v1/subscribers", {
      method: "POST",
      headers: {
        Authorization: `Token ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email_address: email, tags: ["stocks-dashboard"] }),
    });
    if (res.status === 201) return NextResponse.json({ ok: true });
    const body = await res.text();
    // Buttondown returns 400 for duplicates — treat as success for the user.
    if (res.status === 400 && body.includes("already")) {
      return NextResponse.json({ ok: true, already: true });
    }
    console.error("Buttondown signup failed:", res.status, body);
    return NextResponse.json(
      { error: "Signup failed — please try again later." },
      { status: 502 },
    );
  } catch (err) {
    console.error("Buttondown request failed:", err);
    return NextResponse.json(
      { error: "Signup failed — please try again later." },
      { status: 502 },
    );
  }
}
