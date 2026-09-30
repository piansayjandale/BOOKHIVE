import { SettingsModule } from "@/components/modules/settings-module";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function SettingsPage() {
  return (
    <PermissionGuard permission="settings">
      <SettingsModule />
    </PermissionGuard>
  );
}
