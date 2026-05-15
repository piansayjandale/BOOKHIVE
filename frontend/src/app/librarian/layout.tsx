import { AppShell } from "@/components/layout/app-shell";

export default function LibrarianLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell variant="librarian">{children}</AppShell>;
}
