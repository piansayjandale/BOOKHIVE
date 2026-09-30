import { RemindersModule } from "@/components/modules/reminders-module";

export default function CirculationRemindersPage() {
  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col overflow-hidden px-4 py-5 md:px-8">
      <RemindersModule />
    </div>
  );
}
