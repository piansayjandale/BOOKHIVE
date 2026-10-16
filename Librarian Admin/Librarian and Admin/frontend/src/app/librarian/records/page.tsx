import { Suspense } from "react";
import { RecordsModule } from "@/components/modules/records-module";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function LibrarianRecordsPage() {
  return (
    <PermissionGuard permission="records">
      <div className="flex min-h-[calc(100vh-5rem)] flex-col px-4 py-5 pb-12 md:px-8">
        <Suspense fallback={<div className="h-full w-full animate-pulse bg-white/5 rounded-2xl" />}>
          <RecordsModule />
        </Suspense>
      </div>
    </PermissionGuard>
  );
}
