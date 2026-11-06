import { LazyHistoryModule } from "@/components/lazy-modules";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function LibrarianHistoryPage() {
  return (
    <PermissionGuard permission="history">
      <LazyHistoryModule />
    </PermissionGuard>
  );
}
