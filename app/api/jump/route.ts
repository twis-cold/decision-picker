import { NextResponse } from "next/server";
import {
  FREE_JUMPS_PER_DAY,
  readQuota,
  readSession,
  setQuotaCookie,
} from "@/lib/auth";
import { getJump, normalizeSymbol, UserError } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const rawSymbol = params.get("symbol") ?? "";
  const date = params.get("date") ?? "";

  const session = readSession(req);
  const pro = session?.pro ?? false;
  const quota = readQuota(req);

  if (!pro && quota.count >= FREE_JUMPS_PER_DAY) {
    return NextResponse.json(
      {
        error: `Free plan is limited to ${FREE_JUMPS_PER_DAY} lookups per day. Upgrade to Pro for unlimited lookups.`,
        limit: true,
      },
      { status: 429 },
    );
  }

  try {
    const symbol = normalizeSymbol(rawSymbol);
    const result = await getJump(symbol, date);
    const res = NextResponse.json({
      ...result,
      remaining: pro ? null : FREE_JUMPS_PER_DAY - quota.count - 1,
    });
    // Only successful lookups consume quota — a typo'd ticker shouldn't cost one.
    if (!pro) {
      setQuotaCookie(res, { date: quota.date, count: quota.count + 1 });
    }
    return res;
  } catch (err) {
    if (err instanceof UserError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(`GET /api/jump ${rawSymbol} ${date} failed:`, err);
    return NextResponse.json(
      { error: `Could not analyze ${rawSymbol || "that ticker"} for that date.` },
      { status: 502 },
    );
  }
}
