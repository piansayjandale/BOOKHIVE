import type { Metadata } from "next";

import { AppProviders } from "@/components/providers/app-providers";
import { getSession } from "@/lib/auth";
import "./globals.css";
import "@/styles/dashboard.css";

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

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full"
    >
      <body className="min-h-full">
        <AppProviders initialUser={session} initialTheme="dark">
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
