import { Suspense } from "react";
import { LazyRecordsModule } from "@/components/lazy-modules";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { PageCircleLoader } from "@/components/ui/page-circle-loader";

export default function LibrarianRecordsPage() {
  return (
    <PermissionGuard permission="records">
      <div className="flex min-h-[calc(100vh-5rem)] flex-col px-4 py-5 pb-12 md:px-8">
        <Suspense fallback={<PageCircleLoader />}>
          <LazyRecordsModule />
        </Suspense>
      </div>
    </PermissionGuard>
  );
}
