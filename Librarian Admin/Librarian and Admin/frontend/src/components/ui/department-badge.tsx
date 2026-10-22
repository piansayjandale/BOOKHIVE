"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/providers/theme-provider";

export interface DepartmentStyle {
  code: string;
  name: string;
  dot: string;
  badgeLight: string;
  badgeDark: string;
}

export const DEPARTMENT_CONFIGS: Record<string, DepartmentStyle> = {
  CICT: {
    code: "CICT",
    name: "College of Information & Communications Technology",
    dot: "bg-red-500",
    badgeLight: "bg-red-100 text-red-950 border-red-300",
    badgeDark: "bg-red-500/20 text-red-300 border-red-500/40",
  },
  COE: {
    code: "COE",
    name: "College of Engineering",
    dot: "bg-orange-500",
    badgeLight: "bg-orange-100 text-orange-950 border-orange-300",
    badgeDark: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  },
  CBMA: {
    code: "CBMA",
    name: "College of Business Management & Accountancy",
    dot: "bg-amber-500",
    badgeLight: "bg-amber-100 text-amber-950 border-amber-300",
    badgeDark: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  },
  CAS: {
    code: "CAS",
    name: "College of Arts & Sciences",
    dot: "bg-emerald-500",
    badgeLight: "bg-emerald-100 text-emerald-950 border-emerald-300",
    badgeDark: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  },
  CED: {
    code: "CED",
    name: "College of Education",
    dot: "bg-blue-500",
    badgeLight: "bg-blue-100 text-blue-950 border-blue-300",
    badgeDark: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  },
  CHTM: {
    code: "CHTM",
    name: "College of Hospitality & Tourism Management",
    dot: "bg-pink-500",
    badgeLight: "bg-pink-100 text-pink-950 border-pink-300",
    badgeDark: "bg-pink-500/20 text-pink-300 border-pink-500/40",
  },
  CCJE: {
    code: "CCJE",
    name: "College of Criminal Justice Education",
    dot: "bg-purple-500",
    badgeLight: "bg-purple-100 text-purple-950 border-purple-300",
    badgeDark: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  },
  CIRCULATION: {
    code: "Circulation",
    name: "Circulation Section",
    dot: "bg-teal-500",
    badgeLight: "bg-teal-100 text-teal-950 border-teal-300",
    badgeDark: "bg-teal-500/20 text-teal-300 border-teal-500/40",
  },
  SYSTEM_ADMIN: {
    code: "System Admin",
    name: "System Administration",
    dot: "bg-indigo-500",
    badgeLight: "bg-indigo-100 text-indigo-950 border-indigo-300",
    badgeDark: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
  },
  LIBRARY_ADMIN: {
    code: "Library Admin",
    name: "Library Administration",
    dot: "bg-sky-500",
    badgeLight: "bg-sky-100 text-sky-950 border-sky-300",
    badgeDark: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  },
  SPECIAL_COLLECTIONS: {
    code: "Special Collections",
    name: "Special Collections",
    dot: "bg-fuchsia-500",
    badgeLight: "bg-fuchsia-100 text-fuchsia-950 border-fuchsia-300",
    badgeDark: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40",
  },
  GENERAL_REFERENCE: {
    code: "General Reference",
    name: "General Reference Section",
    dot: "bg-cyan-500",
    badgeLight: "bg-cyan-100 text-cyan-950 border-cyan-300",
    badgeDark: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  },
  PERIODICAL: {
    code: "Periodical",
    name: "Periodicals Section",
    dot: "bg-violet-500",
    badgeLight: "bg-violet-100 text-violet-950 border-violet-300",
    badgeDark: "bg-violet-500/20 text-violet-300 border-violet-500/40",
  },
  GENERAL: {
    code: "General",
    name: "General Library",
    dot: "bg-slate-400",
    badgeLight: "bg-slate-100 text-slate-800 border-slate-300",
    badgeDark: "bg-white/10 text-slate-300 border-white/20",
  },
};

