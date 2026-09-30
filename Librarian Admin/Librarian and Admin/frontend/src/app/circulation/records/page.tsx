import { Suspense } from "react";
import { RecordsModule } from "@/components/modules/records-module";

export default function CirculationRecordsPage() {
  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col overflow-hidden px-4 py-5 md:px-8">
      <Suspense fallback={<div className="h-full w-full animate-pulse bg-white/5 rounded-2xl" />}>
        <RecordsModule variant="circulation" />
      </Suspense>
    </div>
  );
}
