import { cn } from "@/lib/utils";

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
  className?: string;
}) {
  const tones = {
    default: "border-transparent bg-[var(--card-foreground)]/6 text-[var(--card-foreground)]",
    success: "border-transparent bg-[var(--success)]/12 text-[var(--success)]",
    warning: "border-transparent bg-[var(--warning)]/12 text-[var(--warning)]",
    danger: "border-transparent bg-[var(--danger)]/12 text-[var(--danger)]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.16em] uppercase",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

