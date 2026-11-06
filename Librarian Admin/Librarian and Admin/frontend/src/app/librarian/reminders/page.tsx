import { LazyRemindersModule } from "@/components/lazy-modules";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function LibrarianRemindersPage() {
  return (
    <PermissionGuard permission="reminders">
      <div className="flex h-[calc(100vh-5rem)] flex-col overflow-hidden px-4 py-5 md:px-8">
        <LazyRemindersModule />
      </div>
    </PermissionGuard>
  );
}
