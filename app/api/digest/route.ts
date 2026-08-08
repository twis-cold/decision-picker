import { NextResponse } from "next/server";
import { getDigest } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * "Top 3 Unusual Moves Today" — the newsletter content, pre-built.
 * A daily cron (e.g. Vercel Cron) can GET this and send `text` through
 * Buttondown's /emails API to automate the digest.
 */
export async function GET() {
  try {
    return NextResponse.json(await getDigest());
  } catch (err) {
    console.error("GET /api/digest failed:", err);
    return NextResponse.json(
      { error: "Could not build today's digest." },
      { status: 502 },
    );
  }
}
