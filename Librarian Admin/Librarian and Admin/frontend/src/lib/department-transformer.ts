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

  const map: Record<string, number> = {};
  rawUsage.forEach((item) => {
    const name = String(item.key || item.department || item.code || "").toUpperCase();
    const count = Number(item.count ?? item.usage ?? item.total ?? 0);

    if (name.includes("CICT") || name.includes("INFORMATION")) map["CICT"] = (map["CICT"] || 0) + count;
    else if (name.includes("COE") || name.includes("ENGINEERING")) map["COE"] = (map["COE"] || 0) + count;
    else if (name.includes("CBMA") || name.includes("BUSINESS") || name.includes("ACCOUNTANCY")) map["CBMA"] = (map["CBMA"] || 0) + count;
    else if (name.includes("CAS") || name.includes("ARTS") || name.includes("SCIENCES")) map["CAS"] = (map["CAS"] || 0) + count;
    else if (name.includes("CED") || name.includes("EDUCATION")) map["CED"] = (map["CED"] || 0) + count;
    else if (name.includes("CHTM") || name.includes("HOSPITALITY") || name.includes("TOURISM")) map["CHTM"] = (map["CHTM"] || 0) + count;
    else if (name.includes("CCJE") || name.includes("CRIMINAL") || name.includes("JUSTICE")) map["CCJE"] = (map["CCJE"] || 0) + count;
  });

  return STANDARDIZED_DEPARTMENTS.map((dept) => ({
    ...dept,
    count: map[dept.code] ?? 0,
  }));
}
