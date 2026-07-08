import { DashboardFigma } from "@/components/dashboard/dashboard-figma";

// Force cache bust to resolve Next.js HMR load issues
export default function LibrarianHomePage() {
  return <DashboardFigma variant="librarian" />;
}
