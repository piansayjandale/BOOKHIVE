import { TransactionsModule } from "@/components/modules/transactions-module";

export default function LibrarianTransactionsPage() {
  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col overflow-hidden px-4 py-5 md:px-8">
      <TransactionsModule />
    </div>
  );
}
