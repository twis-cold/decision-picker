import { NextResponse } from "next/server";
import { getQuote, normalizeSymbol } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol: raw } = await params;
  try {
    const symbol = normalizeSymbol(raw);
    return NextResponse.json(await getQuote(symbol));
  } catch (err) {
    console.error(`GET /api/quote/${raw} failed:`, err);
    return NextResponse.json(
      { error: `Could not load a quote for ${raw}.` },
      { status: 502 },
    );
  }
}
