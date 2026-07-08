import { AppShell } from "@/components/layout/app-shell";
import { getSession } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const variant = session?.role === "Admin" ? "admin" : "librarian";

  return <AppShell variant={variant}>{children}</AppShell>;
}
