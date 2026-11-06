import { Suspense } from "react";
import { LazyAuditLogsPage } from "@/components/lazy-modules";
import { PageCircleLoader } from "@/components/ui/page-circle-loader";

export default function Page() {
  return (
    <Suspense fallback={<PageCircleLoader />}>
      <LazyAuditLogsPage />
    </Suspense>
  );
}
