import { NextResponse } from "next/server";
import { getCompare, UserError } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Comparison view: /api/compare?symbols=NVDA,AMD,INTC&from=2024-01-01 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const raw = params.get("symbols") ?? "";
  const from = params.get("from") ?? "";
  const symbols = raw.split(",").map((s) => s.trim()).filter(Boolean);
  try {
    return NextResponse.json(await getCompare(symbols, from));
  } catch (err) {
    if (err instanceof UserError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(`GET /api/compare?symbols=${raw}&from=${from} failed:`, err);
    return NextResponse.json(
      { error: "Could not load comparison data." },
      { status: 502 },
    );
  }
}