export function resolveDepartment(rawDept?: string): {
  key: string;
  config: DepartmentStyle;
  displayCode: string;
  fullName: string;
} {
  const norm = (rawDept || "").toUpperCase().trim();

  if (!norm || norm === "NONE" || norm === "N/A" || norm === "GENERAL") {
    return {
      key: "GENERAL",
      config: DEPARTMENT_CONFIGS.GENERAL,
      displayCode: rawDept || "General",
      fullName: "General",
    };
  }

  // 1. CICT (Red)
  if (
    norm.includes("CICT") ||
    norm.includes("INFORMATION TECHNOLOGY") ||
    norm.includes("COMPUTER SCIENCE") ||
    norm.includes("INFO TECH") ||
    norm.includes("COMP SCI") ||
    norm.includes("BSIT") ||
    norm.includes("BSCS") ||
    norm.includes("BSIS") ||
    norm.includes("ACT")
  ) {
    return {
      key: "CICT",
      config: DEPARTMENT_CONFIGS.CICT,
      displayCode: "CICT",
      fullName: "College of Information & Communications Technology (CICT)",
    };
  }

  // 2. COE (Orange)
  if (
    norm.includes("COE") ||
    norm.includes("ENGINEERING") ||
    norm.includes("BSCPE") ||
    norm.includes("BSCE") ||
    norm.includes("BSEE") ||
    norm.includes("BSECE") ||
    norm.includes("BSME")
  ) {
    return {
      key: "COE",
      config: DEPARTMENT_CONFIGS.COE,
      displayCode: "COE",
      fullName: "College of Engineering (COE)",
    };
  }

  // 3. CBMA (Yellow / Amber)
  if (
    norm.includes("CBMA") ||
    norm.includes("CBA") ||
    norm.includes("BUSINESS") ||
    norm.includes("ACCOUNTAN") ||
    norm.includes("MANAGEMENT ACCOUNT") ||
    norm.includes("ENTREPRENEUR") ||
    norm.includes("BSBA") ||
    norm.includes("BSA") ||
    norm.includes("BSMA")
  ) {
    return {
      key: "CBMA",
      config: DEPARTMENT_CONFIGS.CBMA,
      displayCode: "CBMA",
      fullName: "College of Business Management & Accountancy (CBMA)",
    };
  }

  // 4. CAS (Green)
  if (
    norm.includes("CAS") ||
    norm.includes("ARTS & SCIENCES") ||
    norm.includes("ARTS AND SCIENCES") ||
    norm.includes("COMMUNICATION") ||
    norm.includes("PSYCHOLOGY") ||
    norm.includes("POLITICAL SCIENCE") ||
    norm.includes("BIOLOGY")
  ) {
    return {
      key: "CAS",
      config: DEPARTMENT_CONFIGS.CAS,
      displayCode: "CAS",
      fullName: "College of Arts & Sciences (CAS)",
    };
  }

  // 5. CED (Blue)
  if (
    norm.includes("CED") ||
    norm.includes("EDUCATION") ||
    norm.includes("TEACHER") ||
    norm.includes("BSED") ||
    norm.includes("BEED")
  ) {
    return {
      key: "CED",
      config: DEPARTMENT_CONFIGS.CED,
      displayCode: "CED",
      fullName: "College of Education (CED)",
    };
  }

  // 6. CHTM (Pink)
  if (
    norm.includes("CHTM") ||
    norm.includes("HOSPITALITY") ||
    norm.includes("TOURISM") ||
    norm.includes("HOTEL") ||
    norm.includes("HRM") ||
    norm.includes("BSTM") ||
    norm.includes("BSHM")
  ) {
    return {
      key: "CHTM",
      config: DEPARTMENT_CONFIGS.CHTM,
      displayCode: "CHTM",
      fullName: "College of Hospitality & Tourism Management (CHTM)",
    };
  }

  // 7. CCJE (Purple)
  if (
    norm.includes("CCJE") ||
    norm.includes("CRIMIN") ||
    norm.includes("JUSTICE") ||
    norm.includes("BSCRIM")
  ) {
    return {
      key: "CCJE",
      config: DEPARTMENT_CONFIGS.CCJE,
      displayCode: "CCJE",
      fullName: "College of Criminal Justice Education (CCJE)",
    };
  }

  // Library & Admin Departments
  if (norm.includes("SYSTEM ADMIN")) {
    return {
      key: "SYSTEM_ADMIN",
      config: DEPARTMENT_CONFIGS.SYSTEM_ADMIN,
      displayCode: "System Admin",
      fullName: "System Administration",
    };
  }

  if (norm.includes("LIBRARY ADMIN")) {
    return {
      key: "LIBRARY_ADMIN",
      config: DEPARTMENT_CONFIGS.LIBRARY_ADMIN,
      displayCode: "Library Admin",
      fullName: "Library Administration",
    };
  }

  if (norm.includes("CIRCULATION")) {
    return {
      key: "CIRCULATION",
      config: DEPARTMENT_CONFIGS.CIRCULATION,
      displayCode: "Circulation",
      fullName: "Circulation Section",
    };
  }

  if (norm.includes("SPECIAL COLLECTION")) {
    return {
      key: "SPECIAL_COLLECTIONS",
      config: DEPARTMENT_CONFIGS.SPECIAL_COLLECTIONS,
      displayCode: "Special Collections",
      fullName: "Special Collections",
    };
  }

  if (norm.includes("GENERAL REFERENCE")) {
    return {
      key: "GENERAL_REFERENCE",
      config: DEPARTMENT_CONFIGS.GENERAL_REFERENCE,
      displayCode: "General Reference",
      fullName: "General Reference",
    };
  }

  if (norm.includes("PERIODICAL")) {
    return {
      key: "PERIODICAL",
      config: DEPARTMENT_CONFIGS.PERIODICAL,
      displayCode: "Periodicals",
      fullName: "Periodicals Section",
    };
  }

  // Default fallback - keep rawDept text
  return {
    key: "GENERAL",
    config: DEPARTMENT_CONFIGS.GENERAL,
    displayCode: rawDept || "General",
    fullName: rawDept || "General",
  };
}

export function getDepartmentBadge(rawDept?: string, isLight: boolean = false) {
  const { config, displayCode, fullName } = resolveDepartment(rawDept);
  return {
    code: displayCode,
    fullName,
    dot: config.dot,
    badge: isLight ? config.badgeLight : config.badgeDark,
  };
}

export interface DepartmentBadgeProps {
  department?: string;
  isLight?: boolean;
  className?: string;
  showDot?: boolean;
  /** If true, uses short code (e.g. CICT); if false, uses raw text */
  shorten?: boolean;
}

export function DepartmentBadge({
  department,
  isLight,
  className,
  showDot = true,
  shorten = true,
}: DepartmentBadgeProps) {
  let resolvedIsLight = isLight;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const themeContext = useTheme();
    if (resolvedIsLight === undefined) {
      resolvedIsLight = themeContext.theme === "light";
    }
  } catch {
    if (resolvedIsLight === undefined) {
      resolvedIsLight = false;
    }
  }

  const { code, fullName, dot, badge } = getDepartmentBadge(department, resolvedIsLight);
  const text = shorten ? code : (department || code);

  return (
    <span
      title={fullName}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs sm:text-sm font-extrabold uppercase border shadow-xs tracking-wider transition-all",
        badge,
        className
      )}
    >
      {showDot && <span className={cn("h-2 w-2 rounded-full shrink-0 shadow-xs", dot)} />}
      <span>{text}</span>
    </span>
  );
}
