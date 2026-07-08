"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex-1">
        <p className="text-xs font-bold uppercase tracking-[0.32em] text-[var(--topbar-muted)]">
          {eyebrow}
        </p>
        <h1 className="mt-4 text-4xl font-bold text-[var(--topbar-title-color)] leading-tight">{title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--module-muted-color)]">
          {description}
        </p>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export function AdminSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Panel className={cn("p-7", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-[var(--module-title-color)]">{title}</h2>
          {description ? <p className="mt-3 text-base text-[var(--module-muted-color)]">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-8">{children}</div>
    </Panel>
  );
}

export function AdminStatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  return (
    <Panel className="p-6 transition-all duration-300 ease-out hover:shadow-lg">
      <Badge tone={tone}>{label}</Badge>
      <p className="mt-5 text-4xl font-bold text-[var(--module-title-color)] tracking-tight">{value}</p>
    </Panel>
  );
}

export function AdminTable({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="overflow-x-auto rounded-[12px] border border-[var(--line)] transition-all duration-300 ease-out">{children}</div>;
}

export function AdminModal({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="admin-overlay fixed inset-0 z-[80] flex items-center justify-center px-4 py-8 transition-opacity duration-300 ease-out">
      <div className="w-full max-w-3xl rounded-[16px] border border-[var(--line)] bg-[var(--card-bg)] p-8 shadow-2xl">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <h3 className="text-3xl font-bold text-[var(--module-title-color)]">{title}</h3>
            <p className="mt-3 text-base text-[var(--module-muted-color)]">{description}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] border border-[var(--line)] text-[var(--card-foreground)] transition-all duration-300 ease-out hover:bg-[var(--surface-hover)]"
            onClick={onClose}
            aria-label="Close modal"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

export function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-3 block text-xs font-bold uppercase tracking-[0.24em] text-[var(--topbar-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}
