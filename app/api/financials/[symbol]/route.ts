import { NextResponse } from "next/server";
import { getFinancials, normalizeSymbol, UserError } from "@/lib/data";
import type { StatementType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol: raw } = await params;
  const search = new URL(req.url).searchParams;
  const freq = search.get("freq") === "annual" ? "annual" : "quarterly";
  const statementParam = search.get("statement") ?? "ic";
  const statement: StatementType = ["ic", "bs", "cf"].includes(statementParam)
    ? (statementParam as StatementType)
    : "ic";
  try {
    const symbol = normalizeSymbol(raw);
    return NextResponse.json(await getFinancials(symbol, freq, statement));
  } catch (err) {
    if (err instanceof UserError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(`GET /api/financials/${raw} failed:`, err);
    return NextResponse.json(
      { error: `Could not load financials for ${raw}.` },
      { status: 502 },
    );
  }
}
