import { agentEvents } from "@/lib/agent-orchestrator";
import type { ChatEvent } from "@/lib/agent-types";

export const runtime = "nodejs";

function encode(event: ChatEvent) {
  return `${JSON.stringify(event)}\n`;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { message?: string; question?: string };
  const message = body.message ?? body.question ?? "";

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      for await (const event of agentEvents(message, request.signal)) {
        controller.enqueue(encoder.encode(encode(event)));
        await new Promise((resolve) => setTimeout(resolve, event.type === "chart" ? 260 : 120));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
