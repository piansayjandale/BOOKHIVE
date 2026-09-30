import type { Metadata } from "next";
import { cookies } from "next/headers";

import { AppProviders } from "@/components/providers/app-providers";
import { getSession } from "@/lib/auth";
import type { ThemeMode } from "@/lib/types";
import "./globals.css";

export const metadata: Metadata = {
  title: "BookHive Monitor",
  description:
    "BookHive admin dashboard for STI West Negros University Library with AI prompt search, reservations, and descriptive analytics.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("bookhive-theme")?.value;
  const initialTheme: ThemeMode =
    themeCookie === "light" || themeCookie === "dark" ? themeCookie : "light";

  return (
    <html
      lang="en"
      data-theme={initialTheme}
      suppressHydrationWarning
      className="h-full"
    >
      <body className="min-h-full">
        <AppProviders initialUser={session} initialTheme={initialTheme}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
