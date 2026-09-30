"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { BookManagementPage } from "./book-management-page";
import { UserManagementPage } from "./user-management-page";
import { ArchiveManagementPage } from "./archive-management-page";
import { cn } from "@/lib/utils";

export function UnifiedManagementPage({ initialTab }: { initialTab?: "books" | "users" | "archive" }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "users" || tabParam === "books" || tabParam === "archive"
    ? tabParam
    : (initialTab || "books");

  const handleTabChange = (tab: "books" | "users" | "archive") => {
    router.push(`/admin/management?tab=${tab}`);
  };

  const tabs = (
    <div className="flex gap-8 border-b border-[var(--line)] pb-0.5">
      <button
        type="button"
        onClick={() => handleTabChange("books")}
        className={cn(
          "pb-4 text-sm font-semibold transition-all relative whitespace-nowrap",
          activeTab === "books" ? "text-white font-bold" : "text-slate-400 hover:text-white"
        )}
      >
        Book Management
        {activeTab === "books" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--accent)]" />}
      </button>
      <button
        type="button"
        onClick={() => handleTabChange("users")}
        className={cn(
          "pb-4 text-sm font-semibold transition-all relative whitespace-nowrap",
          activeTab === "users" ? "text-white font-bold" : "text-slate-400 hover:text-white"
        )}
      >
        User Management
        {activeTab === "users" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--accent)]" />}
      </button>
      <button
        type="button"
        onClick={() => handleTabChange("archive")}
        className={cn(
          "pb-4 text-sm font-semibold transition-all relative whitespace-nowrap",
          activeTab === "archive" ? "text-white font-bold" : "text-slate-400 hover:text-white"
        )}
      >
        Archive
        {activeTab === "archive" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--accent)]" />}
      </button>
    </div>
  );

  if (activeTab === "books") {
    return <BookManagementPage tabs={tabs} />;
  } else if (activeTab === "users") {
    return <UserManagementPage tabs={tabs} />;
  } else {
    return <ArchiveManagementPage tabs={tabs} />;
  }
}
