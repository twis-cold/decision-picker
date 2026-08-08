import { NextResponse } from "next/server";
import { getEarnings, UserError } from "@/lib/data";

export const dynamic = "force-dynamic";

function isoDay(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
}

/**
 * Earnings calendar. Defaults to today → +13 days (this week and next).
 * ?scope=today narrows to just today (used for the "reporting today"
 * badges on stock cards).
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const scope = params.get("scope");
  const from = scope === "today" ? isoDay(0) : params.get("from") ?? isoDay(0);
  const to = scope === "today" ? isoDay(0) : params.get("to") ?? isoDay(13);
  try {
    return NextResponse.json(await getEarnings(from, to));
  } catch (err) {
    if (err instanceof UserError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(`GET /api/earnings ${from}..${to} failed:`, err);
    return NextResponse.json(
      { error: "Could not load the earnings calendar." },
      { status: 502 },
    );
  }
}
