"use client";

import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

import { Panel } from "@/components/ui/panel";

export function MetricCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent: string;
}) {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <Panel className="overflow-hidden p-5 bg-[var(--card-bg)] text-[var(--card-foreground)] border">
        <div className="mb-4 flex items-start justify-between">
          <div
            className="h-11 w-11 rounded-2xl"
            style={{
              background: `linear-gradient(135deg, ${accent}, rgba(0,0,0,0.04))`,
            }}
          />
          <ArrowUpRight className="h-4 w-4 text-[var(--card-foreground)]/50" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em]">{label}</p>
        <h3 className="mt-2 text-3xl font-semibold">{value}</h3>
        <p className="mt-2 text-sm text-[var(--muted)]">{detail}</p>
      </Panel>
    </motion.div>
  );
}
