import { NextResponse } from "next/server";
import { getNews, normalizeSymbol } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol: raw } = await params;
  const changeParam = new URL(req.url).searchParams.get("change");
  const changePercent = Number.parseFloat(changeParam ?? "0") || 0;
  try {
    const symbol = normalizeSymbol(raw);
    return NextResponse.json(await getNews(symbol, changePercent));
  } catch (err) {
    console.error(`GET /api/news/${raw} failed:`, err);
    return NextResponse.json(
      { error: `Could not load news for ${raw}.` },
      { status: 502 },
    );
  }
}
