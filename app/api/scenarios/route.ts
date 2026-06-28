import type { NextRequest } from "next/server";
import { scenarioFull, scenarioSummaries } from "@/lib/scenarios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const full = scenarioFull(id);
    if (!full) return Response.json({ error: "unknown scenario" }, { status: 404 });
    return Response.json(full);
  }
  return Response.json({ scenarios: scenarioSummaries() });
}
