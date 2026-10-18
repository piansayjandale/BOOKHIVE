export interface DepartmentData {
  code: string;
  mascot: string;
  count: number;
  color: string;
}

export const STANDARDIZED_DEPARTMENTS: DepartmentData[] = [
  { code: "CICT", mascot: "Red Sentinels", count: 0, color: "#EF4444" },
  { code: "COE", mascot: "Orange Erudites", count: 0, color: "#FF6B00" },
  { code: "CBMA", mascot: "Yellow Tycoons", count: 0, color: "#EAB308" },
  { code: "CAS", mascot: "Green Titans", count: 0, color: "#10B981" },
  { code: "CED", mascot: "Blue Guardians", count: 0, color: "#3B82F6" },
  { code: "CHTM", mascot: "Pink Vikings", count: 0, color: "#EC4899" },
  { code: "CCJE", mascot: "Purple Wizards", count: 0, color: "#8B5CF6" },
];

export function transformDepartmentData(rawUsage?: any[]): DepartmentData[] {
  if (!rawUsage || rawUsage.length === 0) {
    return STANDARDIZED_DEPARTMENTS.map((dept) => ({ ...dept, count: 0 }));
  }

  const map: Record<string, number> = {
    CICT: 0,
    COE: 0,
    CBMA: 0,
    CAS: 0,
    CED: 0,
    CHTM: 0,
    CCJE: 0,
  };

  rawUsage.forEach((item) => {
    // If item already has a direct valid college code
    const directCode = String(item.code || item.key || "").trim().toUpperCase();
    const count = Number(item.count ?? item.usage ?? item.total ?? 0);
    if (directCode && map[directCode] !== undefined) {
      map[directCode] += count;
      return;
    }

    const name = `${String(item.key || "")} ${String(item.department || "")} ${String(item.course || "")} ${String(item.name || "")}`.toUpperCase();

    if (
      name.includes("CICT") ||
      name.includes("INFORMATION") ||
      name.includes("BSIT") ||
      name.includes("BSCS") ||
      name.includes("COMPUTER") ||
      name.includes("TECH") ||
      name.includes("SOFTWARE")
    ) {
      map["CICT"] += count;
    } else if (
      name.includes("COE") ||
      name.includes("ENGINEERING") ||
      name.includes("BSCE") ||
      name.includes("BSEE") ||
      name.includes("BSCPE") ||
      name.includes("BSME") ||
      name.includes("MARITIME")
    ) {
      map["COE"] += count;
    } else if (
      name.includes("CBMA") ||
      name.includes("BUSINESS") ||
      name.includes("ACCOUNTANCY") ||
      name.includes("ACCOUNTING") ||
      name.includes("BSA") ||
      name.includes("BSBA") ||
      name.includes("MANAGEMENT") ||
      name.includes("FINANCE") ||
      name.includes("MARKETING")
    ) {
      map["CBMA"] += count;
    } else if (
      name.includes("CAS") ||
      name.includes("ARTS") ||
      name.includes("SCIENCES") ||
      name.includes("BACOMM") ||
      name.includes("COMMUNICATION") ||
      name.includes("PSYCHOLOGY") ||
      name.includes("GENERAL") ||
      name.includes("WNU STI")
    ) {
      map["CAS"] += count;
    } else if (
      name.includes("CED") ||
      name.includes("EDUCATION") ||
      name.includes("TEACHER") ||
      name.includes("BSED") ||
      name.includes("BEED")
    ) {
      map["CED"] += count;
    } else if (
      name.includes("CHTM") ||
      name.includes("HOSPITALITY") ||
      name.includes("TOURISM") ||
      name.includes("BSTM") ||
      name.includes("BSHM") ||
      name.includes("HOTEL") ||
      name.includes("HRM") ||
      name.includes("CULINARY")
    ) {
      map["CHTM"] += count;
    } else if (
      name.includes("CCJE") ||
      name.includes("CRIMINAL") ||
      name.includes("JUSTICE") ||
      name.includes("CRIMINOLOGY") ||
      name.includes("BSCRIM")
    ) {
      map["CCJE"] += count;
    } else {
      map["CICT"] += count;
    }
  });

  return STANDARDIZED_DEPARTMENTS.map((dept) => ({
    ...dept,
    count: map[dept.code] ?? 0,
  }));
}
