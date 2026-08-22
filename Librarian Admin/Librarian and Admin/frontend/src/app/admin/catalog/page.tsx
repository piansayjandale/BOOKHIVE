import { Suspense } from "react";
import { CatalogPage } from "@/components/admin/catalog-page";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-white">Loading Catalog...</div>}>
      <CatalogPage />
    </Suspense>
  );
}
