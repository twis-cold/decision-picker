import { NextResponse } from "next/server";
import { getHindsight, normalizeSymbol, UserError } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const rawSymbol = params.get("symbol") ?? "";
  const date = params.get("date") ?? "";
  const amount = Number.parseFloat(params.get("amount") ?? "");
  try {
    const symbol = normalizeSymbol(rawSymbol);
    return NextResponse.json(await getHindsight(symbol, date, amount));
  } catch (err) {
    if (err instanceof UserError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(`GET /api/hindsight ${rawSymbol} ${date} failed:`, err);
    return NextResponse.json(
      { error: `Could not load price history for ${rawSymbol || "that ticker"}.` },
      { status: 502 },
    );
  }
}
