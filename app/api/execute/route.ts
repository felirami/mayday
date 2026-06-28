import type { NextRequest } from "next/server";
import { hasCerebrasKey } from "@/lib/cerebras";
import { runOperator, type OperatorCtx } from "@/lib/operator";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import type { OperatorEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!hasCerebrasKey()) {
    return Response.json({ error: "CEREBRAS_API_KEY is not set." }, { status: 503 });
  }
  const rl = rateLimit(clientKey(req, "execute"), 12, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: `Rate limit reached — try again in ${rl.retryAfter}s.` },
      { status: 429, headers: { "retry-after": String(rl.retryAfter) } }
    );
  }

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const ctx: OperatorCtx = {
    service: typeof body.service === "string" ? body.service : "the affected service",
    command: typeof body.command === "string" ? body.command : "",
    alertText: typeof body.alertText === "string" ? body.alertText : "",
    rootCause: typeof body.rootCause === "string" ? body.rootCause : "",
  };
  if (!ctx.command) {
    return Response.json({ error: "no command to execute" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: OperatorEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          /* closed */
        }
      };
      try {
        await runOperator(ctx, emit, req.signal);
      } catch (e) {
        emit({ type: "op_error", message: (e as Error).message });
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
