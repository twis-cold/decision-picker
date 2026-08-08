import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import type { SessionInfo } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = readSession(req);
  const info: SessionInfo = {
    email: session?.email ?? null,
    pro: session?.pro ?? false,
  };
  return NextResponse.json(info);
}
