import { Badge } from "@/components/ui/badge";

export function ModuleHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <Badge>{eyebrow}</Badge>
        <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-[var(--module-title-color)]">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--module-muted-color)]">{description}</p>
      </div>
    </div>
  );
}

