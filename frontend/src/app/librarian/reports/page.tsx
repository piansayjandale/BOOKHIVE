import { ReportsModule } from "@/components/modules/reports-module";

export default function LibrarianReportsPage() {
  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col overflow-hidden px-4 py-5 md:px-8">
      <ReportsModule />
    </div>
  );
}
