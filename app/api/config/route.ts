import { hasCerebrasKey } from "@/lib/cerebras";
import { baselineLabel } from "@/lib/race";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const hasRealBaseline = Boolean(
    process.env.BASELINE_API_KEY &&
      process.env.BASELINE_BASE_URL &&
      process.env.BASELINE_MODEL
  );
  return Response.json({
    hasKey: hasCerebrasKey(),
    baselineLabel: baselineLabel(),
    hasRealBaseline,
    model: "gemma-4-31b",
  });
}
