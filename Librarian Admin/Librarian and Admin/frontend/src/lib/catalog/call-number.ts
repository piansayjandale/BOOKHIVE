/**
 * Library Call Number Generator & Curated System Genres
 * Formats standard academic Library of Congress (LC) / Dewey decimal call numbers
 * based on book Title, Author, Pub Date, Department, Genre, Volume, Edition, and Copies.
 */

export interface CallNumberInput {
  title?: string;
  author?: string;
  isbn?: string;
  publicationDate?: string;
  department?: string;
  genres?: string;
  volume?: string;
  edition?: string;
  copies?: number;
}

export function generateCallNumber({
  title = "",
  author = "",
  isbn = "",
  publicationDate = "",
  department = "Circulation",
  genres = "",
  volume = "",
  edition = "",
  copies = 1,
}: CallNumberInput): string {
  const cleanTitle = (title || "").trim();
  const cleanAuthor = (author || "").trim();
  const cleanGenre = (genres || "").toLowerCase().trim();
  const cleanDept = (department || "Circulation").trim();

  // 1. Classification Subject Prefix
  let classPrefix = "CIR 101.4";

  if (
    cleanGenre.includes("computer") ||
    cleanGenre.includes("tech") ||
    cleanGenre.includes("software") ||
    cleanGenre.includes("programming") ||
    cleanGenre.includes("data") ||
    cleanGenre.includes("ai") ||
    cleanGenre.includes("cyber") ||
    cleanGenre.includes("information")
  ) {
    classPrefix = "QA 76.73";
  } else if (
    cleanGenre.includes("fiction") ||
    cleanGenre.includes("novel") ||
    cleanGenre.includes("fantasy") ||
    cleanGenre.includes("sci-fi") ||
    cleanGenre.includes("science fiction") ||
    cleanGenre.includes("adventure") ||
    cleanGenre.includes("magic")
  ) {
    classPrefix = "PS 3566";
  } else if (
    cleanGenre.includes("business") ||
    cleanGenre.includes("management") ||
    cleanGenre.includes("finance") ||
    cleanGenre.includes("marketing") ||
    cleanGenre.includes("accounting") ||
    cleanGenre.includes("economics")
  ) {
    classPrefix = "HD 30.2";
  } else if (
    cleanGenre.includes("science") ||
    cleanGenre.includes("physics") ||
    cleanGenre.includes("chemistry") ||
    cleanGenre.includes("biology") ||
    cleanGenre.includes("nature")
  ) {
    classPrefix = "QC 21.3";
  } else if (
    cleanGenre.includes("history") ||
    cleanGenre.includes("biography") ||
    cleanGenre.includes("social") ||
    cleanGenre.includes("memoir")
  ) {
    classPrefix = "D 804";
  } else if (
    cleanGenre.includes("philosophy") ||
    cleanGenre.includes("psychology") ||
    cleanGenre.includes("self-help") ||
    cleanGenre.includes("counselling")
  ) {
    classPrefix = "BF 173";
  } else if (
    cleanGenre.includes("art") ||
    cleanGenre.includes("design") ||
    cleanGenre.includes("music") ||
    cleanGenre.includes("humanities")
  ) {
    classPrefix = "N 7430";
  } else if (
    cleanGenre.includes("cook") ||
    cleanGenre.includes("food") ||
    cleanGenre.includes("hospitality") ||
    cleanGenre.includes("tourism")
  ) {
    classPrefix = "TX 651";
  } else if (
    cleanGenre.includes("law") ||
    cleanGenre.includes("crime") ||
    cleanGenre.includes("criminal") ||
    cleanGenre.includes("criminology")
  ) {
    classPrefix = "K 3400";
  } else if (cleanDept.toLowerCase().includes("filipiniana")) {
    classPrefix = "FIL 899.2";
  } else if (cleanDept.toLowerCase().includes("reference")) {
    classPrefix = "REF 025.5";
  } else if (cleanDept.toLowerCase().includes("periodical")) {
    classPrefix = "PER 050";
  } else if (cleanDept.toLowerCase().includes("reserve")) {
    classPrefix = "RES 371.3";
  } else if (cleanDept.toLowerCase().includes("special")) {
    classPrefix = "SPE 090";
  } else {
    const deptPrefixMap: Record<string, string> = {
      Circulation: "CIR 101.4",
      "General Reference": "REF 025.5",
      Filipiniana: "FIL 899.2",
      Periodical: "PER 050",
      Periodicals: "PER 050",
      Reserve: "RES 371.3",
      "Special Collections": "SPE 090",
    };
    classPrefix = deptPrefixMap[cleanDept] || "CIR 101.4";
  }

  // 2. Author Cutter Number (e.g. .P98 or .P69)
  let authorCutter = ".A01";
  if (cleanAuthor) {
    const cleanAuthText = cleanAuthor.replace(/[^a-zA-Z\s]/g, " ").trim();
    const parts = cleanAuthText.split(/\s+/).filter(Boolean);
    const lastName = parts.length > 0 ? parts[parts.length - 1] : "Author";
    const initial = (lastName.charAt(0) || "A").toUpperCase();

    let hash = 0;
    for (let i = 0; i < lastName.length; i++) {
      hash = (hash * 31 + lastName.charCodeAt(i)) % 89;
    }
    const cutterDigits = String(10 + Math.abs(hash)).padStart(2, "0");
    authorCutter = `.${initial}${cutterDigits}`;
  }

  // 3. Title Workmark (first significant letter of title)
  let titleWorkmark = "";
  if (cleanTitle) {
    const strippedTitle = cleanTitle.replace(/^(a|an|the)\s+/i, "").trim();
    const firstChar = strippedTitle.charAt(0).toLowerCase();
    if (/[a-z]/i.test(firstChar)) {
      titleWorkmark = firstChar;
    }
  }

  // 4. Publication Year
  let yearStr = "2026";
  if (publicationDate) {
    const match = publicationDate.match(/\b(19\d\d|20\d\d)\b/);
    if (match) {
      yearStr = match[1];
    } else {
      yearStr = String(new Date().getFullYear());
    }
  } else {
    yearStr = String(new Date().getFullYear());
  }

  // 5. Build Parts
  const parts: string[] = [`${classPrefix} ${authorCutter}${titleWorkmark} ${yearStr}`];

  // Volume (omit if single volume / none or default)
  if (volume && volume !== "Single Volume / None") {
    const volNum = volume.replace(/[^0-9]/g, "");
    if (volNum) {
      parts.push(`v.${volNum}`);
    } else {
      parts.push("v.1");
    }
  }

  // Edition (omit if single edition / none or 1st edition)
  if (
    edition &&
    edition !== "Single Edition / None" &&
    !edition.toLowerCase().includes("1st")
  ) {
    const edNum = edition.replace(/[^0-9]/g, "");
    if (edNum) {
      parts.push(`ed.${edNum}`);
    } else if (edition.toLowerCase().includes("revised")) {
      parts.push("rev.ed");
    } else if (edition.toLowerCase().includes("special")) {
      parts.push("sp.ed");
    }
  }

  // Copies
  if (copies && copies > 1) {
    parts.push(`c.1`);
  }

  return parts.join(" ");
}

