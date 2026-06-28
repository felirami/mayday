import type { NextRequest } from "next/server";
import { hasCerebrasKey } from "@/lib/cerebras";
import { runRace } from "@/lib/race";
import type { RaceEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!hasCerebrasKey()) {
    return Response.json(
      { error: "CEREBRAS_API_KEY is not set on the server." },
      { status: 503 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: RaceEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          /* closed */
        }
      };
      try {
        await runRace(emit, req.signal);
      } catch (e) {
        emit({ type: "race_error", provider: "race", message: (e as Error).message });
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
