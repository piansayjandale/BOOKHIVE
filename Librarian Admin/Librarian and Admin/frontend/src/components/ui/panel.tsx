import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      style={{ borderRadius: 'var(--radius-lg)' }}
      className={cn(
        "bh-panel border border-[var(--line)] bg-[var(--card-bg)] text-[var(--card-foreground)] shadow-none",
        className,
      )}
    >
      {children}
    </section>
  );
}

