"use client";

import { useEffect, useState } from "react";

import type { ActivityLog } from "@/lib/types";

export function useLiveActivity(initialActivity: ActivityLog[]) {
  const [streamedActivity, setStreamedActivity] = useState<ActivityLog[]>([]);

  useEffect(() => {
    const source = new EventSource("/api/activity/stream");

    source.onmessage = (event) => {
      const nextActivity = JSON.parse(event.data) as ActivityLog;
      setStreamedActivity((current) => [nextActivity, ...current].slice(0, 40));
    };

    return () => {
      source.close();
    };
  }, []);

  return [...streamedActivity, ...initialActivity].slice(0, 40);
}
