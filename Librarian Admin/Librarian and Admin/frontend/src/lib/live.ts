import type { ActivityLog } from "@/lib/types";

type ActivityListener = (activity: ActivityLog) => void;

declare global {
  var __bookhiveListeners: Set<ActivityListener> | undefined;
}

function getListeners() {
  if (!globalThis.__bookhiveListeners) {
    globalThis.__bookhiveListeners = new Set<ActivityListener>();
  }

  return globalThis.__bookhiveListeners;
}

export function publishActivity(activity: ActivityLog) {
  for (const listener of getListeners()) {
    listener(activity);
  }
}

export function subscribeToActivity(listener: ActivityListener) {
  const listeners = getListeners();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

