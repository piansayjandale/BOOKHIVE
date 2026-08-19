import { LibrarianSettingsModule } from "@/components/modules/librarian-settings-module";

export default function TechnicalSettingsPage() {
  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col overflow-hidden px-4 py-5 md:px-8">
      <LibrarianSettingsModule />
    </div>
  );
}
