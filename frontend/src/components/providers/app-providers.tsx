"use client";

import type { ReactNode } from "react";

import { NoticeProvider } from "@/components/providers/notice-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import type { SessionUser, ThemeMode } from "@/lib/types";

export function AppProviders({
  children,
  initialUser,
  initialTheme,
}: {
  children: ReactNode;
  initialUser: SessionUser | null;
  initialTheme: ThemeMode;
}) {
  return (
    <SessionProvider initialUser={initialUser}>
      <ThemeProvider initialTheme={initialTheme}>
        <NoticeProvider>{children}</NoticeProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
