import { NextResponse } from "next/server";
import { getMovers } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getMovers());
  } catch (err) {
    console.error("GET /api/movers failed:", err);
    return NextResponse.json(
      { error: "Could not load market movers. The data source may be unavailable." },
      { status: 502 },
    );
  }
}
