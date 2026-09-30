import { HistoryModule } from "@/components/modules/history-module";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function LibrarianHistoryPage() {
  return (
    <PermissionGuard permission="history">
      <HistoryModule />
    </PermissionGuard>
  );
}
