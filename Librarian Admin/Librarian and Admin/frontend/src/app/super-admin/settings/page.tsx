import { Suspense } from "react";
import { SuperAdminSettingsPage } from "@/components/super-admin/settings-page";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-white">Loading Settings...</div>}>
      <SuperAdminSettingsPage />
    </Suspense>
  );
}
