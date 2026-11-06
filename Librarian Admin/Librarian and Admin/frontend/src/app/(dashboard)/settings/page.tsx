import { LazySettingsModule } from "@/components/lazy-modules";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function SettingsPage() {
  return (
    <PermissionGuard permission="settings">
      <LazySettingsModule />
    </PermissionGuard>
  );
}
