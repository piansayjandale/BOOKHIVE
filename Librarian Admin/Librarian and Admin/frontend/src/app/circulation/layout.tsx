import { AppShell } from "@/components/layout/app-shell";

export default function CirculationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell variant="circulation">{children}</AppShell>;
}
