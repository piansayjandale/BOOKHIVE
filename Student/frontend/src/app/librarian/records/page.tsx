import { RecordsModule } from "@/components/modules/records-module";

export default function LibrarianRecordsPage() {
  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col overflow-hidden px-4 py-5 md:px-8">
      <RecordsModule />
    </div>
  );
}
