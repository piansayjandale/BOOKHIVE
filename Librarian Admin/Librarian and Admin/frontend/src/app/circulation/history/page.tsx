import { LazyHistoryModule } from "@/components/lazy-modules";

export default function CirculationHistoryPage() {
  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col overflow-hidden px-4 py-5 md:px-8">
      <LazyHistoryModule />
    </div>
  );
}
