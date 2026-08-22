import { Suspense } from "react";
import { SuperAdminHomePage } from "@/components/super-admin/super-admin-home-page";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-white">Loading Super Admin Home...</div>}>
      <SuperAdminHomePage />
    </Suspense>
  );
}
