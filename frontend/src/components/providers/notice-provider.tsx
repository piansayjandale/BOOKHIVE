"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";

import { cn } from "@/lib/utils";

type NoticeTone = "success" | "error" | "info";

interface NoticeItem {
  id: string;
  tone: NoticeTone;
  message: string;
}

interface NoticeContextValue {
  notify: (message: string, tone?: NoticeTone) => void;
}

const NoticeContext = createContext<NoticeContextValue | null>(null);

export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<NoticeItem[]>([]);

  const notify = useCallback((message: string, tone: NoticeTone = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setNotices((current) => [...current, { id, tone, message }].slice(-4));
    window.setTimeout(() => {
      setNotices((current) => current.filter((notice) => notice.id !== id));
    }, 3200);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <NoticeContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-full max-w-sm flex-col gap-3">
        {notices.map((notice) => {
          const Icon =
            notice.tone === "success" ? CheckCircle2 : notice.tone === "error" ? CircleAlert : Info;
          return (
            <div
              key={notice.id}
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur",
                notice.tone === "success" && "admin-success-btn",
                notice.tone === "error" && "admin-danger-btn",
                notice.tone === "info" && "admin-info-chip",
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="flex-1 text-sm font-medium">{notice.message}</p>
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-current/10 bg-current/10"
                onClick={() =>
                  setNotices((current) => current.filter((item) => item.id !== notice.id))
                }
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </NoticeContext.Provider>
  );
}

export function useNotice() {
  const context = useContext(NoticeContext);
  if (!context) {
    throw new Error("useNotice must be used within NoticeProvider.");
  }

  return context;
}
