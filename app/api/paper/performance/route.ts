import { NextResponse } from "next/server";
import { getPaperPerformance, UserError } from "@/lib/data";
import type { PaperPerformanceRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST: the client sends its simulated transaction log; we reconstruct the
 * paper portfolio's value over time and a same-dated S&P 500 benchmark.
 * (POST because the txn list lives client-side — there is no server store.)
 */
export async function POST(req: Request) {
  let body: PaperPerformanceRequest;
  try {
    body = (await req.json()) as PaperPerformanceRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    return NextResponse.json(await getPaperPerformance(body));
  } catch (err) {
    if (err instanceof UserError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("POST /api/paper/performance failed:", err);
    return NextResponse.json(
      { error: "Could not compute portfolio performance." },
      { status: 502 },
    );
  }
}
