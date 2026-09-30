import { Suspense } from "react";
import { SystemManagementPage } from "@/components/super-admin/system-management-page";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-white">Loading System Management...</div>}>
      <SystemManagementPage />
    </Suspense>
  );
}
