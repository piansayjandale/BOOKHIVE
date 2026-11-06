import { LazyProfilePage } from "@/components/lazy-modules";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function Page() {
  return (
    <PermissionGuard permission="settings">
      <LazyProfilePage />
    </PermissionGuard>
  );
}
