import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Batch quotes: /api/quotes?symbols=AAPL,NVDA,TSLA (max 30). */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("symbols") ?? "";
  const symbols = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (symbols.length === 0) {
    return NextResponse.json({ quotes: [], sampleData: false });
  }
  try {
    return NextResponse.json(await getQuotes(symbols));
  } catch (err) {
    console.error(`GET /api/quotes?symbols=${raw} failed:`, err);
    return NextResponse.json(
      { error: "Could not load quotes." },
      { status: 502 },
    );
  }
}
