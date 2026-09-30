import { LibrarianSettingsModule } from "@/components/modules/librarian-settings-module";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function TechnicalSettingsPage() {
  return (
    <PermissionGuard permission="settings">
      <div className="flex h-[calc(100vh-5rem)] flex-col overflow-hidden px-4 py-5 md:px-8">
        <LibrarianSettingsModule />
      </div>
    </PermissionGuard>
  );
}
