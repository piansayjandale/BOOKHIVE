import { Suspense } from "react";
import { RecordsPage } from "@/components/super-admin/records-page";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-white">Loading Records...</div>}>
      <RecordsPage />
    </Suspense>
  );
}
