import { TransactionsModule } from "@/components/modules/transactions-module";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function LibrarianTransactionsPage() {
  return (
    <PermissionGuard permission="transactions">
      <div className="flex min-h-[calc(100vh-5rem)] flex-col px-4 py-5 md:px-8 pb-10">
        <TransactionsModule />
      </div>
    </PermissionGuard>
  );
}
