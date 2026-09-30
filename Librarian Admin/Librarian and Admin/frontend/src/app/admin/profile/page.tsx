import { ProfilePage } from "@/components/admin/profile-page";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function Page() {
  return (
    <PermissionGuard permission="settings">
      <ProfilePage />
    </PermissionGuard>
  );
}
