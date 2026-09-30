import { subscribeToActivity } from "@/lib/live";
import type { ActivityLog } from "@/lib/types";

export const dynamic = "force-dynamic";



function encodeEvent(activity: ActivityLog) {
  return `data: ${JSON.stringify(activity)}\n\n`;
}

export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const push = (activity: ActivityLog) => {
        controller.enqueue(encoder.encode(encodeEvent(activity)));
      };

      push({
        id: "stream-init",
        message: "Live BookHive terminal connected",
        timestamp: new Date().toISOString(),
        level: "success",
      });

      unsubscribe = subscribeToActivity(push);
    },
    cancel() {
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
    },
  });
}
