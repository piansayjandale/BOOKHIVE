import { Suspense } from "react";
import { LazyRecordsModule } from "@/components/lazy-modules";
import { PageCircleLoader } from "@/components/ui/page-circle-loader";

export default function CirculationRecordsPage() {
  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col px-4 py-5 pb-12 md:px-8">
      <Suspense fallback={<PageCircleLoader />}>
        <LazyRecordsModule variant="circulation" />
      </Suspense>
    </div>
  );
}
