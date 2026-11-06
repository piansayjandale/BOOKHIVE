import { Suspense } from "react";
import { LazyRecordsModule } from "@/components/lazy-modules";
import { PageCircleLoader } from "@/components/ui/page-circle-loader";

export default function RecordsPage() {
  return (
    <Suspense fallback={<PageCircleLoader />}>
      <LazyRecordsModule />
    </Suspense>
  );
}
