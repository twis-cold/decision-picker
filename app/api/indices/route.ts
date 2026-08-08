import { NextResponse } from "next/server";
import { getIndices } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getIndices());
  } catch (err) {
    console.error("GET /api/indices failed:", err);
    return NextResponse.json({ error: "Could not load indices." }, { status: 502 });
  }
}
