import type { NextRequest } from "next/server";
import { cerebrasProvider, gpuProvider, hasCerebrasKey } from "@/lib/cerebras";
import { runIncident } from "@/lib/orchestrator";
import { DEFAULT_SCENARIO_ID, scenarioIncident } from "@/lib/scenarios";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import type { IncidentInput, StreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!hasCerebrasKey()) {
    return Response.json(
      { error: "CEREBRAS_API_KEY is not set on the server." },
      { status: 503 }
    );
  }

  const rl = rateLimit(clientKey(req, "incident"), 12, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: `Rate limit reached — try again in ${rl.retryAfter}s.` },
      { status: 429, headers: { "retry-after": String(rl.retryAfter) } }
    );
  }

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  // scenarioId (multi-scenario) or legacy `scenario: true` (default scenario)
  const scenarioId =
    typeof body.scenarioId === "string"
      ? body.scenarioId
      : body.scenario
        ? DEFAULT_SCENARIO_ID
        : null;

  const input: IncidentInput = scenarioId
    ? (scenarioIncident(scenarioId) ?? scenarioIncident(DEFAULT_SCENARIO_ID)!)
    : {
        alertText: typeof body.alertText === "string" ? body.alertText : undefined,
        logs: typeof body.logs === "string" ? body.logs : undefined,
        runbook: typeof body.runbook === "string" ? body.runbook : undefined,
        imageBase64:
          typeof body.imageBase64 === "string" ? body.imageBase64 : undefined,
        imageMime: typeof body.imageMime === "string" ? body.imageMime : undefined,
      };

  // Which provider to run the swarm on: Cerebras (default) or the GPU baseline.
  const wantGpu = body?.provider === "gpu";
  const provider = wantGpu ? gpuProvider() : cerebrasProvider();
  if (wantGpu && !provider) {
    return Response.json(
      { error: "GPU baseline is not configured (set BASELINE_* env)." },
      { status: 503 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          /* controller already closed */
        }
      };
      try {
        await runIncident(input, emit, req.signal, provider ?? undefined);
      } catch (e) {
        emit({ type: "fatal", message: (e as Error).message });
      } finally {
        try {
          controller.close();
        } catch {
          /* noop */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
