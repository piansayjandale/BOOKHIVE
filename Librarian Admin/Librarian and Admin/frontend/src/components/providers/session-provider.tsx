"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  const [user, setUserState] = useState<SessionUser | null>(initialUser);
  const userRef = useRef<SessionUser | null>(initialUser);
  const isRefreshingRef = useRef(false);

  // Keep userRef synchronized with current user state
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const setUser = useCallback((newUser: SessionUser | null) => {
    setUserState(newUser);
    if (typeof window !== "undefined") {
      try {
        if (newUser) {
          sessionStorage.setItem("bookhive_tab_user", JSON.stringify(newUser));
        } else {
          sessionStorage.removeItem("bookhive_tab_user");
        }
      } catch {}
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;

    try {
      // Determine tab-specific identity from sessionStorage, userRef, or initialUser
      let currentTabUser: SessionUser | null = null;
      if (typeof window !== "undefined") {
        try {
          const stored = sessionStorage.getItem("bookhive_tab_user");
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && (parsed.id || parsed.email)) {
              currentTabUser = parsed;
            }
          }
        } catch {}
      }
      if (!currentTabUser) {
        currentTabUser = userRef.current || initialUser;
      }

      const queryParams = new URLSearchParams();
      if (currentTabUser?.id) {
        queryParams.set("userId", String(currentTabUser.id));
      }
      if (currentTabUser?.email) {
        queryParams.set("email", String(currentTabUser.email));
      }
      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";

      const headers: Record<string, string> = {};
      if (currentTabUser?.id) headers["x-bookhive-user-id"] = String(currentTabUser.id);
      if (currentTabUser?.email) headers["x-bookhive-user-email"] = String(currentTabUser.email);

      const res = await fetch(`/api/auth/me${queryString}`, {
        cache: "no-store",
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUserState((currentUser) => {
            const activeUser = currentUser || userRef.current || currentTabUser;
            if (!activeUser) {
              try {
                sessionStorage.setItem("bookhive_tab_user", JSON.stringify(data.user));
              } catch {}
              return data.user;
            }

            // CRITICAL: Check if response corresponds to this tab's active identity
            const isSameUser =
              (data.user.id && activeUser.id && String(data.user.id) === String(activeUser.id)) ||
              (data.user.email && activeUser.email && data.user.email.toLowerCase() === activeUser.email.toLowerCase());

            if (isSameUser) {
              // Deep compare permissions and fields to avoid useless state mutations and re-renders
              const permsMatch =
                JSON.stringify(activeUser.permissions || {}) === JSON.stringify(data.user.permissions || {});
              const metaMatch =
                activeUser.name === data.user.name &&
                activeUser.role === data.user.role &&
                activeUser.subRole === data.user.subRole &&
                activeUser.id === data.user.id;

              if (permsMatch && metaMatch) {
                return currentUser;
              }

              const merged = { ...activeUser, ...data.user };
              try {
                sessionStorage.setItem("bookhive_tab_user", JSON.stringify(merged));
              } catch {}
              return merged;
            }

            // Different user logged in on another tab: keep this tab's own user identity intact
            return currentUser;
          });
        }
      }
    } catch (err) {
      console.warn("Failed to refresh session user:", err);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [initialUser]);

  // Hydrate tab identity on mount and validate fresh permissions once
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("bookhive_tab_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.name && (parsed?.id || parsed?.email)) {
          setUserState((prev) => {
            if (
              prev &&
              prev.id === parsed.id &&
              JSON.stringify(prev.permissions || {}) === JSON.stringify(parsed.permissions || {})
            ) {
              return prev;
            }
            return parsed;
          });
        }
      } else if (initialUser) {
        sessionStorage.setItem("bookhive_tab_user", JSON.stringify(initialUser));
      }
    } catch {}

    // Fetch latest permissions and details from server so admin changes take effect immediately
    void refreshUser();
  }, [refreshUser, initialUser]);

  // Listen to window focus and storage events to instantly re-sync when switching back to tab
  useEffect(() => {
    const handleFocus = () => {
      void refreshUser();
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "bookhive_tab_user" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && (parsed.id || parsed.email)) {
            setUserState((prev) => {
              if (prev && JSON.stringify(prev) === JSON.stringify(parsed)) {
                return prev;
              }
              return parsed;
            });
          }
        } catch {}
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleStorage);
    };
  }, [refreshUser]);

  // Listen to live socket events for user mutations/permission changes specifically targeted to this user
  useEffect(() => {
    const unsubscribe = dashboardSocket.subscribeToUserMutation((event) => {
      let currentTabUser: SessionUser | null = null;
      if (typeof window !== "undefined") {
        try {
          const stored = sessionStorage.getItem("bookhive_tab_user");
          if (stored) currentTabUser = JSON.parse(stored);
        } catch {}
      }
      const activeUser = userRef.current || currentTabUser;
      if (!activeUser) return;

      const targetUser = event?.user || event?.payload || event?.data;
      const targetId = targetUser?.id || event?.id;
      const targetEmail = targetUser?.email || event?.email;

      // Only refresh if the event is specifically for THIS logged-in user
      const isTargetedToMe =
        (targetId && String(targetId) === String(activeUser.id)) ||
        (targetEmail && activeUser.email && targetEmail.toLowerCase() === activeUser.email.toLowerCase());

      if (isTargetedToMe) {
        if (targetUser?.permissions) {
          setUserState((prev) => {
            if (!prev) return prev;
            if (JSON.stringify(prev.permissions || {}) === JSON.stringify(targetUser.permissions)) {
              return prev;
            }
            const updated = { ...prev, permissions: targetUser.permissions };
            try {
              sessionStorage.setItem("bookhive_tab_user", JSON.stringify(updated));
            } catch {}
            return updated;
          });
        }
        void refreshUser();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [refreshUser]);

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
          // Do NOT call setUser(null) on the dying page - that causes React to re-render
          // the dashboard with empty user state ("Administrator" / "A") for a split-second
          // before the browser unloads.
          if (typeof window !== "undefined") {
            try {
              sessionStorage.removeItem("bookhive_tab_user");
            } catch {}
            window.location.replace("/login");
          }
        }
      },
    }),
    [user, setUser, refreshUser],
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
