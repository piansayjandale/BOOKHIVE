"use client";

import { startTransition, useCallback, useDeferredValue, useEffect, useState } from "react";

import { ModuleHeader } from "@/components/ui/module-header";
import { Panel } from "@/components/ui/panel";
import { VirtualizedList } from "@/components/ui/virtualized-list";
import type { HistoryEntry } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const modules = ["All", "Records", "Transactions", "Settings", "Accounts", "Announcements"] as const;

export function HistoryModule() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [module, setModule] = useState<(typeof modules)[number]>("All");
  const deferredSearch = useDeferredValue(search);

  const loadHistory = useCallback(async () => {
    const params = new URLSearchParams({
      search: deferredSearch,
      module,
    });
    const response = await fetch(`/api/history?${params.toString()}`);
    const payload = (await response.json()) as { history: HistoryEntry[] };
    startTransition(() => setHistory(payload.history));
  }, [deferredSearch, module]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  return (
    <div className="space-y-8">
      <ModuleHeader
        eyebrow="History"
        title="Audit trail for every critical library action"
        description="Search timestamped changes across records, transactions, settings, and account administration for confident operational reviews."
      />

      <Panel className="p-6">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
          <input
            className="glass-input rounded-2xl px-4 py-3"
            placeholder="Search actor, action, target, or detail"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="glass-input rounded-2xl px-4 py-3"
            value={module}
            onChange={(event) => setModule(event.target.value as (typeof modules)[number])}
          >
            {modules.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 rounded-[28px] border border-white/8 bg-black/15 p-3">
          <VirtualizedList
            items={history}
            height={660}
            itemHeight={96}
            renderItem={(entry) => (
              <div className="h-[96px] px-2 py-2">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      className={`${
                        entry.module === "Settings"
                          ? "bg-amber-400"
                          : entry.module === "Transactions"
                            ? "bg-emerald-400"
                            : "bg-sky-400"
                      } h-3 w-3 rounded-full`}
                    />
                    <div className="mt-2 h-full w-px bg-[var(--line)]" />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[var(--module-title-color)]">{entry.action} <span className="text-xs text-[var(--module-muted-color)]">• {entry.module}</span></p>
                        <p className="mt-1 text-xs text-[var(--module-muted-2)]">{entry.actor} • {entry.target}</p>
                      </div>
                      <div className="text-xs text-[var(--module-muted-2)]">{formatDateTime(entry.timestamp)}</div>
                    </div>
                    <p className="mt-2 text-sm text-[var(--module-muted-color)] line-clamp-2">{entry.detail}</p>
                  </div>
                </div>
              </div>
            )}
          />
        </div>
      </Panel>
    </div>
  );
}
