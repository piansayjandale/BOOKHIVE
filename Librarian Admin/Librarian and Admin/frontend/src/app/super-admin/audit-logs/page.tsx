import { Suspense } from "react";
import { AuditLogsPage } from "@/components/super-admin/audit-logs-page";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-white">Loading Audit Logs...</div>}>
      <AuditLogsPage />
    </Suspense>
  );
}
