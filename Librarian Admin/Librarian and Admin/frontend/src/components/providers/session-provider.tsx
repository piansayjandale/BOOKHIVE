"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { SessionUser } from "@/lib/types";
import { dashboardSocket } from "@/lib/socket";

interface SessionContextValue {
  user: SessionUser | null;
  setUser: (user: SessionUser | null) => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser: SessionUser | null;
}) {
  const [user, setUser] = useState<SessionUser | null>(initialUser);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
        }
      }
    } catch (err) {
      console.warn("Failed to refresh session user:", err);
    }
  }, []);

  // Refresh user permissions on mount
  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  // Listen to live socket events for user mutations/permission changes
  useEffect(() => {
    const unsubscribe = dashboardSocket.subscribeToUserMutation((event) => {
      // If mutation affects the current user or is permission update
      if (!user) return;
      if (!event?.payload?.id || event.payload.id === user.id || event.payload.email === user.email) {
        void refreshUser();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user, refreshUser]);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      setUser,
      refreshUser,
      logout: async () => {
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } catch (err) {
          console.warn("Logout request failed or interrupted:", err);
        } finally {
          setUser(null);
          window.location.assign("/login");
        }
      },
    }),
    [user, refreshUser],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider.");
  }

  return context;
}
