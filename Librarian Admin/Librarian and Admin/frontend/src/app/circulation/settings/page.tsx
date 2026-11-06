import { LazyLibrarianSettingsModule } from "@/components/lazy-modules";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function CirculationSettingsPage() {
  return (
    <PermissionGuard permission="settings">
      <div className="flex h-[calc(100vh-5rem)] flex-col overflow-hidden px-4 py-5 md:px-8">
        <LazyLibrarianSettingsModule />
      </div>
    </PermissionGuard>
  );
}
