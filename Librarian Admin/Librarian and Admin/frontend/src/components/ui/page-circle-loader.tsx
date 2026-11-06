"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface PageCircleLoaderProps {
  className?: string;
  label?: string;
  size?: "sm" | "md" | "lg" | "fullscreen";
}

export function PageCircleLoader({
  className,
  label = "Loading page...",
  size = "md",
}: PageCircleLoaderProps) {
  const isFullscreen = size === "fullscreen";

  const iconSizes = {
    sm: "h-6 w-6",
    md: "h-10 w-10",
    lg: "h-14 w-14",
    fullscreen: "h-14 w-14",
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        "flex flex-col items-center justify-center gap-3 transition-opacity duration-200 ease-out",
        isFullscreen
          ? "fixed inset-0 z-50 bg-[var(--background)]/80 backdrop-blur-xs"
          : "min-h-[40vh] w-full py-10",
        className
      )}
    >
      <div className="relative flex items-center justify-center">
        {/* Unified, single cohesive circular spinner with BookHive yellow accent */}
        <svg
          className={cn("animate-spin text-[#FFD600]", iconSizes[size])}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle background circular track */}
          <circle
            cx="24"
            cy="24"
            r="19"
            stroke="currentColor"
            strokeWidth="3.5"
            className="text-slate-400/20 dark:text-white/15"
          />
          {/* Smooth spinning arc */}
          <circle
            cx="24"
            cy="24"
            r="19"
            stroke="#FFD600"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray="119.38"
            strokeDashoffset="82"
          />
        </svg>
      </div>

      {label ? (
        <p className="text-xs font-medium tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </p>
      ) : null}
      <span className="sr-only">{label}</span>
    </div>
  );
}
