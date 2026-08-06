import { NextResponse } from "next/server";
import { getChart, normalizeSymbol } from "@/lib/data";
import type { ChartRange } from "@/lib/types";

export const dynamic = "force-dynamic";

const RANGES: ChartRange[] = ["1D", "1W", "1M", "1Y"];

export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol: raw } = await params;
  const rangeParam = new URL(req.url).searchParams.get("range") ?? "1D";
  const range = RANGES.includes(rangeParam as ChartRange)
    ? (rangeParam as ChartRange)
    : "1D";
  try {
    const symbol = normalizeSymbol(raw);
    return NextResponse.json(await getChart(symbol, range));
  } catch (err) {
    console.error(`GET /api/chart/${raw}?range=${range} failed:`, err);
    return NextResponse.json(
      { error: `Could not load chart data for ${raw}.` },
      { status: 502 },
    );
  }
}
