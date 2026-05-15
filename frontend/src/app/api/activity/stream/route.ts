import { subscribeToActivity } from "@/lib/live";
import type { ActivityLog } from "@/lib/types";

export const dynamic = "force-dynamic";

const syntheticMessages = [
  "Book added to Engineering shelf index",
  "Borrow approved from the urgent queue",
  "Reservation created through AI prompt search",
  "Analytics snapshot exported by admin",
  "Cache refreshed for dashboard metrics",
];

function randomActivity(): ActivityLog {
  return {
    id: `stream-${Date.now()}`,
    message: syntheticMessages[Math.floor(Math.random() * syntheticMessages.length)]!,
    timestamp: new Date().toISOString(),
    level: ["info", "success", "warning"][Math.floor(Math.random() * 3)] as ActivityLog["level"],
  };
}

function encodeEvent(activity: ActivityLog) {
  return `data: ${JSON.stringify(activity)}\n\n`;
}

export async function GET() {
  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | undefined;
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
      interval = setInterval(() => {
        push(randomActivity());
      }, 12000);
    },
    cancel() {
      if (interval) {
        clearInterval(interval);
      }
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
