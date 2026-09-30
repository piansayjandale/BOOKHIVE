"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

interface CustomSelectProps {
  label?: string;
  subLabel?: string;
  value: string;
  options: string[];
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
}

export function CustomSelect({
  label,
  subLabel,
  value,
  options,
  onChange,
  placeholder = "-- Select --",
  className = "",
  buttonClassName = "",
  menuClassName = "",
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const isLight = theme === "light";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div ref={containerRef} className={cn("relative grid gap-1.5", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <span className={cn("text-[11px] font-semibold tracking-wide uppercase", isLight ? "text-slate-500" : "text-slate-400")}>
            {label}
          </span>
          {subLabel && <span className={cn("text-[10px] font-medium", isLight ? "text-slate-500" : "text-slate-400")}>{subLabel}</span>}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          buttonClassName || "modal-input",
          "flex items-center justify-between text-left cursor-pointer transition select-none w-full",
          !buttonClassName && (isLight
            ? "border-slate-300 bg-white text-[#0c1b3a] hover:border-[#0274bb] focus:border-[#0274bb]"
            : "border-white/10 bg-white/5 text-white hover:border-white/20 focus:border-[#FCD400]")
        )}
      >
        <span className={cn("truncate font-medium", value ? (isLight && !buttonClassName ? "text-[#0c1b3a]" : "text-inherit") : "text-slate-400")}>
          {value || placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-200 ml-2",
            isLight ? "text-slate-500" : "text-slate-400",
            open && (isLight ? "rotate-180 text-[#0274bb]" : "rotate-180 text-[#FCD400]")
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute top-full right-0 z-50 mt-1.5 w-full min-w-[200px] max-h-60 overflow-y-auto rounded-xl p-1.5 shadow-2xl backdrop-blur-md",
            isLight
              ? "border border-slate-200 bg-white text-slate-800 shadow-slate-400/30"
              : "border border-[#2E3F5C] bg-[#0E1A26] text-white shadow-black/90",
            menuClassName
          )}
          style={{ transformOrigin: "top" }}
        >
          {options.map((opt) => {
            const isSelected = value === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition cursor-pointer text-left",
                  isSelected
                    ? (isLight
                        ? "bg-[#0274bb] text-white font-bold shadow-sm"
                        : "bg-[#FCD400] text-[#0F1D29] font-bold shadow-sm")
                    : (isLight
                        ? "text-slate-700 hover:bg-slate-100 hover:text-[#0274bb]"
                        : "text-slate-200 hover:bg-white/10 hover:text-white")
                )}
              >
                <span className="truncate">{opt}</span>
                {isSelected && (
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 ml-1.5",
                      isLight ? "text-white" : "text-[#0F1D29]"
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
