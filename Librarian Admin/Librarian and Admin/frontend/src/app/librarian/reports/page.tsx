import { ReportsModule } from "@/components/modules/reports-module";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function LibrarianReportsPage() {
  return (
    <PermissionGuard permission="reports">
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden px-1">
        <ReportsModule />
      </div>
    </PermissionGuard>
  );
}
