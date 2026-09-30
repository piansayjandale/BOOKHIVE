import { LibrarianSettingsModule } from "@/components/modules/librarian-settings-module";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function LibrarianSettingsPage() {
  return (
    <PermissionGuard permission="settings">
      <LibrarianSettingsModule />
    </PermissionGuard>
  );
}
