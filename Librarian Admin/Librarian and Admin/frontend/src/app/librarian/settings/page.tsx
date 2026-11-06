import { LazyLibrarianSettingsModule } from "@/components/lazy-modules";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function LibrarianSettingsPage() {
  return (
    <PermissionGuard permission="settings">
      <LazyLibrarianSettingsModule />
    </PermissionGuard>
  );
}
