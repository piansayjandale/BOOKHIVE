import { AppShell } from "@/components/layout/app-shell";

export default function TechnicalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell variant="technical">{children}</AppShell>;
}
