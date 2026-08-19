export interface DepartmentData {
  code: string;
  mascot: string;
  count: number;
  color: string;
}

export const STANDARDIZED_DEPARTMENTS: DepartmentData[] = [
  { code: "CICT", mascot: "Red Sentinels", count: 12, color: "#EF4444" },
  { code: "COE", mascot: "Orange Erudites", count: 35, color: "#FF6B00" },
  { code: "CBMA", mascot: "Yellow Tycoons", count: 1, color: "#EAB308" },
  { code: "CAS", mascot: "Green Titans", count: 22, color: "#10B981" },
  { code: "CED", mascot: "Blue Guardians", count: 18, color: "#3B82F6" },
  { code: "CHTM", mascot: "Pink Vikings", count: 15, color: "#EC4899" },
  { code: "CCJE", mascot: "Purple Wizards", count: 12, color: "#8B5CF6" },
];

export function transformDepartmentData(rawUsage?: any[]): DepartmentData[] {
  if (!rawUsage || rawUsage.length === 0) {
    return STANDARDIZED_DEPARTMENTS;
  }

  const map: Record<string, number> = {};
  rawUsage.forEach((item) => {
    const name = String(item.key || item.department || item.code || "").toUpperCase();
    const count = Number(item.count ?? item.usage ?? item.total ?? 0);

    if (name.includes("CICT") || name.includes("INFORMATION")) map["CICT"] = count;
    else if (name.includes("COE") || name.includes("ENGINEERING")) map["COE"] = count;
    else if (name.includes("CBMA") || name.includes("BUSINESS") || name.includes("ACCOUNTANCY")) map["CBMA"] = count;
    else if (name.includes("CAS") || name.includes("ARTS") || name.includes("SCIENCES")) map["CAS"] = count;
    else if (name.includes("CED") || name.includes("EDUCATION")) map["CED"] = count;
    else if (name.includes("CHTM") || name.includes("HOSPITALITY") || name.includes("TOURISM")) map["CHTM"] = count;
    else if (name.includes("CCJE") || name.includes("CRIMINAL") || name.includes("JUSTICE")) map["CCJE"] = count;
  });

  return STANDARDIZED_DEPARTMENTS.map((dept) => ({
    ...dept,
    count: map[dept.code] !== undefined ? map[dept.code] : dept.count,
  }));
}
