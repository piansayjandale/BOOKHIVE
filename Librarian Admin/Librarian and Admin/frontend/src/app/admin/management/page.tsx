import { Suspense } from "react";
import { UnifiedManagementPage } from "@/components/admin/unified-management-page";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-white">Loading management...</div>}>
      <UnifiedManagementPage />
    </Suspense>
  );
}
