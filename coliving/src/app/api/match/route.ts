import { NextRequest, NextResponse } from "next/server";
import { residents } from "@/lib/data";
import { matchAll } from "@/lib/matching";
import type { MatchPreferences } from "@/lib/types";

export async function POST(req: NextRequest) {
  const pref = (await req.json()) as MatchPreferences;
  const results = matchAll(pref, residents);
  return NextResponse.json({ results });
}
