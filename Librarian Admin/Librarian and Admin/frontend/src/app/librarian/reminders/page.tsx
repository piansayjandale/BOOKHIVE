import { RemindersModule } from "@/components/modules/reminders-module";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function LibrarianRemindersPage() {
  return (
    <PermissionGuard permission="reminders">
      <div className="flex h-[calc(100vh-5rem)] flex-col overflow-hidden px-4 py-5 md:px-8">
        <RemindersModule />
      </div>
    </PermissionGuard>
  );
}
