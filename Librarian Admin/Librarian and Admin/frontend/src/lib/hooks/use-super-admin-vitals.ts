"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestJson } from "@/lib/admin/client";
import { dashboardSocket } from "@/lib/socket";
import { subscribeToActivity } from "@/lib/live";
import type { SuperAdminDashboardPayload } from "@/lib/types";

export interface UseSuperAdminVitalsOptions {
  pollingIntervalMs?: number;
  enableLiveSocket?: boolean;
  enableActivityStream?: boolean;
}

export interface UseSuperAdminVitalsReturn {
  data: SuperAdminDashboardPayload | null;
  vitals: SuperAdminDashboardPayload["vitals"] | null;
  telemetry: SuperAdminDashboardPayload["telemetry"] | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isLiveConnected: boolean;
  lastUpdated: Date | null;
  error: string | null;
  refresh: (isManual?: boolean) => Promise<void>;
}

const DEFAULT_VITALS: SuperAdminDashboardPayload["vitals"] = {
  totalUsers: 0,
  superAdminsCount: 0,
  adminsCount: 0,
  librariansCount: 0,
  studentsCount: 0,
  activeBooksCount: 0,
  archivedBooksCount: 0,
  totalTransactions: 0,
  pendingTransactions: 0,
  activeBorrows: 0,
  totalAiSearches: 0,
  totalAuditLogs: 0,
};

const DEFAULT_TELEMETRY: SuperAdminDashboardPayload["telemetry"] = {
  platformStatus: "Operational",
  databaseStatus: "Connected (PostgreSQL)",
  memoryUsagePercent: 36,
  storageUsedPercent: 24,
  uptimeSeconds: 3600,
  nodeVersion: "v20.x",
  searchIndexStatus: "Healthy",
  institutionalSyncStatus: "Synchronized (STI WNU)",
};

export function useSuperAdminVitals(options: UseSuperAdminVitalsOptions = {}): UseSuperAdminVitalsReturn {
  const {
    pollingIntervalMs = 4000,
    enableLiveSocket = true,
    enableActivityStream = true,
  } = options;

  const [data, setData] = useState<SuperAdminDashboardPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);

  const fetchVitals = useCallback(
    async (isManual: boolean = false) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      if (isManual) {
        setIsRefreshing(true);
      }

      try {
        setError(null);
        const res = await requestJson<SuperAdminDashboardPayload>("/api/super-admin/dashboard");
        if (res && res.vitals) {
          setData(res);
          setLastUpdated(new Date());
        }
      } catch (err: any) {
        console.warn("[useSuperAdminVitals] Telemetry fetch warning:", err?.message || err);
        setError(err?.message || "Failed to synchronize vitals");
      } finally {
        isFetchingRef.current = false;
        setIsLoading(false);
        if (isManual) {
          setTimeout(() => setIsRefreshing(false), 400);
        }
      }
    },
    [],
  );

  const triggerDebouncedFetch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      void fetchVitals(false);
    }, 250);
  }, [fetchVitals]);

  // 1. Initial Load & Background Polling Engine
  useEffect(() => {
    void fetchVitals(false);

    if (pollingIntervalMs <= 0) return;

    let timer: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          return;
        }
        void fetchVitals(false);
      }, pollingIntervalMs);
    };

    const stopPolling = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    startPolling();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchVitals(false);
        startPolling();
      } else {
        stopPolling();
      }
    };

    const handleWindowFocus = () => {
      void fetchVitals(false);
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      stopPolling();
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [fetchVitals, pollingIntervalMs]);

  // 2. Real-Time Socket Connection & Targeted Room Multiplexing
  useEffect(() => {
    if (!enableLiveSocket) return;

    // Join Super Admin telemetry room
    dashboardSocket.joinRoom("room:super-admin-telemetry");

    const unsubConnection = dashboardSocket.subscribeToConnection((connected) => {
      setIsLiveConnected(connected);
      if (connected) {
        dashboardSocket.joinRoom("room:super-admin-telemetry");
      }
    });

    // Listen to direct telemetry payload broadcasts
    const unsubTelemetry = dashboardSocket.subscribeToTelemetry((payload) => {
      if (payload && payload.vitals) {
        setData(payload);
        setLastUpdated(new Date());
      } else if (payload && payload.event_type === "SEARCH_EXECUTED") {
        // Optimistically increment AI search counter
        setData((prev) => {
          if (!prev || !prev.vitals) return prev;
          return {
            ...prev,
            vitals: {
              ...prev.vitals,
              totalAiSearches: prev.vitals.totalAiSearches + 1,
            },
          };
        });
      } else {
        triggerDebouncedFetch();
      }
    });

    const unsubUserMutation = dashboardSocket.subscribeToUserMutation(() => {
      triggerDebouncedFetch();
    });

    const unsubCatalog = dashboardSocket.subscribeToCatalog(() => {
      triggerDebouncedFetch();
    });

    const unsubBorrow = dashboardSocket.subscribeToBorrowRequest(() => {
      triggerDebouncedFetch();
    });

    const unsubCancel = dashboardSocket.subscribeToCancelRequest(() => {
      triggerDebouncedFetch();
    });

    const unsubNotification = dashboardSocket.subscribeToNotification(() => {
      triggerDebouncedFetch();
    });

    return () => {
      dashboardSocket.leaveRoom("room:super-admin-telemetry");
      unsubConnection();
      unsubTelemetry();
      unsubUserMutation();
      unsubCatalog();
      unsubBorrow();
      unsubCancel();
      unsubNotification();
    };
  }, [enableLiveSocket, triggerDebouncedFetch]);

  // 3. Real-Time Activity Stream Listener
  useEffect(() => {
    if (!enableActivityStream) return;

    const unsubActivity = subscribeToActivity(() => {
      triggerDebouncedFetch();
    });

    return () => {
      unsubActivity();
    };
  }, [enableActivityStream, triggerDebouncedFetch]);

  return {
    data,
    vitals: data?.vitals ?? (isLoading ? null : DEFAULT_VITALS),
    telemetry: data?.telemetry ?? (isLoading ? null : DEFAULT_TELEMETRY),
    isLoading,
    isRefreshing,
    isLiveConnected,
    lastUpdated,
    error,
    refresh: () => fetchVitals(true),
  };
}
