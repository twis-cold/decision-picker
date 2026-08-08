import { NextResponse } from "next/server";
import { getOptions, normalizeSymbol, UserError } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol: raw } = await params;
  try {
    const symbol = normalizeSymbol(raw);
    return NextResponse.json(await getOptions(symbol));
  } catch (err) {
    if (err instanceof UserError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(`GET /api/options/${raw} failed:`, err);
    return NextResponse.json(
      { error: `Could not load options for ${raw}.` },
      { status: 502 },
    );
  }
}
