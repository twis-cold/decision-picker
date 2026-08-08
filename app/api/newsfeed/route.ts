import { NextResponse } from "next/server";
import { getNewsFeed, normalizeSymbol, UserError } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const rawSymbol = params.get("symbol");
  const category = params.get("category") ?? "general";
  try {
    const symbol = rawSymbol?.trim() ? normalizeSymbol(rawSymbol) : null;
    return NextResponse.json(await getNewsFeed(symbol, category));
  } catch (err) {
    if (err instanceof UserError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("GET /api/newsfeed failed:", err);
    return NextResponse.json(
      { error: "Could not load the news feed." },
      { status: 502 },
    );
  }
}
