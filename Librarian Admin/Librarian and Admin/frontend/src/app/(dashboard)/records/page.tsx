import { Suspense } from "react";
import { RecordsModule } from "@/components/modules/records-module";

export default function RecordsPage() {
  return (
    <Suspense fallback={<div className="h-full w-full animate-pulse bg-white/5 rounded-2xl" />}>
      <RecordsModule />
    </Suspense>
  );
}

