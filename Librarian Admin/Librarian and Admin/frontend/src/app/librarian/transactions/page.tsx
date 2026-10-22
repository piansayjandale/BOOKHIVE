import { TransactionsModule } from "@/components/modules/transactions-module";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function LibrarianTransactionsPage() {
  return (
    <PermissionGuard permission="transactions">
      <div className="flex min-h-[calc(100vh-5rem)] w-full max-w-full flex-col px-3 py-5 sm:px-6 lg:px-8 pb-10">
        <TransactionsModule />
      </div>
    </PermissionGuard>
  );
}
