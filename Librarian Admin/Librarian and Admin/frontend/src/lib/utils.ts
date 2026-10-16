import { BookRecord } from "@/lib/types";

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateOnly(dateStr?: string | Date | null): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) {
    if (Number.isNaN(dateStr.getTime())) return null;
    return { year: dateStr.getFullYear(), month: dateStr.getMonth(), day: dateStr.getDate() };
  }
  const str = String(dateStr).trim();
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      month: parseInt(isoMatch[2], 10) - 1,
      day: parseInt(isoMatch[3], 10),
    };
  }
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
    day: d.getDate(),
  };
}

export function isDueToReturn(dateStr?: string | Date | null): boolean {
  const parsed = parseDateOnly(dateStr);
  if (!parsed) return false;
  const now = new Date();
  const dueDayStart = new Date(parsed.year, parsed.month, parsed.day, 0, 0, 0, 0).getTime();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  return dueDayStart <= todayStart;
}

export function isDateOverdue(dateStr?: string | Date | null): boolean {
  const parsed = parseDateOnly(dateStr);
  if (!parsed) return false;
  const now = new Date();
  const dueDayStart = new Date(parsed.year, parsed.month, parsed.day, 0, 0, 0, 0).getTime();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  return dueDayStart < todayStart;
}

export function generateApaCitation(book: Partial<BookRecord>) {
  const publishedYear = new Date(book.publicationDate ?? "").getFullYear();
  const yearLabel = Number.isNaN(publishedYear) ? "n.d." : publishedYear;
  return `${book.author ?? "Unknown author"}. (${yearLabel}). ${book.title ?? "Untitled"}. STI West Negros University Library.`;
}

export function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  const headers = Object.keys(rows[0] ?? {});
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => `"${String(row[header] ?? "").replaceAll('"', '""')}"`)
        .join(","),
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function formatCourseShortcut(course?: string | null): string {
  if (!course) return "";
  const trimmed = course.trim();
  if (!trimmed) return "";

  const norm = trimmed.toUpperCase().replace(/\s+/g, " ");

  // Direct fast matches
  if (/^BSIT\b/.test(norm)) return "BSIT";
  if (/^BSCS\b/.test(norm)) return "BSCS";
  if (/^BSIS\b/.test(norm)) return "BSIS";
  if (/^ACT\b/.test(norm)) return "ACT";
  if (/^BSTM\b/.test(norm)) return "BSTM";
  if (/^BSHM\b/.test(norm)) return "BSHM";
  if (/^BSBA\b/.test(norm)) return "BSBA";
  if (/^BSA\b/.test(norm)) return "BSA";
  if (/^BSMA\b/.test(norm)) return "BSMA";
  if (/^BSAIS\b/.test(norm)) return "BSAIS";
  if (/^BSCRIM\b/.test(norm)) return "BSCRIM";
  if (/^BSCE\b/.test(norm)) return "BSCE";
  if (/^BSCPE\b/.test(norm)) return "BSCpE";
  if (/^BSECE\b/.test(norm)) return "BSECE";
  if (/^BSEE\b/.test(norm)) return "BSEE";
  if (/^BSME\b/.test(norm)) return "BSME";
  if (/^BSN\b/.test(norm)) return "BSN";
  if (/^BEED\b/.test(norm)) return "BEEd";
  if (/^BSED\b/.test(norm)) return "BSEd";
  if (/^SHS\b/.test(norm)) return "SHS";
  if (/^JHS\b/.test(norm)) return "JHS";

  // Phrase matching
  if (norm.includes("INFORMATION TECHNOLOGY") || norm.includes("INFO TECH")) return "BSIT";
  if (norm.includes("COMPUTER SCIENCE") || norm.includes("COMP SCI")) return "BSCS";
  if (norm.includes("INFORMATION SYSTEM")) return "BSIS";
  if (norm.includes("ASSOCIATE IN COMPUTER")) return "ACT";
  if (norm.includes("TOURISM MANAGEMENT") || norm.includes("TOURISM")) return "BSTM";
  if (
    norm.includes("HOSPITALITY MANAGEMENT") ||
    norm.includes("HOTEL") ||
    norm.includes("RESTAURANT MANAGEMENT") ||
    norm.includes("HRM")
  ) {
    return "BSHM";
  }
  if (norm.includes("BUSINESS ADMINISTRATION") || norm.includes("BUSINESS ADMIN")) return "BSBA";
  if (norm.includes("MANAGEMENT ACCOUNTING")) return "BSMA";
  if (norm.includes("ACCOUNTING INFORMATION")) return "BSAIS";
  if (norm.includes("ACCOUNTANCY") || norm.includes("ACCOUNTING")) return "BSA";
  if (norm.includes("CRIMINOLOGY") || norm.includes("CRIM")) return "BSCRIM";
  if (norm.includes("COMPUTER ENGINEERING")) return "BSCpE";
  if (norm.includes("CIVIL ENGINEERING")) return "BSCE";
  if (norm.includes("ELECTRONICS ENGINEERING")) return "BSECE";
  if (norm.includes("ELECTRICAL ENGINEERING")) return "BSEE";
  if (norm.includes("MECHANICAL ENGINEERING")) return "BSME";
  if (norm.includes("NURSING")) return "BSN";
  if (norm.includes("ELEMENTARY EDUCATION")) return "BEEd";
  if (norm.includes("SECONDARY EDUCATION")) return "BSEd";
  if (norm.includes("SENIOR HIGH")) return "SHS";
  if (norm.includes("JUNIOR HIGH")) return "JHS";
  if (norm.includes("GENERAL PROGRAM")) return "GEN";

  // If already short (e.g. CICT, CBA, COE, CHTM, CAS)
  if (trimmed.length <= 6 && !trimmed.includes(" ")) {
    return trimmed.toUpperCase();
  }

  // Handle generic "BS in [X]" or "Bachelor of Science in [X]"
  const bsMatch = trimmed.match(/(?:Bachelor\s+of\s+Science\s+in|BS\s+in|BS)\s+([A-Za-z\s]+)/i);
  if (bsMatch && bsMatch[1]) {
    const words = bsMatch[1]
      .trim()
      .split(/\s+/)
      .filter((w) => !["in", "of", "and", "&", "the"].includes(w.toLowerCase()));
    if (words.length > 0) {
      return "BS" + words.map((w) => w[0].toUpperCase()).join("");
    }
  }

  return trimmed;
}
