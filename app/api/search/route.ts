import { NextResponse } from "next/server";
import { getSearch } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const query = new URL(req.url).searchParams.get("q") ?? "";
  if (query.length > 60) {
    return NextResponse.json({ error: "Query too long." }, { status: 400 });
  }
  try {
    return NextResponse.json(await getSearch(query));
  } catch (err) {
    console.error(`GET /api/search?q=${query} failed:`, err);
    return NextResponse.json(
      { error: "Search is temporarily unavailable." },
      { status: 502 },
    );
  }
}