/**
 * Summarized, curated system genres list in alphabetical order (A-Z)
 */
export const ALL_SYSTEM_GENRES: string[] = [
  "Accounting & Finance",
  "Action & Adventure",
  "Architecture & Design",
  "Arts & Humanities",
  "Biography & Memoir",
  "Business & Management",
  "Children & Young Adult",
  "Classics",
  "Computer Science",
  "Crime & Mystery",
  "Cybersecurity & Networks",
  "Data Science & AI",
  "Economics",
  "Education & Teaching",
  "Engineering",
  "Fantasy & Sci-Fi",
  "Fiction & Literature",
  "Filipiniana",
  "General Reference",
  "Health & Medical Sciences",
  "History & Political Science",
  "Hospitality & Tourism",
  "Information Technology",
  "Law & Criminology",
  "Mathematics & Statistics",
  "Non-Fiction",
  "Periodicals & Journals",
  "Philosophy & Psychology",
  "Science & Nature",
  "Self-Help & Development",
  "Social Sciences",
  "Software Engineering",
  "Special Collections",
].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

export const VOLUME_OPTIONS: string[] = [
  "Single Volume / None",
  "Vol. 1",
  "Vol. 2",
  "Vol. 3",
  "Vol. 4",
  "Vol. 5",
  "Vol. 6",
  "Vol. 7",
  "Vol. 8",
  "Vol. 9",
  "Vol. 10",
];

export const EDITION_OPTIONS: string[] = [
  "Single Edition / None",
  "1st Edition",
  "2nd Edition",
  "3rd Edition",
  "4th Edition",
  "5th Edition",
  "6th Edition",
  "7th Edition",
  "8th Edition",
  "9th Edition",
  "10th Edition",
  "Revised Edition",
  "Special Edition",
];

export interface AccessionNumberInput {
  title?: string;
  author?: string;
  isbn?: string;
  publicationDate?: string;
  department?: string;
  copies?: number;
}

/**
 * Generate a unique library accession number (e.g. ACC-2026-00428)
 */
export function generateAccessionNumber({
  title = "",
  author = "",
  isbn = "",
  publicationDate = "",
  department = "Circulation",
  copies = 1,
}: AccessionNumberInput = {}): string {
  const year = publicationDate && publicationDate.length >= 4
    ? publicationDate.substring(0, 4)
    : new Date().getFullYear().toString();

  let seed = 0;
  const str = `${title}_${author}_${isbn}_${department}_${copies}`.trim();
  for (let i = 0; i < str.length; i++) {
    seed = (seed * 31 + str.charCodeAt(i)) % 89999;
  }
  if (seed === 0) {
    seed = 1000 + (title.length * 17 + author.length * 23) % 89000;
  }
  const seq = String(Math.abs(seed) + 1000).padStart(5, "0");

  return `ACC-${year}-${seq}`;
}
