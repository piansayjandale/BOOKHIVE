import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  Modal,
  Alert,
  Dimensions,
  TextInput,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import axios from "axios";
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import AnimatedScreen from "../components/AnimatedScreen";
import { useAuth } from "../data/AuthContext";
import { useThemeColors } from "../hooks/useThemeColors";
import { getLiveBooks, addDynamicBook, Book } from "../data/books";
import {
  embedCoverUriInRawText,
  stripEmbeddedCoverUri,
  registerUploadedBookCover,
} from "../data/bookCovers";
import { BookCoverImage } from "../components/BookCoverImage";
import { API_URL, apiClient, authService } from "../data/authService";
import {
  resolveReceiptQrPayload,
  markTransactionPickedUp,
  ReceiptData,
  isDueToReturn,
} from "../data/store";

const { width, height } = Dimensions.get("window");

// Web System Tokens: Modern Aesthetic & Efficient Color Palettes
const LIGHT_THEME = {
  primary: "#0284C7", // Modern Sapphire Blue for primary focus & active states
  primaryDark: "#0369A1",
  primarySoft: "rgba(2, 132, 199, 0.08)",
  primaryLine: "#E2E8F0", // Clean Slate-200 border for surface separation
  accent: "#F59E0B", // Refined Amber Gold for warm highlights
  accentStrong: "#D97706",
  accentSoft: "rgba(245, 158, 11, 0.12)",
  bg: "#F8FAFC", // Clean Slate-50 background
  panel: "#FFFFFF", // Crisp white surface
  panelStrong: "#0F172A", // Viewfinder bezel (deep slate for cinematic focus)
  cardBg: "#FFFFFF",
  textPrimary: "#0F172A", // High-contrast Slate-900
  textDark: "#1E293B",
  muted: "#64748B", // Slate-500 secondary text
  successBg: "rgba(16, 185, 129, 0.12)",
  successText: "#059669",
  dangerBg: "rgba(239, 68, 68, 0.10)",
  dangerText: "#DC2626",
  danger: "#EF4444",
  modalOverlay: "rgba(15, 23, 42, 0.65)",
  inputBg: "#F8FAFC",
  webTapBg: "rgba(15, 23, 42, 0.82)",
  iconNeutral: "#475569",
  iconNeutralBg: "#F1F5F9",
  iconNeutralBorder: "#E2E8F0",
  shutterBorder: "rgba(2, 132, 199, 0.28)",
  shutterInner: "#0284C7",
  shutterDot: "#FFFFFF",
};

const DARK_THEME = {
  primary: "#38BDF8", // Luminous Sky Cyan in dark mode
  primaryDark: "#0284C7",
  primarySoft: "rgba(56, 189, 248, 0.14)",
  primaryLine: "rgba(255, 255, 255, 0.08)",
  accent: "#FBBF24", // Warm gold
  accentStrong: "#F59E0B",
  accentSoft: "rgba(251, 191, 36, 0.14)",
  bg: "#080D1A", // Deep obsidian navy
  panel: "#0F172A", // Slate-900 surface
  panelStrong: "#030712", // Deep black viewfinder bezel
  cardBg: "#111C30",
  textPrimary: "#F8FAFC", // Slate-50
  textDark: "#F1F5F9",
  muted: "#94A3B8", // Slate-400
  successBg: "rgba(16, 185, 129, 0.2)",
  successText: "#34D399",
  dangerBg: "rgba(239, 68, 68, 0.2)",
  dangerText: "#F87171",
  danger: "#EF4444",
  modalOverlay: "rgba(0, 0, 0, 0.82)",
  inputBg: "#0B1329",
  webTapBg: "rgba(8, 13, 26, 0.85)",
  iconNeutral: "#94A3B8",
  iconNeutralBg: "#1E293B",
  iconNeutralBorder: "rgba(255, 255, 255, 0.08)",
  shutterBorder: "rgba(56, 189, 248, 0.32)",
  shutterInner: "#38BDF8",
  shutterDot: "#080D1A",
};

export type ParsedBookFields = {
  title: string;
  author: string;
  genre: string;
  department?: string;
  isbn: string;
  copies: number;
  edition: string;
  volume: string;
  series?: string;
  price?: number | string;
  accessionNumber?: string;
  publicationDate?: string;
  summary: string;
  publisher?: string;
  publishedYear?: string;
  pages?: string;
  shelfLocation?: string;
  docType?: string;
  rawText: string;
};

/**
 * Helper to disambiguate easily confused handwriting strokes in numeric fields
 */
function disambiguateDigits(str: string): string {
  if (!str) return "";
  return str
    .replace(/[Oo]/g, "0")
    .replace(/[Il|]/g, "1")
    .replace(/[Ss]/g, "5")
    .replace(/[Bb]/g, "8")
    .replace(/[Zz]/g, "2");
}

function cleanField(str: string): string {
  if (!str) return "";
  return str
    .replace(/^[:;=~—\-_|/\\«"'\`\s]+/, "")
    .replace(/[:;=~—\-_|/\\»"'\`\s]+$/, "")
    .trim();
}

/**
 * Format string in Title Case while preserving acronyms and lowercase conjunctions
 */
function toTitleCase(str: string): string {
  if (!str) return "";
  const minorWords = new Set(["a", "an", "the", "and", "but", "or", "for", "nor", "on", "at", "to", "from", "by", "in", "of", "with"]);
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s'.&\-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (index === 0 || !minorWords.has(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word.toLowerCase();
    })
    .join(" ");
}

function parseCopiesNumber(str: string): number {
  if (!str) return 1;
  const clean = str.trim();
  const stripped = clean.replace(/[^a-zA-Z0-9]/g, "");
  if (/^(?:[Zz]|ll|7s|2s|2)$/i.test(stripped) || /^gps$/i.test(stripped)) return 2;
  const disambiguated = disambiguateDigits(clean);
  const match = disambiguated.match(/(\d+)/);
  if (match) {
    const val = parseInt(match[1], 10);
    return val > 0 && val < 500 ? val : 1;
  }
  return 1;
}

function parseEdition(str: string): string {
  if (!str) return "None";
  const clean = cleanField(str);
  if (/\b(?:none|n\/a|na|nil|no|ioh|eeli)\b/i.test(clean) || clean === "|" || clean === "-" || /^(?:ioh|none)$/i.test(clean)) return "None";
  if (/\b(?:1st|first|dst|ast|ist|15t|jst)\b/i.test(clean)) return "1st";
  if (/\b(?:2nd|second)\b/i.test(clean)) return "2nd";
  if (/\b(?:3rd|third)\b/i.test(clean)) return "3rd";
  if (/\b(?:4th|fourth)\b/i.test(clean)) return "4th";
  if (/\b(?:5th|fifth)\b/i.test(clean)) return "5th";
  if (/\b(?:rev(?:ised)?)\b/i.test(clean)) return "Revised Edition";
  return clean || "None";
}

function parseVolume(str: string): string {
  if (!str) return "None";
  const clean = cleanField(str);
  if (/\b(?:none|n\/a|na|nil|no|ole|volur)\b/i.test(clean) || clean === "|" || clean === "-" || /^(?:ole|none)$/i.test(clean)) return "None";
  const disambiguated = disambiguateDigits(clean);
  const match = disambiguated.match(/(\d+)/);
  if (match) return match[1];
  return clean || "None";
}

function normalizeHandwritingTitle(rawTitle: string): string {
  const title = cleanField(rawTitle);
  return toTitleCase(title);
}

function normalizeHandwritingAuthor(rawAuthor: string): string {
  const author = cleanField(rawAuthor);
  return toTitleCase(author);
}

function normalizeHandwritingGenre(rawGenre: string, department?: string): string {
  let genre = cleanField(rawGenre);
  const cleanAlpha = genre.replace(/[^a-zA-Z]/g, "").toLowerCase();
  if (/^(?:icrion|ticrion|fiction|fic|fict|fixtion|fixt|r\s*ciel\s*eg|ciel)$/i.test(cleanAlpha)) {
    return "Fiction";
  }
  if (/^(?:non-?fiction|nonfic|nonfiction)$/i.test(cleanAlpha)) {
    return "Non-Fiction";
  }
  if (/^(?:sci-?fi|science\s*fiction)$/i.test(cleanAlpha)) {
    return "Science Fiction";
  }
  if (/^(?:ref|reference)$/i.test(cleanAlpha)) {
    return "Reference";
  }
  if (/^(?:fil|filipiniana)$/i.test(cleanAlpha)) {
    return "Filipiniana";
  }
  if (/^(?:bio|biography|memoir|autobiography)$/i.test(cleanAlpha)) {
    return "Biography / Memoir";
  }
  if (/^(?:history|historical)$/i.test(cleanAlpha)) {
    return "History";
  }
  if (/^(?:tech|technology|computer|cs|it)$/i.test(cleanAlpha)) {
    return "Technology";
  }
  if (!genre && department) return department === "Circulation" ? "Fiction" : department;
  return toTitleCase(genre || (department === "Circulation" ? "Fiction" : "General"));
}

function normalizeHandwritingSummary(rawSummary: string): string {
  let s = cleanField(rawSummary);
  s = s.replace(/^([AI])([A-Z][a-z]+)/, "$1 $2");
  return s;
}

function sanitizeIsbn(val?: string | null): string {
  if (!val) return "";
  return String(val)
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}

function extractIsbn(text: string): string {
  if (!text) return "";
  const explicitMatch = text.match(/(?:ISBN|SPIN|1SBN|IS8N|ISPN|SBN)(?:-1[03])?:?\s*([0-9Xx\s\-OoIl|]{6,30})/i);
  if (explicitMatch && explicitMatch[1]) {
    const rawVal = explicitMatch[1];
    const disambiguated = sanitizeIsbn(
      rawVal
        .replace(/[Oo]/g, "0")
        .replace(/[Il|]/g, "1")
        .replace(/[^0-9Xx-]/g, "")
    );
    if (disambiguated.replace(/-/g, "").length >= 8) {
      return disambiguated;
    }
  }
  const isbn13Match = text.match(/\b(97[89][\s\-]*(?:[0-9OoIl|][\s\-]*){10})\b/i);
  if (isbn13Match && isbn13Match[1]) {
    const clean = isbn13Match[1]
      .replace(/[Oo]/g, "0")
      .replace(/[Il|]/g, "1")
      .replace(/[^0-9Xx]/g, "");
    if (clean.length === 13) return sanitizeIsbn(clean);
  }
  const isbn10Match = text.match(/\b((?:[0-9OoIl|][\s\-]*){9}[0-9XxOoIl|])\b/i);
  if (isbn10Match && isbn10Match[1]) {
    const clean = isbn10Match[1]
      .replace(/[Oo]/g, "0")
      .replace(/[Il|]/g, "1")
      .replace(/[^0-9Xx]/g, "");
    if (clean.length === 10) return sanitizeIsbn(clean);
  }
  return "";
}

function extractPublishedYear(text: string): string {
  if (!text) return "";

  // 1. Explicit line with prefix: Pub Date, Published Year, Date, Copyright, Year, etc.
  const prefixRegex = /(?:(?:published\s*(?:year|date)?|publication\s*(?:year|date)?|pub\.?\s*(?:date|year)?|copyright\s*(?:year|date)?|date\s*of\s*pub(?:lication)?|year\s*(?:of\s*publication)?|copr\.?|date|year)[\s:;*=\-–—!?,.]*(?:in|c|©)?\s*)([^\r\n]+)/i;
  const match = text.match(prefixRegex);
  if (match && match[1]) {
    const val = match[1].trim();
    // 4-digit year directly: 1950 - 2035
    const fourDigit = val.match(/\b(19\d\d|20[0-3]\d)\b/);
    if (fourDigit) return fourDigit[1];

    // Date formatted as M/D/YY or M/D/YYYY (e.g. 3/29/26, 03/29/2026, 2026-03-29)
    const slashDate = val.match(/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.](19\d\d|20[0-3]\d|\d{2})\b/);
    if (slashDate) {
      const yr = slashDate[1];
      return yr.length === 2 ? `20${yr}` : yr;
    }

    const isoDate = val.match(/\b(19\d\d|20[0-3]\d)[\/\-.]\d{1,2}[\/\-.]\d{1,2}\b/);
    if (isoDate) return isoDate[1];

    // 2-digit year after label (e.g. '26 or 24 or 26)
    const twoDigit = val.match(/(?:^|['\s])([0-3]\d)\b/);
    if (twoDigit) return `20${twoDigit[1]}`;
  }

  // 2. Date pattern anywhere in text: e.g. 3/29/26, 10/12/2024
  const generalDate = text.match(/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.](19\d\d|20[0-3]\d|\d{2})\b/);
  if (generalDate) {
    const yr = generalDate[1];
    return yr.length === 2 ? `20${yr}` : yr;
  }

  // 3. Copyright symbol: © 2024 or (c) 2024
  const copyMatch = text.match(/[©c]\s*(19\d\d|20[0-3]\d|\d{2})/i);
  if (copyMatch) {
    const yr = copyMatch[1];
    return yr.length === 2 ? `20${yr}` : yr;
  }

  // 4. Standalone 4-digit plausible year
  const standaloneMatch = text.match(/\b(19[5-9]\d|20[0-3]\d)\b/);
  if (standaloneMatch) return standaloneMatch[1];

  return "";
}

function extractPages(text: string): string {
  if (!text) return "";
  const m = text.match(/(?:(?:pages|page|pp\.?|p\.)[\s:;*=\-–—!?,.]*(\d{1,5}))|\b(\d{2,5})\s*(?:pages|pp\.?|p\b)/i);
  if (m) return m[1] || m[2] || "";
  return "";
}

function extractPublisher(text: string): string {
  if (!text) return "";
  const explicit = text.match(/(?:(?:publisher|published\s*by|imprint)[\s:;*=\-–—!?,.]{1,4})([^\r\n]+)/i);
  if (explicit && explicit[1]) {
    const cleaned = cleanField(explicit[1].split(/[\n,;]/)[0]);
    if (cleaned && !/^(?:date|year|yr)\b/i.test(cleaned)) {
      return toTitleCase(cleaned);
    }
  }
  const KNOWN_PUBLISHERS = [
    "Penguin", "HarperCollins", "Simon & Schuster", "Macmillan", "Hachette",
    "O'Reilly", "Pearson", "McGraw-Hill", "Wiley", "Oxford University Press",
    "Cambridge University Press", "MIT Press", "Routledge", "Scribner",
    "Avery", "Vintage", "Anchor", "STI Academic Press", "Cengage", "Addison-Wesley"
  ];
  for (const pub of KNOWN_PUBLISHERS) {
    const reg = new RegExp(`\\b${pub.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}(?:\\s*(?:Books|Press|Media|Publishing|Publishers))?\\b`, "i");
    const found = text.match(reg);
    if (found) return toTitleCase(found[0]);
  }
  return "";
}

function extractCallNumber(text: string): string {
  if (!text) return "";
  const callMatch = text.match(/\b([A-Z]{2,4}[-\s]?\d{1,4}(?:\.[A-Z0-9]+)?(?:\s*\.[A-Z]\d+)?)\b/);
  if (callMatch && !/^(?:ISBN|PAGE|COPY|VOL)/i.test(callMatch[1])) {
    return callMatch[1].trim();
  }
  return "";
}

/**
 * Universal client-side parser to extract all catalog items from ANY scanned words on paper or printed text.
 * Robust against varied handwriting, cursive, stroke misreads, book covers, and unlabeled formats.
 */
export function extractBookFieldsFromText(text: string): ParsedBookFields {
  if (!text) {
    return {
      title: "",
      author: "",
      genre: "General",
      department: "Circulation",
      isbn: "",
      copies: 1,
      edition: "1st",
      volume: "1",
      series: "None",
      price: "450.00",
      accessionNumber: "ACC-2026-41191",
      publicationDate: "2026-09-01",
      summary: "",
      publisher: "",
      publishedYear: "",
      pages: "",
      shelfLocation: "",
      docType: "Unknown Document",
      rawText: "",
    };
  }

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  let title = "";
  let author = "";
  let genre = "";
  let department = "";
  let isbn = "";
  let copies = 1;
  let edition = "1st";
  let volume = "1";
  let series = "";
  let price = "";
  let accessionNumber = "";
  let publicationDate = "";
  let summary = "";
  let publisher = "";
  let publishedYear = "";
  let pages = "";
  let shelfLocation = "";
  let docType = "General Document";

  let summaryLines: string[] = [];
  let isCollectingSummary = false;
  let detectedLabels = 0;

  // Pass 1: Labeled field detection with OCR prefixes
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Title
    if (!title && /^(?:(?:book\s*)?title|tite|tile|ttle|titie|tltle|heading|name\s*of\s*book)[\s:;*=\-–—!?,.]{1,4}(.*)/i.test(line)) {
      const match = line.match(/^(?:(?:book\s*)?title|tite|tile|ttle|titie|tltle|heading|name\s*of\s*book)[\s:;*=\-–—!?,.]{1,4}(.*)/i);
      if (match) {
        title = normalizeHandwritingTitle(match[1]);
        detectedLabels++;
      }
      continue;
    }

    // 2. Author
    if (!author && /^(?:author(?:s)?|auton|autrer|autor|authr|aulhor|written\s*by|by|writer|auth|avior|aver)[\s:;*=\-–—!?,.]{1,4}(.*)/i.test(line)) {
      const match = line.match(/^(?:author(?:s)?|auton|autrer|autor|authr|aulhor|written\s*by|by|writer|auth|avior|aver)[\s:;*=\-–—!?,.]{1,4}(.*)/i);
      if (match) {
        author = normalizeHandwritingAuthor(match[1]);
        detectedLabels++;
      }
      continue;
    }

    // Department Loc.
    if (!department && /^(?:department(?:\s*loc(?:ation|\.)?)?|dept\.?(?:\s*loc(?:ation|\.)?)?|deputies|departim|section)[\s:;*=\-–—!?,.]{1,4}(.*)/i.test(line)) {
      const match = line.match(/^(?:department(?:\s*loc(?:ation|\.)?)?|dept\.?(?:\s*loc(?:ation|\.)?)?|deputies|departim|section)[\s:;*=\-–—!?,.]{1,4}(.*)/i);
      if (match) {
        const val = cleanField(match[1]);
        if (/circ/i.test(val)) department = "Circulation";
        else if (/ref/i.test(val)) department = "General Reference";
        else if (/fil/i.test(val)) department = "Filipiniana";
        else if (/res/i.test(val)) department = "Reserve";
        else if (/per/i.test(val)) department = "Periodical";
        else if (/spec/i.test(val)) department = "Special Collections";
        else department = toTitleCase(val);
        detectedLabels++;
      }
      continue;
    }

    // 3. Genre
    if (!genre && /^(?:genre|gere|gynt|genet|genrc|geype|category|subject|field|class|topic)[\s:;*=\-–—!?,.]{1,4}(.*)/i.test(line)) {
      const match = line.match(/^(?:genre|gere|gynt|genet|genrc|geype|category|subject|field|class|topic)[\s:;*=\-–—!?,.]{1,4}(.*)/i);
      if (match) {
        genre = normalizeHandwritingGenre(match[1], department);
        detectedLabels++;
      }
      continue;
    }

    // 4. ISBN
    if (!isbn && /^(?:isbn(?:-1[03])?|tsbn|tsen|tseng|tseh|t5bn|torn|tspn|spin|1sbn|is8n|ispn|sbn|barcode|tah|bar\s*code|acc(?:ession)?(?:\s*no)?)[\s:;*=\-–—!?,.]{1,4}(.*)/i.test(line)) {
      const match = line.match(/^(?:isbn(?:-1[03])?|tsbn|tsen|tseng|tseh|t5bn|torn|tspn|spin|1sbn|is8n|ispn|sbn|barcode|tah|bar\s*code|acc(?:ession)?(?:\s*no)?)[\s:;*=\-–—!?,.]{1,4}(.*)/i);
      if (match) {
        const rawIsbn = match[1];
        const clean = sanitizeIsbn(
          rawIsbn
            .replace(/[Oo]/g, "0")
            .replace(/[Il|\)\]]/g, "1")
            .replace(/[Zz]/g, "2")
            .replace(/[Ss]/g, "5")
            .replace(/[Pp]/g, "6")
            .replace(/[^0-9Xx-]/g, "")
        );
        if (clean.replace(/-/g, "").length >= 7) isbn = clean;
        detectedLabels++;
      }
      continue;
    }

    // 5. Copies
    if (/^(?:copies|copied|copi|gopi|gopies|\(opis|\(pies|coots|cope|gps|no\.?\s*copies|no\.?\s*of\s*copies|quantity|qty|stock|count|pieces|pcs)[\s:;*=\-–—!?+.,]*(.*)/i.test(line)) {
      const match = line.match(/^(?:copies|copied|copi|gopi|gopies|\(opis|\(pies|coots|cope|gps|no\.?\s*copies|no\.?\s*of\s*copies|quantity|qty|stock|count|pieces|pcs)[\s:;*=\-–—!?+.,]*(.*)/i);
      copies = parseCopiesNumber(match ? match[1] : line);
      detectedLabels++;
      continue;
    }

    // 6. Edition
    if (/^(?:edition|editon|edtion|hition|eitioy|eit|itor|ed\.?|edn|eeli|elion|ecli)[\s:;*=\-–—!?+.,]*(.*)/i.test(line)) {
      const match = line.match(/^(?:edition|editon|edtion|hition|eitioy|eit|itor|ed\.?|edn|eeli|elion|ecli)[\s:;*=\-–—!?+.,]*(.*)/i);
      if (match) {
        edition = parseEdition(match[1]);
        detectedLabels++;
      }
      continue;
    }

    // 7. Volume
    if (/^(?:volume|volurwe|volwwe|volum|\\olume|vol\.?|volur|vol\s*ime|\\\/|bk|book|part|pt)[\s:;*=\-–—!?+.,]*(.*)/i.test(line)) {
      const match = line.match(/^(?:volume|volurwe|volwwe|volum|\\olume|vol\.?|volur|vol\s*ime|\\\/|bk|book|part|pt)[\s:;*=\-–—!?+.,]*(.*)/i);
      if (match) {
        volume = parseVolume(match[1]);
        detectedLabels++;
      }
      continue;
    }

    // Published Year / Pub Date (Checked BEFORE Publisher so "Pub. Date" is never misparsed as Publisher)
    if (!publishedYear && /^(?:published\s*(?:year|date)?|publication\s*(?:year|date)?|pub\.?\s*year|pub\.?\s*date|pub\.?\s*yr|year|copyright\s*(?:year|date)?|date\s*of\s*pub(?:lication)?)[\s:;*=\-–—!?,.]{1,4}(.*)/i.test(line)) {
      const match = line.match(/^(?:published\s*(?:year|date)?|publication\s*(?:year|date)?|pub\.?\s*year|pub\.?\s*date|pub\.?\s*yr|year|copyright\s*(?:year|date)?|date\s*of\s*pub(?:lication)?)[\s:;*=\-–—!?,.]{1,4}(.*)/i);
      if (match) {
        publishedYear = extractPublishedYear(match[0]);
        if (!publishedYear && match[1]) publishedYear = extractPublishedYear(match[1]);
        detectedLabels++;
      }
      continue;
    }

    // Publisher
    if (!publisher && /^(?:publisher|published\s*by|pub(?:\b|\.)(?![\s.:;\-]*date|[\s.:;\-]*year|[\s.:;\-]*yr)|publishing(?:\s*house)?|imprint|press)[\s:;*=\-–—!?,.]{1,4}(.*)/i.test(line)) {
      const match = line.match(/^(?:publisher|published\s*by|pub(?:\b|\.)(?![\s.:;\-]*date|[\s.:;\-]*year|[\s.:;\-]*yr)|publishing(?:\s*house)?|imprint|press)[\s:;*=\-–—!?,.]{1,4}(.*)/i);
      if (match) {
        const candidatePub = cleanField(match[1]);
        if (candidatePub && !/^(?:date|year|yr)\b/i.test(candidatePub)) {
          publisher = toTitleCase(candidatePub);
          detectedLabels++;
        } else if (candidatePub && !publishedYear) {
          publishedYear = extractPublishedYear(candidatePub);
        }
      }
      continue;
    }

    // Shelf / Call Number
    if (!shelfLocation && /^(?:shelf(?:\s*location)?|call(?:\s*number|\s*no\.?)?|loc\.?|location|rack)[\s:;*=\-–—!?,.]{1,4}(.*)/i.test(line)) {
      const match = line.match(/^(?:shelf(?:\s*location)?|call(?:\s*number|\s*no\.?)?|loc\.?|location|rack)[\s:;*=\-–—!?,.]{1,4}(.*)/i);
      if (match) {
        shelfLocation = cleanField(match[1]);
        detectedLabels++;
      }
      continue;
    }

    // Series
    if (!series && /^(?:series(?:\s*name|\s*title)?|saga|trilogy)[\s:;*=\-–—!?,.]{1,4}(.*)/i.test(line)) {
      const match = line.match(/^(?:series(?:\s*name|\s*title)?|saga|trilogy)[\s:;*=\-–—!?,.]{1,4}(.*)/i);
      if (match) {
        series = cleanField(match[1]);
        detectedLabels++;
      }
      continue;
    }

    // Accession Number
    if (!accessionNumber && /^(?:accession(?:\s*no\.?|\s*number)?|acc\.?\s*(?:no\.?|num)?)[\s:;*=\-–—!?,.]{1,4}(.*)/i.test(line)) {
      const match = line.match(/^(?:accession(?:\s*no\.?|\s*number)?|acc\.?\s*(?:no\.?|num)?)[\s:;*=\-–—!?,.]{1,4}(.*)/i);
      if (match) {
        accessionNumber = cleanField(match[1]).toUpperCase();
        detectedLabels++;
      }
      continue;
    }

    // Price
    if (!price && /^(?:price|cost|amount|php|₱)[\s:;*=\-–—!?,.]{1,4}(.*)/i.test(line)) {
      const match = line.match(/^(?:price|cost|amount|php|₱)[\s:;*=\-–—!?,.]{1,4}(.*)/i);
      if (match) {
        price = cleanField(match[1]).replace(/[^0-9.]/g, "");
        detectedLabels++;
      }
      continue;
    }

    // Pages
    if (!pages && /^(?:pages|page\s*count|pp\.?|no\.?\s*of\s*pages)[\s:;*=\-–—!?,.]{1,4}(.*)/i.test(line)) {
      const match = line.match(/^(?:pages|page\s*count|pp\.?|no\.?\s*of\s*pages)[\s:;*=\-–—!?,.]{1,4}(.*)/i);
      if (match) {
        pages = cleanField(match[1]).replace(/[^0-9]/g, "");
        detectedLabels++;
      }
      continue;
    }

    // 8. Summary
    if (!summary && /^(?:summary(?:s)?|summ?\s*rary|sum\s*mary|sum\s*many|sum\s*ray|summer|suvrany|synopsis|description|desc|abstract|overview|plot|about|lommar|notes?)[\s:;*=\-–—!?,.]{1,4}(.*)/i.test(line)) {
      const match = line.match(/^(?:summary(?:s)?|summ?\s*rary|sum\s*mary|sum\s*many|sum\s*ray|summer|suvrany|synopsis|description|desc|abstract|overview|plot|about|lommar|notes?)[\s:;*=\-–—!?,.]{1,4}(.*)/i);
      if (match) {
        const cleanedPart = cleanField(match[1]);
        if (cleanedPart) summaryLines.push(cleanedPart);
        isCollectingSummary = true;
        detectedLabels++;
      }
      continue;
    }

    if (isCollectingSummary) {
      summaryLines.push(line);
    }
  }

  // Multi-line summary continuation
  if (summaryLines.length > 0) {
    summary = normalizeHandwritingSummary(summaryLines.join(" "));
  }

  // Global details extraction from full text if not found yet
  if (!isbn) isbn = extractIsbn(text);
  if (!publishedYear) publishedYear = extractPublishedYear(text);
  if (!pages) pages = extractPages(text);
  if (!publisher) publisher = extractPublisher(text);
  if (!shelfLocation) shelfLocation = extractCallNumber(text);

  // Document Type Classification
  if (detectedLabels >= 3) {
    docType = "Handwritten Intake Slip";
  } else if (/copyright\s*©|all\s*rights\s*reserved|cataloging-in-publication|printed\s*in/i.test(text)) {
    docType = "Printed Title / Copyright Page";
  } else if (/\b(?:new\s*york\s*times|bestseller|a\s*novel|international\s*bestseller)\b/i.test(text) || (!title && lines.length <= 6)) {
    docType = "Printed Book Cover";
  } else if (/\b(?:call\s*no|accession|dewey|cutter)\b/i.test(text)) {
    docType = "Library Catalog Slip";
  } else {
    docType = "General Scanned Document";
  }

  // Pass 2: Unlabeled / printed text fallback
  if (!title || !author) {
    const MARKETING_NOISE = /^(?:#?1\s*new\s*york\s*times\s*bestseller|new\s*york\s*times\s*bestseller|international\s*bestseller|national\s*bestseller|the\s*runaway\s*bestseller|a\s*novel|a\s*memoir|major\s*motion\s*picture|winner\s*of|pulitzer\s*prize|foreword\s*by|introduction\s*by|with\s*a\s*new\s*afterword)$/i;
    const isLabel = (l: string) => /^(?:title|author|genre|isbn|copies|edition|volume|summary|publisher|year|pages|shelf)[\s:;*=\-–—!?,.]/i.test(l);
    const isCallNumber = (l: string) => /^[A-Z]{1,4}\s*\d{1,4}(?:\.[A-Z0-9]+)?(?:\s+[A-Z0-9.]+)*$/i.test(l.trim());
    const isPublisherLine = (l: string) => {
      if (publisher && l.toLowerCase().includes(publisher.toLowerCase())) return true;
      return /\b(?:press|publishing|publishers|books|house|media|imprint)\b/i.test(l);
    };
    const isPureDigitsOrMetrics = (l: string) => /^\d+[\s\w.]*$/i.test(l.trim()) || /\b\d{1,4}\s*(?:pages|pp|p\.?)\b/i.test(l) || /^\d{4}$/.test(l.trim());
    const isSubtitle = (l: string) => {
      const words = l.trim().split(/\s+/);
      if (words.length >= 5) return true;
      return /^(?:an?\s|the\s|how\s|why\s|guide|handbook|manual|principles|introduction|stories|essays)/i.test(l) && words.length > 3;
    };

    const candidates = lines.filter(l => {
      if (isLabel(l)) return false;
      if (isCallNumber(l)) return false;
      if (MARKETING_NOISE.test(l.trim())) return false;
      if (isbn && l.includes(isbn)) return false;
      if (/^isbn/i.test(l)) return false;
      if (isPureDigitsOrMetrics(l)) return false;
      if (isPublisherLine(l)) return false;
      return true;
    });

    if (!title && candidates.length > 0) {
      const nonAuthorLines = candidates.filter(l => !/^(?:by|written\s*by)\s+/i.test(l) && !isSubtitle(l));
      if (nonAuthorLines.length > 0) {
        title = toTitleCase(cleanField(nonAuthorLines[0]));
      } else {
        title = toTitleCase(cleanField(candidates[0]));
      }
    }

    if (!author && candidates.length > 0) {
      const byLine = candidates.find(l => /^(?:by|written\s*by)\s+/i.test(l));
      if (byLine) {
        author = toTitleCase(cleanField(byLine.replace(/^(?:by|written\s*by)\s+/i, "")));
      } else {
        const titleClean = (title || "").toLowerCase();
        const authorCandidate = candidates.find(c => {
          const cClean = cleanField(c).toLowerCase();
          if (cClean === titleClean) return false;
          if (isSubtitle(c)) return false;
          const words = c.trim().split(/\s+/);
          return words.length >= 1 && words.length <= 4;
        });
        if (authorCandidate) {
          author = toTitleCase(cleanField(authorCandidate));
        } else if (candidates.length > 1) {
          author = toTitleCase(cleanField(candidates[1]));
        }
      }
    }

    const subtitleLine = candidates.find(c => isSubtitle(c));
    if (subtitleLine && (!summary || summary.length > 60)) {
      summary = cleanField(subtitleLine);
    }
  }

  if (!genre) {
    if (department && department !== "Circulation") {
      genre = department;
    } else if (/\b(?:fiction|story|novel|tale|romance|mystery|thriller)\b/i.test(text)) {
      genre = "Fiction";
    } else if (/\b(?:algorithm|programming|software|computer|python|java|javascript|data|science)\b/i.test(text)) {
      genre = "Computer Science";
    } else if (/\b(?:history|war|century|civilization|historical)\b/i.test(text)) {
      genre = "History";
    } else if (/\b(?:business|finance|management|economy|marketing)\b/i.test(text)) {
      genre = "Business & Economics";
    } else {
      genre = "General Collection";
    }
  }

  if (!department) {
    if (/\bgeneral\s*reference\b|\breference\b/i.test(text) || /ref/i.test(genre)) department = "General Reference";
    else if (/\bfilipiniana\b/i.test(text) || /fil/i.test(genre)) department = "Filipiniana";
    else if (/\breserve\b/i.test(text)) department = "Reserve";
    else if (/\bperiodical\b/i.test(text)) department = "Periodical";
    else if (/\bspecial\s*collections?\b/i.test(text)) department = "Special Collections";
    else department = "Circulation";
  }

  return {
    title: title || "Untitled Scanned Book",
    author: author || "Unknown Author",
    genre,
    department,
    isbn: sanitizeIsbn(isbn),
    copies: copies || 1,
    edition: edition || "1st",
    volume: volume || "1",
    series: series || "None",
    price: price || "450.00",
    accessionNumber: accessionNumber || "ACC-2026-41191",
    publicationDate: publicationDate || (publishedYear ? `${publishedYear}-01-01` : "2026-09-01"),
    summary: summary || (text.length > 120 ? cleanField(text.slice(0, 220)) + "..." : ""),
    publisher: publisher || "",
    publishedYear: publishedYear || "",
    pages: pages || "",
    shelfLocation: shelfLocation || "Catalog Shelf (Pending Placement)",
    docType,
    rawText: text,
  };
}

export default function LibrarianScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout, updateUser } = useAuth();
  const { isDarkMode, toggleTheme } = useThemeColors();
  const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;
  const styles = useMemo(() => getStyles(theme, isDarkMode), [isDarkMode]);

  // Librarian Mobile Restrictions
  const perms = (user as any)?.permissions || {};
  const canCatalog = perms.mobileCatalog !== false;
  // Combined Student Information & Return module covers student card info, returns, reservations, and violations
  const canStudentPass =
    perms.mobileStudentPass !== false &&
    perms.mobileReturns !== false &&
    perms.mobileReservations !== false &&
    perms.mobileViolations !== false;
  const canReturns = canStudentPass;
  const canReservations = canStudentPass;
  const canViolations = canStudentPass;
  const canPickup = perms.mobilePickup !== false;
  // Manual keypad entry & gallery picking are unrestricted standard tools
  const canManualEntry = true;
  const canGallery = true;
  const allScanningRestricted = !canCatalog && !canStudentPass;

  // Primary mode is "Catalog" for scanning words on paper
  const [activeMode, setActiveMode] = useState<"Catalog" | "Transaction">(() => {
    if (!canCatalog && canStudentPass) return "Transaction";
    return "Catalog";
  });

  // Automatically adjust active mode if selected mode is restricted
  useEffect(() => {
    if (!canCatalog && activeMode === "Catalog" && canStudentPass) {
      setActiveMode("Transaction");
    } else if (!canStudentPass && activeMode === "Transaction" && canCatalog) {
      setActiveMode("Catalog");
    }
  }, [canCatalog, canStudentPass, activeMode]);

  // Camera settings
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const isCapturingRef = useRef(false);
  const [autoScanEnabled, setAutoScanEnabled] = useState(false);
  const autoScanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dedicated QR tracking & shutter scan refs for Student Info & Return
  const latestQrRef = useRef<{ data: string; timestamp: number } | null>(null);
  const isScanningQrRef = useRef(false);
  const qrResolveRef = useRef<((val: string | null) => void) | null>(null);
  const qrTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animated effects: Shutter flash & Laser sweep
  const flashAnim = useRef(new Animated.Value(0)).current;
  const laserAnim = useRef(new Animated.Value(0)).current;
  const shutterScale = useRef(new Animated.Value(1)).current;

  // Scanned Paper Details & Structured 8 Fields
  const [scannedPaperText, setScannedPaperText] = useState("");
  const [parsedFields, setParsedFields] = useState<ParsedBookFields>({
    title: "",
    author: "",
    genre: "General",
    department: "Circulation",
    isbn: "",
    copies: 1,
    edition: "1st",
    volume: "1",
    series: "None",
    price: "450.00",
    accessionNumber: "ACC-2026-41191",
    shelfLocation: "QA76.73 .P98 2026",
    publicationDate: "2026-09-01",
    summary: "",
    publisher: "",
    publishedYear: "2026",
    rawText: "",
  });

  // Recognition engine & confidence metrics
  const [ocrEngine, setOcrEngine] = useState<string>("ocr");
  const [ocrConfidence, setOcrConfidence] = useState<number>(92);

  // Captured / uploaded picture preview for 1-second scan display (locked to upright portrait)
  const [previewPhotoUri, setPreviewPhotoUri] = useState<string | null>(null);
  const [previewIsLandscape, setPreviewIsLandscape] = useState(false);
  const [viewfinderSize, setViewfinderSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Edit Mode toggle inside the modal
  const [isEditingFields, setIsEditingFields] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Matched Catalog Book
  const [matchedCatalogList, setMatchedCatalogList] = useState<Book[]>([]);
  const [scannedBook, setScannedBook] = useState<Book | null>(null);
  const [bookCoverPhoto, setBookCoverPhoto] = useState<string | null>(null);
  const [bookModalVisible, setBookModalVisible] = useState(false);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [scannedReceipt, setScannedReceipt] = useState<ReceiptData | null>(null);
  const [isPickingUp, setIsPickingUp] = useState(false);
  const [pickupSuccess, setPickupSuccess] = useState(false);

  // Manual input drawer
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState("");

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  // Start/stop laser scanning loop animation when processing
  useEffect(() => {
    if (processing) {
      laserAnim.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 500,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      laserAnim.stopAnimation();
      laserAnim.setValue(0);
    }
  }, [processing]);

  useFocusEffect(
    useCallback(() => {
      setIsCameraActive(true);
      setScanned(false);
      setProcessing(false);
      setProcessingStep("");
      latestQrRef.current = null;
      isScanningQrRef.current = false;
      if (qrTimeoutRef.current) {
        clearTimeout(qrTimeoutRef.current);
        qrTimeoutRef.current = null;
      }
      qrResolveRef.current = null;

      // Fetch fresh librarian permissions in background
      authService.fetchLibrarianPermissions?.().then((fresh) => {
        if (fresh && updateUser) {
          updateUser({ permissions: fresh });
        }
      }).catch(() => {});

      return () => {
        setIsCameraActive(false);
        setIsCameraReady(false);
        isScanningQrRef.current = false;
        if (qrTimeoutRef.current) {
          clearTimeout(qrTimeoutRef.current);
          qrTimeoutRef.current = null;
        }
        qrResolveRef.current = null;
      };
    }, [updateUser])
  );

  // Auto-scan steady hold: when the camera is held still over a book or paper in Catalog mode, auto-capture after 2.6s
  useEffect(() => {
    if (
      autoScanEnabled &&
      activeMode === "Catalog" &&
      isCameraActive &&
      isCameraReady &&
      !scanned &&
      !processing &&
      !bookModalVisible &&
      !receiptModalVisible &&
      !previewPhotoUri &&
      canCatalog
    ) {
      if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current);
      autoScanTimerRef.current = setTimeout(() => {
        if (!isCapturingRef.current && !processing && !scanned && !bookModalVisible) {
          handleShutterCapture();
        }
      }, 2600);
    } else {
      if (autoScanTimerRef.current) {
        clearTimeout(autoScanTimerRef.current);
        autoScanTimerRef.current = null;
      }
    }

    return () => {
      if (autoScanTimerRef.current) {
        clearTimeout(autoScanTimerRef.current);
        autoScanTimerRef.current = null;
      }
    };
  }, [
    autoScanEnabled,
    activeMode,
    isCameraActive,
    isCameraReady,
    scanned,
    processing,
    bookModalVisible,
    receiptModalVisible,
    previewPhotoUri,
    canCatalog,
  ]);

  const isReceiptPayload = (raw: string): boolean => {
    if (!raw) return false;
    const trimmed = raw.trim();
    if (trimmed.startsWith("RCP-") || /RCP-[A-Z0-9]+-\d+/i.test(trimmed)) return true;
    try {
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        const obj = JSON.parse(trimmed);
        if (
          obj.type === "BOOKHIVE_CIRCULATION_RECEIPT" ||
          obj.type === "PICKUP_PASS" ||
          obj.receiptNumber ||
          obj.token?.startsWith("BH-RCPT") ||
          (obj.studentId && (obj.bookTitle || obj.title || obj.isbn))
        ) {
          return true;
        }
      }
    } catch {}
    return false;
  };

  const handleReceiptScanned = async (rawQr: string) => {
    triggerShutterFlash();
    setProcessing(true);
    setProcessingStep("Resolving circulation receipt & borrow details...");
    setPickupSuccess(false);

    try {
      const resolved = await resolveReceiptQrPayload(rawQr);
      setScannedReceipt(resolved);
      setReceiptModalVisible(true);
    } catch (err: any) {
      console.warn("handleReceiptScanned error:", err?.message);
      Alert.alert(
        "Verification Notice",
        "Could not verify this circulation QR code. Please make sure the QR code is from an official BookHive loan receipt.",
        [{ text: "OK", onPress: () => setScanned(false) }]
      );
    } finally {
      setProcessing(false);
      setProcessingStep("");
    }
  };

  const handleConfirmPickup = async () => {
    if (!scannedReceipt) return;
    setIsPickingUp(true);

    try {
      const targetId = scannedReceipt.transactionId || scannedReceipt.receiptNumber;
      const success = await markTransactionPickedUp(targetId, scannedReceipt);

      if (success) {
        const formattedDate = new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });

        setScannedReceipt((prev) =>
          prev
            ? {
                ...prev,
                status: "Approved",
                isPickedUp: true,
                pickupDate: formattedDate,
              }
            : null
        );
        setPickupSuccess(true);

        const msg = `"${scannedReceipt.bookTitle}" has been marked as PICKED UP by ${scannedReceipt.studentName || "the student"}. Due return deadline is ${scannedReceipt.returnDate}.`;
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.alert(msg);
        } else {
          Alert.alert("Pick-up Confirmed", msg);
        }
      }
    } catch (err: any) {
      Alert.alert("Pick-up Notice", err?.message || "Could not complete pickup transaction.");
    } finally {
      setIsPickingUp(false);
    }
  };

  const handleCloseReceiptModal = () => {
    setReceiptModalVisible(false);
    setScannedReceipt(null);
    setPickupSuccess(false);
    setScanned(false);
  };

  const cleanScannedPayload = (data: string): string => {
    let payload = (data || "").trim();
    if (isReceiptPayload(payload)) {
      return payload;
    }
    if (payload.startsWith("http://") || payload.startsWith("https://")) {
      try {
        const parsedUrl = new URL(payload);
        const queryQr =
          parsedUrl.searchParams.get("qr") ||
          parsedUrl.searchParams.get("studentId") ||
          parsedUrl.searchParams.get("idNumber") ||
          parsedUrl.searchParams.get("id") ||
          parsedUrl.searchParams.get("isbn");
        if (queryQr) return queryQr.trim();

        const segments = parsedUrl.pathname.split("/").filter(Boolean);
        const verifyIdx = segments.findIndex(
          (s) => s === "verify" || s === "card-by-qr" || s === "qr" || s === "book" || s === "student"
        );
        if (verifyIdx !== -1 && segments[verifyIdx + 1]) {
          return decodeURIComponent(segments[verifyIdx + 1]).trim();
        }
        if (segments.length > 0) {
          return decodeURIComponent(segments[segments.length - 1]).trim();
        }
      } catch {
        const match = payload.match(/\/(?:verify|card-by-qr|qr|book|student)\/([^/?#]+)/i);
        if (match && match[1]) return decodeURIComponent(match[1]).trim();
      }
    }
    if (payload.startsWith("bookhive://student/")) {
      payload = payload.replace("bookhive://student/", "").trim();
    } else if (payload.startsWith("bookhive://")) {
      payload = payload.replace("bookhive://", "").trim();
    }
    try {
      if (payload.startsWith("{")) {
        const parsed = JSON.parse(payload);
        const idVal =
          parsed.qrCode ||
          parsed.qr ||
          parsed.idNumber ||
          parsed.studentId ||
          parsed.id ||
          parsed.isbn ||
          parsed.payload;
        if (idVal) return String(idVal).trim();
      }
    } catch {}
    return payload;
  };

  /**
   * QR Code and Barcode detection handler from live CameraView
   * Tracks visible QR payload in viewfinder without triggering premature navigation
   */
  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (!data || typeof data !== "string" || !data.trim()) return;
    const cleanData = data.trim();

    // Cache latest QR / Barcode visible in frame with current timestamp
    latestQrRef.current = {
      data: cleanData,
      timestamp: Date.now(),
    };

    if (activeMode === "Catalog") {
      // If in Catalog mode and a book barcode/ISBN was scanned:
      const cleanDigits = cleanData.replace(/[^0-9X]/gi, "");
      const isBookCode = cleanDigits.length === 10 || cleanDigits.length === 13 || cleanData.startsWith("ACC-") || cleanData.toUpperCase().includes("ISBN");
      if (isBookCode && !processing && !bookModalVisible) {
        applyParsedTextToModal(cleanData);
      }
      return;
    }

    // If librarian clicked the QR shutter icon and is actively awaiting detection:
    if (isScanningQrRef.current && qrResolveRef.current) {
      const resolve = qrResolveRef.current;
      qrResolveRef.current = null;
      if (qrTimeoutRef.current) {
        clearTimeout(qrTimeoutRef.current);
        qrTimeoutRef.current = null;
      }
      resolve(cleanData);
    }
  };

  /**
   * Scan Student QR Pass / Receipt when librarian clicks the QR shutter button
   * Displays the laser scanning animation across the QR reticle for at least 1 second
   */
  const handleScanQr = async () => {
    if (processing || isCapturingRef.current) return;

    if (!canStudentPass) {
      Alert.alert(
        "Feature Restricted",
        "Student Pass scanning has been restricted for your librarian account by the administrator."
      );
      return;
    }

    if (allScanningRestricted) {
      Alert.alert(
        "Access Restricted",
        "Scanning functionalities have been restricted for your librarian account by the administrator."
      );
      return;
    }

    // Trigger visual camera shutter flash & button scale animation
    triggerShutterFlash();
    Animated.sequence([
      Animated.timing(shutterScale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.timing(shutterScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();

    setProcessing(true);
    setProcessingStep("Scanning QR code...");
    isScanningQrRef.current = true;

    // Minimum 1-second scan animation so the librarian sees the laser line sweep across the reticle
    const minAnimationPromise = new Promise(resolve => setTimeout(resolve, 1000));

    // Detection promise: check if a QR is already in viewfinder or wait up to 3.5s
    const qrDetectionPromise = new Promise<string | null>((resolve) => {
      // If a QR code was detected in the frame within the last 60 seconds, use it immediately
      if (latestQrRef.current && Date.now() - latestQrRef.current.timestamp < 60000) {
        resolve(latestQrRef.current.data);
        return;
      }

      // Otherwise wait for onBarcodeScanned to detect one within 3.5 seconds
      qrResolveRef.current = resolve;
      qrTimeoutRef.current = setTimeout(() => {
        if (qrResolveRef.current) {
          qrResolveRef.current(null);
          qrResolveRef.current = null;
        }
      }, 3500);
    });

    try {
      const [detectedData] = await Promise.all([qrDetectionPromise, minAnimationPromise]);

      isScanningQrRef.current = false;
      qrResolveRef.current = null;
      if (qrTimeoutRef.current) {
        clearTimeout(qrTimeoutRef.current);
        qrTimeoutRef.current = null;
      }

      if (!detectedData) {
        setProcessing(false);
        setProcessingStep("");
        Alert.alert(
          "No QR Code Detected",
          "Could not detect a QR code inside the frame. Please align the Student ID or Receipt QR code and tap the QR button again.",
          [
            { text: "Try Again", style: "default" },
            { text: "Enter Manually", onPress: () => setShowManualInput(true) }
          ]
        );
        return;
      }

      const cleaned = cleanScannedPayload(detectedData);
      if (!cleaned || cleaned.trim().length < 3) {
        setProcessing(false);
        setProcessingStep("");
        Alert.alert(
          "Unrecognized QR Code",
          "The scanned QR code is not recognized as a valid BookHive student pass or receipt.",
          [{ text: "OK" }]
        );
        return;
      }

      setScanned(true);
      setProcessing(false);
      setProcessingStep("");

      if (isReceiptPayload(cleaned) || isReceiptPayload(detectedData)) {
        const payloadToUse = isReceiptPayload(detectedData) ? detectedData : cleaned;
        if (!canPickup) {
          Alert.alert("Feature Restricted", "Pick-up verification has been restricted for your account by the administrator.");
          return;
        }
        await handleReceiptScanned(payloadToUse);
        return;
      }

      // Valid Student Pass QR -> navigate to /scanned-card
      router.push({
        pathname: "/scanned-card",
        params: { qr: cleaned },
      });
    } catch (err: any) {
      isScanningQrRef.current = false;
      qrResolveRef.current = null;
      if (qrTimeoutRef.current) {
        clearTimeout(qrTimeoutRef.current);
        qrTimeoutRef.current = null;
      }
      setProcessing(false);
      setProcessingStep("");
      console.warn("QR scan error:", err?.message);
    }
  };

  /**
   * Shutter Press Effect: Visual Camera Flash + Haptic Animation
   */
  const triggerShutterFlash = () => {
    Animated.sequence([
      Animated.timing(flashAnim, {
        toValue: 1,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };

  /**
   * Launch high-definition device camera to snap a photo of paper document with tap-to-focus & zoom.
   * Unmounts in-app CameraView first so the Android camera sensor is completely released for the native camera.
   */
  const handleLaunchNativeCamera = async () => {
    if (!canCatalog) {
      Alert.alert(
        "Feature Restricted",
        "Document cataloging scanner has been restricted for your librarian account by the administrator."
      );
      return;
    }

    try {
      setProcessing(true);
      setProcessingStep("Opening high-definition camera...");

      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission Required", "Please allow camera access to scan paper documents.");
        setProcessing(false);
        setScanned(false);
        return;
      }

      // Step A: Temporarily unmount in-app CameraView to release hardware lock on Android
      setIsCameraActive(false);
      setIsCameraReady(false);

      // Brief delay to allow Android CameraX to complete unbindAll()
      await new Promise(r => setTimeout(r, 250));

      // Step B: Launch native system camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.9,
        base64: true,
      });

      // Step C: Re-enable in-app camera viewfinder
      setIsCameraActive(true);

      if (!result.canceled && result.assets && result.assets[0]) {
        triggerShutterFlash();
        const photoUri = result.assets[0].uri;
        let base64 = result.assets[0].base64;
        if (!base64 && photoUri) {
          try {
            base64 = await FileSystem.readAsStringAsync(photoUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          } catch (e) {}
        }

        if (base64) {
          await processPaperImageOcr(base64, photoUri);
          return;
        }
      }

      setProcessing(false);
      setScanned(false);
      setProcessingStep("");
    } catch (err: any) {
      setIsCameraActive(true);
      setProcessing(false);
      setScanned(false);
      setProcessingStep("");
    }
  };

  /**
   * Main Shutter Button Handler:
   * Captures image from viewfinder, with automatic native camera fallback.
   * Scans words with OCR, converts to text, and populates all 8 fields.
   */
  const handleShutterCapture = async () => {
    if (processing) return;

    if (activeMode === "Catalog" && !canCatalog) {
      Alert.alert(
        "Feature Restricted",
        "Paper document scanning has been restricted for your librarian account by the administrator."
      );
      return;
    }

    if (activeMode === "Transaction" && !canStudentPass) {
      Alert.alert(
        "Feature Restricted",
        "Student Pass scanning has been restricted for your librarian account by the administrator."
      );
      return;
    }

    if (isCapturingRef.current || processing) return;
    isCapturingRef.current = true;

    // Clear any pending steady-hold auto-scan timer
    if (autoScanTimerRef.current) {
      clearTimeout(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
    }

    // Button depress animation
    Animated.sequence([
      Animated.timing(shutterScale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.timing(shutterScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();

    // Trigger visual camera shutter flash
    triggerShutterFlash();

    if (activeMode === "Transaction") {
      isCapturingRef.current = false;
      await handleScanQr();
      return;
    }

    try {
      let capturedBase64: string | null = null;
      let capturedUri: string | null = null;
      let capturedIsSidewaysLandscape = false;

      // 1. Viewfinder camera capture
      // CRITICAL: We do NOT toggle processing state before takePictureAsync.
      // Keeping React props stable prevents native CameraX from unbinding use cases during capture.
      if (cameraRef.current && Platform.OS !== "web" && isCameraActive) {
        if (!isCameraReady) {
          await new Promise(r => setTimeout(r, 200));
        }

        let photo: any = null;
        try {
          photo = await cameraRef.current.takePictureAsync({
            quality: 0.8,
            base64: true,
            shutterSound: false,
          });
        } catch (firstCamErr: any) {
          console.warn("[Shutter Viewfinder First Attempt Notice]:", firstCamErr?.message);
          // Retry once after brief 150ms buffer clearance
          try {
            await new Promise(r => setTimeout(r, 150));
            if (cameraRef.current) {
              photo = await cameraRef.current.takePictureAsync({
                quality: 0.8,
                base64: true,
                shutterSound: false,
              });
            }
          } catch (retryErr: any) {
            console.warn("[Shutter Viewfinder Retry Notice]:", retryErr?.message);
          }
        }

        if (photo?.width && photo?.height && photo.width > photo.height) {
          capturedIsSidewaysLandscape = true;
        }

        if (photo?.base64) {
          capturedBase64 = photo.base64;
          capturedUri = photo.base64.startsWith("data:") ? photo.base64 : `data:image/jpeg;base64,${photo.base64}`;
        } else if (photo?.uri) {
          capturedUri = photo.uri;
          try {
            capturedBase64 = await FileSystem.readAsStringAsync(photo.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          } catch (readErr: any) {
            console.warn("[Shutter Read Base64 Notice]:", readErr?.message);
          }
        }
      }

      // 2. If image obtained, send directly to OCR
      if (capturedBase64) {
        isCapturingRef.current = false;
        setScanned(true);
        await processPaperImageOcr(capturedBase64, capturedUri, capturedIsSidewaysLandscape);
        return;
      }

      // Web environment fallback
      if (Platform.OS === "web") {
        isCapturingRef.current = false;
        await handlePickPaperPhoto();
        return;
      }

      // DO NOT redirect to phone camera here. Native camera is only triggered when clicking 'HD Camera'
      isCapturingRef.current = false;
      Alert.alert(
        "Capture Notice",
        "Could not capture from live viewfinder. Please hold steady and try again, or tap 'HD Camera' to use the full camera."
      );
      setProcessing(false);
      setScanned(false);
      setProcessingStep("");
    } catch (err: any) {
      isCapturingRef.current = false;
      setIsCameraActive(true);
      setProcessing(false);
      setScanned(false);
      setProcessingStep("");
    }
  };

  /**
   * Pick an image of the paper or document from device gallery
   */
  const handlePickPaperPhoto = async () => {
    if (!canGallery) {
      Alert.alert(
        "Feature Restricted",
        "Photo gallery upload has been restricted for your librarian account by the administrator."
      );
      return;
    }

    try {
      setProcessing(true);
      setProcessingStep("Selecting document from gallery...");

      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission Required", "Please allow photo library access to scan paper documents.");
        setProcessing(false);
        setScanned(false);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.9,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        triggerShutterFlash();
        const photoUri = result.assets[0].uri;
        let base64 = result.assets[0].base64;
        if (!base64 && photoUri) {
          try {
            base64 = await FileSystem.readAsStringAsync(photoUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          } catch (e) {}
        }

        if (base64) {
          await processPaperImageOcr(base64, photoUri, false);
          return;
        }
      }

      setProcessing(false);
      setScanned(false);
      setProcessingStep("");
    } catch (err: any) {
      setProcessing(false);
      setScanned(false);
      setProcessingStep("");
    }
  };

  /**
   * Process paper image via Backend Tesseract OCR with database catalog matching & 8-field extraction.
   * Displays the captured/uploaded photo in the viewfinder and scans it with animated laser line for at least 1 second.
   */
  const processPaperImageOcr = async (base64Data: string, previewUri?: string | null, isSidewaysLandscape = false) => {
    // Display captured or uploaded picture directly inside viewfinder (locked to portrait)
    const base64DataUri = base64Data
      ? base64Data.startsWith("data:")
        ? base64Data
        : `data:image/jpeg;base64,${base64Data}`
      : null;
    const previewToDisplay = previewUri || base64DataUri;
    setPreviewIsLandscape(Boolean(isSidewaysLandscape));
    if (previewToDisplay) {
      setPreviewPhotoUri(previewToDisplay);
    }
    if (base64DataUri) {
      setBookCoverPhoto(base64DataUri);
    }

    setProcessing(true);
    setProcessingStep("Scanning picture...");

    // User requirement: Scan the picture for 1 second that has been taken / uploaded
    const minScanTimer = new Promise(resolve => setTimeout(resolve, 1000));

    try {
      const url = `${API_URL}/api/student/ocr/scan-paper`;
      const ocrPromise = axios.post(
        url,
        { image: base64Data, orientationHint: isSidewaysLandscape ? 90 : 0 },
        { timeout: 35000 }
      );

      const [response] = await Promise.all([ocrPromise, minScanTimer]);

      if (response.data && response.data.success) {
        if (response.data.isQrCode && response.data.qrData) {
          const qrVal = String(response.data.qrData).trim();
          const isReceipt = isReceiptPayload(qrVal);

          // If in Transaction mode or an official circulation receipt, handle that:
          if (activeMode === "Transaction" || isReceipt) {
            setPreviewPhotoUri(null);
            setPreviewIsLandscape(false);
            setProcessing(false);
            setProcessingStep("");
            if (isReceipt) {
              await handleReceiptScanned(qrVal);
              return;
            } else {
              router.push({
                pathname: "/scanned-card",
                params: { qr: cleanScannedPayload(qrVal) },
              });
              return;
            }
          }

          // In Catalog mode, do NOT redirect away to student pass!
          // If the QR contains an ISBN or book text, use it to match/populate the book:
          const isbnMatch = qrVal.match(/(?:97[89][-\s]?)?[0-9]{9}[0-9Xx]/);
          if (isbnMatch) {
            response.data.parsedBook = {
              ...(response.data.parsedBook || {}),
              isbn: sanitizeIsbn(isbnMatch[0]),
            };
          }
        }

        const { scannedText, parsedBook, extracted, matchedBooks, exactMatch, engine, confidence } = response.data;
        const bookData = parsedBook || extracted;
        if (engine) setOcrEngine(engine);
        if (confidence) setOcrConfidence(confidence);
        const textOutput = scannedText || "";
        setScannedPaperText(textOutput);

        // Fallback or verify with client-side parser to guarantee all fields are complete
        const clientParsed = extractBookFieldsFromText(textOutput);
        const rawPub = (bookData?.publisher || clientParsed.publisher || "").trim();
        const cleanPub = /^(?:date|year|yr)\b/i.test(rawPub) ? "" : rawPub;
        const resolvedParsed: ParsedBookFields = {
          title: bookData?.title || clientParsed.title,
          author: bookData?.author || clientParsed.author,
          genre: bookData?.genre || clientParsed.genre,
          department: bookData?.department || clientParsed.department || "Circulation",
          isbn: sanitizeIsbn(bookData?.isbn || clientParsed.isbn),
          copies: bookData?.copies || clientParsed.copies,
          edition: bookData?.edition || clientParsed.edition,
          volume: bookData?.volume || clientParsed.volume,
          series: bookData?.series || clientParsed.series || "None",
          price: bookData?.price || clientParsed.price || "450.00",
          accessionNumber: bookData?.accessionNumber || clientParsed.accessionNumber || "ACC-2026-41191",
          publicationDate: bookData?.publicationDate || clientParsed.publicationDate || (bookData?.publishedYear ? `${bookData.publishedYear}-01-01` : "2026-09-01"),
          summary: bookData?.summary || clientParsed.summary,
          publisher: cleanPub || "Bloomsbury Publishing",
          publishedYear: bookData?.publishedYear || clientParsed.publishedYear || (rawPub && !cleanPub ? extractPublishedYear(rawPub) : "2026"),
          pages: bookData?.pages || clientParsed.pages,
          shelfLocation: bookData?.shelfLocation || clientParsed.shelfLocation || "QA76.73 .P98 2026",
          docType: bookData?.docType || clientParsed.docType,
          rawText: textOutput,
        };

        setParsedFields(resolvedParsed);
        setMatchedCatalogList(matchedBooks || []);

        if (exactMatch || (matchedBooks && matchedBooks.length > 0)) {
          const top = exactMatch || matchedBooks[0];
          setScannedBook({
            ...top,
            department: resolvedParsed.department || top.department || "Circulation",
            genre: resolvedParsed.genre || top.department,
            edition: resolvedParsed.edition || top.edition,
            volume: resolvedParsed.volume || top.volume,
            copies: resolvedParsed.copies || top.copies,
            shelfLocation: resolvedParsed.shelfLocation || top.shelfLocation || top.shelf,
            year: resolvedParsed.publishedYear || top.year,
            pages: resolvedParsed.pages ? parseInt(resolvedParsed.pages, 10) : top.pages,
          });
        } else {
          // Construct preview book with all extracted fields
          const fallbackBook: Book = {
            isbn: sanitizeIsbn(resolvedParsed.isbn) || `PAPER-${Date.now().toString().slice(-6)}`,
            title: resolvedParsed.title,
            author: resolvedParsed.author,
            department: resolvedParsed.department || "Circulation",
            genre: resolvedParsed.genre,
            edition: resolvedParsed.edition,
            volume: resolvedParsed.volume,
            copies: resolvedParsed.copies,
            availableCopies: resolvedParsed.copies,
            year: resolvedParsed.publishedYear,
            pages: resolvedParsed.pages ? parseInt(resolvedParsed.pages, 10) : undefined,
            shelf_location: resolvedParsed.shelfLocation || "Catalog Shelf (Pending Placement)",
            shelf: resolvedParsed.shelfLocation || "Catalog Shelf",
            description: resolvedParsed.summary || `Extracted from document.`,
            summary: resolvedParsed.summary,
            available: true,
          };
          setScannedBook(fallbackBook);
        }

        setIsEditingFields(false);
        setBookModalVisible(true);
      } else {
        throw new Error(response.data?.message || "Failed to process paper OCR.");
      }
    } catch (err: any) {
      console.warn("OCR API error, falling back to local text parser:", err?.message);
      // Client-side fallback: check if manual text was entered or open intake modal with fields to edit
      if (manualCode) {
        applyParsedTextToModal(manualCode);
      } else {
        // Open intake modal with editable fields so librarian can immediately view and enter details without camera loop
        applyParsedTextToModal("");
        Alert.alert(
          "Book Intake",
          "Could not automatically decipher text from the document. You can review and enter the book fields directly below.",
          [{ text: "OK" }]
        );
      }
    } finally {
      setPreviewPhotoUri(null);
      setPreviewIsLandscape(false);
      setProcessing(false);
      setProcessingStep("");
    }
  };

  /**
   * Apply raw text to modal using client-side parser
   */
  const applyParsedTextToModal = (text: string) => {
    setScannedPaperText(text);
    const parsed = extractBookFieldsFromText(text);
    setParsedFields(parsed);

    // Look for matching book in local collection
    const localBooks = getLiveBooks();
    const cleanTitle = parsed.title.toLowerCase();
    const cleanIsbn = parsed.isbn.toLowerCase();
    const found = localBooks.find(b =>
      (cleanIsbn && b.isbn && b.isbn.toLowerCase().includes(cleanIsbn)) ||
      (cleanTitle && b.title && b.title.toLowerCase().includes(cleanTitle))
    );

    if (found) {
      setScannedBook({
        ...found,
        department: parsed.department || found.department || "Circulation",
        genre: parsed.genre || found.department,
        edition: parsed.edition || found.edition,
        volume: parsed.volume || found.volume,
        copies: parsed.copies || found.copies,
      });
    } else {
      const fallbackBook: Book = {
        isbn: sanitizeIsbn(parsed.isbn) || `PAPER-${Date.now().toString().slice(-6)}`,
        title: parsed.title,
        author: parsed.author,
        department: parsed.department || "Circulation",
        genre: parsed.genre,
        edition: parsed.edition,
        volume: parsed.volume,
        copies: parsed.copies,
        availableCopies: parsed.copies,
        shelf_location: "Catalog Shelf",
        shelf: "Catalog Shelf",
        description: parsed.summary || "Scanned from paper document.",
        summary: parsed.summary,
        available: true,
      };
      setScannedBook(fallbackBook);
    }

    setIsEditingFields(false);
    setBookModalVisible(true);
  };

  /**
   * Process manual search or simulation chip
   */
  const processScanResult = async (code: string) => {
    const clean = (code || "").trim();
    if (!clean) {
      setScanned(false);
      return;
    }

    if (isReceiptPayload(clean)) {
      if (!canPickup) {
        Alert.alert(
          "Feature Restricted",
          "Pick-up verification and circulation receipt processing has been restricted for your librarian account by the administrator."
        );
        return;
      }
      await handleReceiptScanned(clean);
      return;
    }

    if (activeMode === "Transaction") {
      if (!canStudentPass) {
        Alert.alert(
          "Feature Restricted",
          "Student Information & Return scanning has been restricted for your librarian account by the administrator."
        );
        return;
      }
      router.push({
        pathname: "/scanned-card",
        params: { qr: clean },
      });
      return;
    }

    if (!canCatalog) {
      Alert.alert(
        "Feature Restricted",
        "Cataloging scanner has been restricted for your librarian account by the administrator."
      );
      return;
    }

    triggerShutterFlash();
    setProcessing(true);
    setProcessingStep("Parsing words & converting to structured book items...");

    try {
      const url = `${API_URL}/api/student/ocr/scan-paper`;
      const response = await axios.post(
        url,
        { text: clean },
        { timeout: 15000 }
      );

      if (response.data && response.data.success) {
        const { scannedText, parsedBook, matchedBooks, exactMatch, engine, confidence } = response.data;
        if (engine) setOcrEngine(engine);
        if (confidence) setOcrConfidence(confidence);
        const textOutput = scannedText || clean;
        setScannedPaperText(textOutput);

        const clientParsed = extractBookFieldsFromText(textOutput);
        const rawPub = (parsedBook?.publisher || clientParsed.publisher || "").trim();
        const cleanPub = /^(?:date|year|yr)\b/i.test(rawPub) ? "" : rawPub;
        const resolvedParsed: ParsedBookFields = {
          title: parsedBook?.title || clientParsed.title,
          author: parsedBook?.author || clientParsed.author,
          genre: parsedBook?.genre || clientParsed.genre,
          department: parsedBook?.department || clientParsed.department || "Circulation",
          isbn: sanitizeIsbn(parsedBook?.isbn || clientParsed.isbn),
          copies: parsedBook?.copies || clientParsed.copies,
          edition: parsedBook?.edition || clientParsed.edition,
          volume: parsedBook?.volume || clientParsed.volume,
          series: parsedBook?.series || clientParsed.series || "None",
          price: parsedBook?.price || clientParsed.price || "450.00",
          accessionNumber: parsedBook?.accessionNumber || clientParsed.accessionNumber || "ACC-2026-41191",
          publicationDate: parsedBook?.publicationDate || clientParsed.publicationDate || (parsedBook?.publishedYear ? `${parsedBook.publishedYear}-01-01` : "2026-09-01"),
          summary: parsedBook?.summary || clientParsed.summary,
          publisher: cleanPub || "Bloomsbury Publishing",
          publishedYear: parsedBook?.publishedYear || clientParsed.publishedYear || (rawPub && !cleanPub ? extractPublishedYear(rawPub) : "2026"),
          pages: parsedBook?.pages || clientParsed.pages,
          shelfLocation: parsedBook?.shelfLocation || clientParsed.shelfLocation || "QA76.73 .P98 2026",
          docType: parsedBook?.docType || clientParsed.docType,
          rawText: textOutput,
        };

        setParsedFields(resolvedParsed);
        setMatchedCatalogList(matchedBooks || []);

        if (exactMatch || (matchedBooks && matchedBooks.length > 0)) {
          const top = exactMatch || matchedBooks[0];
          setScannedBook({
            ...top,
            department: resolvedParsed.department || top.department || "Circulation",
            genre: resolvedParsed.genre || top.department,
            edition: resolvedParsed.edition || top.edition,
            volume: resolvedParsed.volume || top.volume,
            copies: resolvedParsed.copies || top.copies,
          });
        } else {
          applyParsedTextToModal(clean);
          return;
        }

        setIsEditingFields(false);
        setBookModalVisible(true);
        return;
      }
    } catch (e: any) {
      console.warn("Backend OCR endpoint unavailable, parsing client-side:", e?.message);
    } finally {
      setProcessing(false);
      setProcessingStep("");
    }

    applyParsedTextToModal(clean);
  };

  /**
   * Optional helper allowing librarian to capture or upload a real book cover image
   */
  const handlePickBookCoverPhoto = () => {
    Alert.alert(
      "Book Cover Photo",
      "Attach an optional cover picture for this scanned book:",
      [
        {
          text: "Take Photo (Camera)",
          onPress: async () => {
            try {
              const { granted } = await ImagePicker.requestCameraPermissionsAsync();
              if (!granted) {
                Alert.alert("Permission Required", "Camera permission is needed to take a book picture.");
                return;
              }
              const res = await ImagePicker.launchCameraAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [3, 4],
                quality: 0.5,
                base64: true,
              });
              if (!res.canceled && res.assets && res.assets[0]) {
                const asset = res.assets[0];
                const uriToUse = asset.base64
                  ? `data:image/jpeg;base64,${asset.base64}`
                  : asset.uri;
                if (uriToUse) setBookCoverPhoto(uriToUse);
              }
            } catch (err: any) {
              Alert.alert("Camera Error", err?.message || "Could not open camera.");
            }
          },
        },
        {
          text: "Choose from Gallery",
          onPress: async () => {
            try {
              const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!granted) {
                Alert.alert("Permission Required", "Gallery permission is needed to select a picture.");
                return;
              }
              const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [3, 4],
                quality: 0.5,
                base64: true,
              });
              if (!res.canceled && res.assets && res.assets[0]) {
                const asset = res.assets[0];
                const uriToUse = asset.base64
                  ? `data:image/jpeg;base64,${asset.base64}`
                  : asset.uri;
                if (uriToUse) setBookCoverPhoto(uriToUse);
              }
            } catch (err: any) {
              Alert.alert("Gallery Error", err?.message || "Could not pick image.");
            }
          },
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  };

  /**
   * Save / Add the scanned book to the library digitized intake queue for final cataloging check
   */
  const handleSaveToCatalog = async () => {
    if (!canCatalog) {
      Alert.alert(
        "Feature Restricted",
        "Adding new books to the catalog has been restricted for your librarian account by the administrator."
      );
      return;
    }

    if (!parsedFields.title) {
      Alert.alert("Missing Title", "Please provide a book title before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const cleanIsbnVal = sanitizeIsbn(parsedFields.isbn) || `SCAN-${Date.now().toString().slice(-6)}`;
      const rawTextWithCover = embedCoverUriInRawText(
        scannedPaperText || parsedFields.rawText || "",
        bookCoverPhoto
      );
      if (bookCoverPhoto) {
        registerUploadedBookCover({
          isbn: cleanIsbnVal,
          title: parsedFields.title,
          coverUri: bookCoverPhoto,
        });
      }

      const digitizedBookData = {
        isbn: cleanIsbnVal,
        title: parsedFields.title,
        author: parsedFields.author || "Unknown Author",
        genre: parsedFields.genre || "General",
        category: parsedFields.genre || "General",
        department: parsedFields.department || parsedFields.genre || "Circulation",
        coverImage: bookCoverPhoto || undefined,
        coverUrl: bookCoverPhoto || undefined,
        coverImg: bookCoverPhoto || undefined,
        image: bookCoverPhoto || undefined,
        copies: parsedFields.copies || 1,
        edition: parsedFields.edition || "1st Edition",
        volume: parsedFields.volume || "Vol. 1",
        series: parsedFields.series || "",
        price: parsedFields.price ? (typeof parsedFields.price === "string" ? parseFloat(parsedFields.price.replace(/,/g, "")) || 0 : parsedFields.price) : 0,
        accessionNumber: parsedFields.accessionNumber || "",
        shelfLocation: parsedFields.shelfLocation || "",
        callNumber: parsedFields.shelfLocation || "",
        summary: parsedFields.summary,
        description: parsedFields.summary,
        publisher: parsedFields.publisher || "",
        year: parsedFields.publishedYear || new Date().getFullYear().toString(),
        publicationDate: parsedFields.publicationDate || (parsedFields.publishedYear ? `${parsedFields.publishedYear}-01-01` : undefined),
        pages: parsedFields.pages || "1",
        docType: parsedFields.docType || "Catalog Intake Slip",
        ocrEngine: ocrEngine || "Tesseract Neural OCR",
        confidence: ocrConfidence || 95.0,
        rawText: rawTextWithCover,
        scannedBy: "Librarian Mobile App (Scanner)",
        status: "Pending Review",
        availability: "Available",
      };

      // Add to local live catalog feed immediately for mobile responsiveness
      addDynamicBook(digitizedBookData);

      // Post to backend Digitized Books intake queue
      const authHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (user?.token) {
        authHeaders.Authorization = `Bearer ${user.token}`;
      }

      let syncSuccess = false;
      try {
        await apiClient.post("/api/digitized-books", digitizedBookData, { headers: authHeaders, timeout: 8000 });
        syncSuccess = true;
      } catch (err: any) {
        try {
          await axios.post(`${API_URL}/api/digitized-books`, digitizedBookData, { headers: authHeaders, timeout: 8000 });
          syncSuccess = true;
        } catch (err2: any) {
          try {
            await axios.post(`${API_URL}/api/student/digitized-books`, digitizedBookData, { headers: authHeaders, timeout: 8000 });
            syncSuccess = true;
          } catch (err3: any) {
            try {
              await axios.post(`${API_URL}/api/admin/digitized-books`, digitizedBookData, { headers: authHeaders, timeout: 8000 });
              syncSuccess = true;
            } catch (err4: any) {
              console.warn("Backend digitized book sync deferred or offline:", err4?.message || err?.message);
            }
          }
        }
      }

      Alert.alert(
        "✓ Sent to Digitized Queue",
        `"${parsedFields.title}" has been successfully submitted to the Digitized tab for final cataloging review before officially adding it to the system!`,
        [
          {
            text: "Done",
            onPress: () => {
              setBookModalVisible(false);
              setScanned(false);
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert("Save Error", err?.message || "Failed to submit book to digitized queue.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === "web") {
      const confirmed = typeof window !== "undefined" && window.confirm
        ? window.confirm("Are you sure you want to log out of the librarian account?")
        : true;
      if (confirmed) {
        try {
          await logout();
        } catch (e) {
          console.warn("Logout error:", e);
        }
        router.replace("/login");
      }
      return;
    }

    Alert.alert("Librarian Logout", "Are you sure you want to log out of the librarian account?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
          } catch (e) {
            console.warn("Logout error:", e);
          }
          router.replace("/login");
        },
      },
    ]);
  };

  // Interpolated translateY for the laser scanning animation line
  const laserTranslateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 120],
  });

  return (
    <AnimatedScreen style={styles.screenRoot}>
      {/* SHUTTER FLASH OVERLAY (Flashes white when photo is snapped) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shutterFlashOverlay,
          {
            opacity: flashAnim,
          },
        ]}
      />

      {/* TOP HEADER: Modern Workstation Navigation Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <View style={styles.brandTitleRow}>
          <Ionicons
            name="book"
            size={18}
            color={theme.primary}
            style={{ marginRight: 5 }}
          />
          <Text style={styles.brandTitleText} numberOfLines={1}>BOOKHIVE</Text>
          <View style={styles.librarianBadgePill}>
            <View style={styles.activeDot} />
            <Text style={styles.librarianBadgeText}>Librarian</Text>
          </View>
        </View>

        <View style={styles.topBarIcons}>
          <TouchableOpacity
            style={[styles.iconHit, torchOn && styles.iconHitActiveTorch]}
            onPress={() => setTorchOn(prev => !prev)}
            accessibilityLabel="Toggle Torch"
            activeOpacity={0.7}
          >
            <Ionicons
              name={torchOn ? "flash" : "flash-outline"}
              size={16}
              color={torchOn ? "#F59E0B" : theme.iconNeutral}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconHit}
            onPress={() => setFacing(prev => (prev === "back" ? "front" : "back"))}
            accessibilityLabel="Switch Camera"
            activeOpacity={0.7}
          >
            <Ionicons name="camera-reverse-outline" size={17} color={theme.iconNeutral} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconHit}
            onPress={toggleTheme}
            accessibilityLabel="Toggle Theme"
            activeOpacity={0.7}
          >
            <Ionicons
              name={isDarkMode ? "sunny" : "moon-outline"}
              size={16}
              color={isDarkMode ? "#FBBF24" : theme.iconNeutral}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconHit, styles.logoutHit]}
            onPress={handleLogout}
            accessibilityLabel="Log out"
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={17} color={theme.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* UPPER VIEWPORT: Modern Cinematic Viewfinder with Document Alignment Reticle */}
      {/* ========================================================================= */}
      <View style={styles.scannerCardContainer}>
        <View
          style={styles.scannerGrayBox}
          onLayout={e => {
            const { width, height } = e.nativeEvent.layout;
            if (width > 0 && height > 0) {
              setViewfinderSize({ width, height });
            }
          }}
        >
          {/* Live Camera Viewfinder */}
          {Platform.OS !== "web" && isCameraActive ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={facing}
              enableTorch={torchOn}
              mode="picture"
              mute={true}
              animateShutter={false}
              barcodeScannerSettings={{
                barcodeTypes: ["qr", "ean13", "code128", "code39", "upc_a", "upc_e", "ean8", "pdf417", "aztec", "datamatrix"],
              }}
              onBarcodeScanned={handleBarCodeScanned}
              onCameraReady={() => setIsCameraReady(true)}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "#060A12", justifyContent: "center", alignItems: "center" }]}>
              {processing && <ActivityIndicator size="large" color={theme.accentStrong} />}
            </View>
          )}

          {/* Captured / Uploaded Picture Preview during 1-second scan (locked upright in portrait, never rotated to landscape) */}
          {previewPhotoUri && (
            <View style={[StyleSheet.absoluteFill, { justifyContent: "center", alignItems: "center", overflow: "hidden" }]} pointerEvents="none">
              <Image
                source={{ uri: previewPhotoUri }}
                style={
                  previewIsLandscape && viewfinderSize.width > 0 && viewfinderSize.height > 0
                    ? {
                        width: viewfinderSize.height,
                        height: viewfinderSize.width,
                        transform: [{ rotate: "90deg" }],
                      }
                    : StyleSheet.absoluteFill
                }
                resizeMode="cover"
              />
            </View>
          )}

          {/* ALL SCANNING RESTRICTED BANNER */}
          {allScanningRestricted && (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: isDarkMode ? "rgba(8, 13, 26, 0.96)" : "rgba(248, 250, 252, 0.97)",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: 24,
                  zIndex: 25,
                },
              ]}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: isDarkMode ? "rgba(239, 68, 68, 0.15)" : "#FEE2E2",
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <Ionicons name="lock-closed" size={32} color={theme.danger} />
              </View>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "bold",
                  color: theme.textPrimary,
                  textAlign: "center",
                  marginBottom: 8,
                }}
              >
                Scanner Functions Restricted
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: theme.muted,
                  textAlign: "center",
                  lineHeight: 19,
                  maxWidth: 290,
                }}
              >
                Paper Cataloging and Student Pass QR scanning have been restricted for your librarian account by the administrator.
              </Text>
            </View>
          )}

          {/* RETICLE OVERLAY */}
          <View style={activeMode === "Catalog" ? styles.paperReticleOverlay : styles.reticleOverlay} pointerEvents="none">
            {/* Top Reticle Tag */}
            <View style={styles.reticleBadgeBox}>
              <MaterialCommunityIcons
                name={activeMode === "Catalog" ? "text-box-search-outline" : "qrcode-scan"}
                size={14}
                color={theme.primary}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.reticleBadgeText}>
                {previewPhotoUri
                  ? "SCANNING PICTURE..."
                  : activeMode === "Catalog"
                  ? (autoScanEnabled ? "PAPER SCANNER • AUTO ON" : "PAPER & CATALOG SCANNER")
                  : (processing ? "SCANNING QR CODE..." : "STUDENT ID & RECEIPT SCANNER")}
              </Text>
            </View>

            {/* Glowing Corner Brackets */}
            <View style={[styles.cornerBracket, styles.bracketTopLeft]} />
            <View style={[styles.cornerBracket, styles.bracketTopRight]} />
            <View style={[styles.cornerBracket, styles.bracketBottomLeft]} />
            <View style={[styles.cornerBracket, styles.bracketBottomRight]} />

            {/* Animated Laser Scanning Line (Sweeps up/down when scanning words or QR code) */}
            {processing && (
              <Animated.View
                style={[
                  styles.animatedLaserLine,
                  {
                    transform: [{ translateY: laserTranslateY }],
                  },
                ]}
              />
            )}
          </View>

          {/* HINT PILL BELOW RETICLE */}
          <View style={styles.reticleGuidePill} pointerEvents="none">
            <Ionicons
              name={activeMode === "Catalog" ? "document-text-outline" : "qr-code-outline"}
              size={13}
              color={theme.primary}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.reticleGuideText}>
              {previewPhotoUri
                ? "Scanning picture for 1 second..."
                : (activeMode === "Catalog"
                    ? (autoScanEnabled
                        ? "Hold still to auto-scan, or tap shutter button"
                        : "Align printed or handwritten book details inside frame")
                    : (processing
                        ? "Reading QR code inside frame..."
                        : "Align Student ID or Receipt QR code & tap QR button"))}
            </Text>
          </View>

          {/* IN-FLIGHT WORD SCANNING HUD OVERLAY (Only shown for Paper Catalog OCR when not displaying photo preview) */}
          {processing && !previewPhotoUri && activeMode === "Catalog" && (
            <View style={styles.processingOverlay}>
              <View style={styles.hudCard}>
                <ActivityIndicator size="large" color={theme.accentStrong} />
                <Text style={styles.processingOverlayText}>
                  {processingStep || "Scanning words on paper..."}
                </Text>
                <Text style={styles.processingOverlaySub}>
                  Converting words to text & extracting catalog fields
                </Text>

                {/* Progress Indicators */}
                <View style={styles.hudPillRow}>
                  <View style={styles.hudPill}>
                    <Text style={styles.hudPillText}>Title</Text>
                  </View>
                  <View style={styles.hudPill}>
                    <Text style={styles.hudPillText}>Author</Text>
                  </View>
                  <View style={styles.hudPill}>
                    <Text style={styles.hudPillText}>Department Loc.</Text>
                  </View>
                  <View style={styles.hudPill}>
                    <Text style={styles.hudPillText}>Genre</Text>
                  </View>
                  <View style={styles.hudPill}>
                    <Text style={styles.hudPillText}>ISBN</Text>
                  </View>
                  <View style={styles.hudPill}>
                    <Text style={styles.hudPillText}>Copies</Text>
                  </View>
                  <View style={styles.hudPill}>
                    <Text style={styles.hudPillText}>Edition</Text>
                  </View>
                  <View style={styles.hudPill}>
                    <Text style={styles.hudPillText}>Volume</Text>
                  </View>
                  <View style={styles.hudPill}>
                    <Text style={styles.hudPillText}>Summary</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Web Demo Helper / Quick Simulators */}
          {Platform.OS === "web" && (
            <View style={styles.webSimulatorContainer}>
              <Text style={styles.webSimulatorTitle}>
                {activeMode === "Catalog" ? "Simulate Scanning Words on Paper:" : "Simulate Student QR Pass:"}
              </Text>
              <View style={styles.webChipsRow}>
                {/* 1. Official Receipt QR Code from Jan Dale Piansay (Ready for Pickup) */}
                <TouchableOpacity
                  style={[styles.webChip, { backgroundColor: isDarkMode ? "rgba(2, 132, 199, 0.15)" : "#F0F9FF", borderColor: "#0284C7" }]}
                  onPress={() =>
                    processScanResult(
                      JSON.stringify({
                        receiptNumber: "RCP-PROVED-5200",
                        type: "BOOKHIVE_CIRCULATION_RECEIPT",
                        title: "Modlitwa o deszcz",
                        bookTitle: "Modlitwa o deszcz",
                        author: "Wojciech Jagielski",
                        isbn: "9788374143318",
                        category: "Nonfiction",
                        shelf: "CIR-20B.8",
                        studentName: "Jan Dale Piansay",
                        studentId: "23-1653-705",
                        department: "CICT",
                        borrowDate: "2026-10-14 10:37 PM",
                        pickupDate: "Ready for Pickup",
                        returnDate: "2026-10-21",
                        status: "Approved",
                        isPickedUp: false,
                        token: "BH-RCPT-tx-decided-5200-approved",
                        verifiedBy: "BookHive Circulation Desk"
                      })
                    )
                  }
                >
                  <Text style={[styles.webChipText, { color: "#0284C7", fontWeight: "800" }]}>🧾 "Modlitwa o deszcz" (Ready for Pickup)</Text>
                </TouchableOpacity>

                {/* 2. Official Receipt QR Code simulation from User's Receipt Image */}
                <TouchableOpacity
                  style={[styles.webChip, { backgroundColor: isDarkMode ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5", borderColor: "#10B981" }]}
                  onPress={() =>
                    processScanResult(
                      JSON.stringify({
                        receiptNumber: "RCP-PROVED-2130",
                        type: "BOOKHIVE_CIRCULATION_RECEIPT",
                        title: "The Struggle",
                        isbn: "222-1234-162",
                        studentName: "Hi",
                        studentId: "23-1234-567",
                        department: "CHTM",
                        borrowDate: "2026-10-13 12:13 am",
                        pickupDate: "Ready for Pickup",
                        returnDate: "2026-10-20",
                        status: "Approved",
                        isPickedUp: false,
                        token: "BH-RCPT-tx-decided-b8816339-e413-4716-9013-e5140befd994-approved-AIR0RT",
                        verifiedBy: "BookHive Circulation Desk"
                      })
                    )
                  }
                >
                  <Text style={[styles.webChipText, { color: "#10B981", fontWeight: "800" }]}>🧾 "The Struggle" (RCP-PROVED-2130)</Text>
                </TouchableOpacity>

                {activeMode === "Catalog" ? (
                  <>
                    <TouchableOpacity
                      style={[styles.webChip, { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}
                      onPress={() =>
                        processScanResult(
                          `Title: Brich Capston Journey\nAuthor: Yana Brich\nGenre: Life Story\nISBN: 933-1428-103\nCopies: 1\nEdition: 1st\nVolume: 1\nSummary: A Life Story about the Capstone Experience.`
                        )
                      }
                    >
                      <Text style={styles.webChipText}>📄 "Brich Capston Journey" (User's Paper)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.webChip}
                      onPress={() =>
                        processScanResult(
                          `Title: On Fortune's Wheel\nAuthor: Cynthia Voigt\nGenre: Fiction\nISBN: 9780689829574\nCopies: 2\nEdition: 2nd\nVolume: 1\nSummary: Tale of bravery in the Kingdom.`
                        )
                      }
                    >
                      <Text style={styles.webChipText}>📄 "On Fortune's Wheel" (Voigt)</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.webChip}
                    onPress={() => processScanResult("23-1111-111")}
                  >
                    <Text style={styles.webChipText}>🎓 Student Pass (23-1111-111)</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </View>

      {/* MANUAL CODE / WORDS DRAWER */}
      {showManualInput && (
        <View style={styles.manualInputDrawer}>
          <TextInput
            style={styles.drawerInput}
            placeholder={
              activeMode === "Catalog"
                ? "Type words from paper, ISBN, or Receipt (e.g. RCP-PROVED-2130)..."
                : "Enter Student ID or Receipt Slip (e.g. RCP-PROVED-2130)"
            }
            placeholderTextColor={theme.muted}
            value={manualCode}
            onChangeText={setManualCode}
            onSubmitEditing={() => {
              setShowManualInput(false);
              processScanResult(manualCode);
            }}
          />
          <TouchableOpacity
            style={styles.drawerSubmitBtn}
            onPress={() => {
              setShowManualInput(false);
              processScanResult(manualCode);
            }}
          >
            <Text style={styles.drawerSubmitText}>Scan</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ========================================================================= */}
      {/* FLOATING MODE SWITCHER: Modern Segmented Capsule */}
      {/* ========================================================================= */}
      <View style={styles.modeSwitcherContainer}>
        <View style={styles.floatingModePill}>
          {/* Catalog Mode Button */}
          <TouchableOpacity
            style={[
              styles.modeSegmentBtn,
              activeMode === "Catalog" && styles.modeSegmentBtnActive,
              !canCatalog && { opacity: 0.6 },
            ]}
            onPress={() => {
              if (!canCatalog) {
                Alert.alert(
                  "Feature Restricted",
                  "Document & Paper Cataloging scanner has been restricted for your librarian account by the administrator."
                );
                return;
              }
              setActiveMode("Catalog");
              setScanned(false);
            }}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name={canCatalog ? "book-open-page-variant" : "lock"}
              size={15}
              color={activeMode === "Catalog" ? "#FFFFFF" : !canCatalog ? theme.danger : theme.muted}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.modeSegmentText,
                activeMode === "Catalog" && styles.modeSegmentTextActive,
                !canCatalog && { color: theme.danger },
              ]}
            >
              {canCatalog ? "Catalog (Paper)" : "Catalog (Locked)"}
            </Text>
          </TouchableOpacity>

          {/* Transaction Mode Button */}
          <TouchableOpacity
            style={[
              styles.modeSegmentBtn,
              activeMode === "Transaction" && styles.modeSegmentBtnActive,
              !canStudentPass && { opacity: 0.6 },
            ]}
            onPress={() => {
              if (!canStudentPass) {
                Alert.alert(
                  "Feature Restricted",
                  "Student Pass QR and ID scanning has been restricted for your librarian account by the administrator."
                );
                return;
              }
              setActiveMode("Transaction");
              setScanned(false);
            }}
            activeOpacity={0.85}
          >
            <Ionicons
              name={canStudentPass ? "card" : "lock-closed"}
              size={15}
              color={activeMode === "Transaction" ? "#FFFFFF" : !canStudentPass ? theme.danger : theme.muted}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.modeSegmentText,
                activeMode === "Transaction" && styles.modeSegmentTextActive,
                !canStudentPass && { color: theme.danger },
              ]}
            >
              {canStudentPass ? "Student Info & Return" : "Info & Return (Locked)"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* CAMERA SHUTTER BAR: Modern Native Camera Shutter Experience */}
      {/* ========================================================================= */}
      <View style={[styles.shutterBarContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {/* 1. Left: Gallery / Pick Photo */}
        <TouchableOpacity
          style={[styles.shutterSideBtn, !canGallery && { opacity: 0.5 }]}
          onPress={handlePickPaperPhoto}
          disabled={processing}
          activeOpacity={0.75}
        >
          <View style={styles.sideBtnIconBox}>
            <Ionicons
              name={canGallery ? "images" : "lock-closed"}
              size={18}
              color={!canGallery ? theme.danger : theme.iconNeutral}
            />
          </View>
          <Text style={[styles.sideBtnText, !canGallery && { color: theme.danger }]}>
            {canGallery ? "Gallery" : "Locked"}
          </Text>
        </TouchableOpacity>

        {/* 2. Center: Real Camera Shutter Button */}
        <Animated.View style={{ transform: [{ scale: shutterScale }] }}>
          <TouchableOpacity
            style={[
              styles.shutterOuterRing,
              allScanningRestricted && { opacity: 0.5, borderColor: theme.danger },
            ]}
            onPress={handleShutterCapture}
            disabled={processing}
            activeOpacity={0.9}
            accessibilityLabel="Camera Shutter"
          >
            <View
              style={[
                styles.shutterInnerButton,
                allScanningRestricted && { backgroundColor: theme.danger },
              ]}
            >
              {processing && activeMode === "Transaction" ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <MaterialCommunityIcons
                  name={
                    allScanningRestricted
                      ? "lock"
                      : activeMode === "Catalog"
                      ? "camera-iris"
                      : "qrcode-scan"
                  }
                  size={28}
                  color="#FFFFFF"
                />
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* 3. Center-Right: High-Definition Camera Snap (Autofocus & Macro) */}
        <TouchableOpacity
          style={[styles.shutterSideBtn, !canCatalog && { opacity: 0.5 }]}
          onPress={handleLaunchNativeCamera}
          disabled={processing}
          activeOpacity={0.75}
        >
          <View style={styles.sideBtnIconBox}>
            <Ionicons
              name={canCatalog ? "camera" : "lock-closed"}
              size={18}
              color={!canCatalog ? theme.danger : theme.iconNeutral}
            />
          </View>
          <Text style={[styles.sideBtnText, !canCatalog && { color: theme.danger }]}>
            {canCatalog ? "HD Camera" : "Locked"}
          </Text>
        </TouchableOpacity>

        {/* 4. Right: Manual / Type Words */}
        <TouchableOpacity
          style={[styles.shutterSideBtn, !canManualEntry && { opacity: 0.5 }]}
          onPress={() => {
            if (!canManualEntry) {
              Alert.alert(
                "Feature Restricted",
                "Manual keypad entry has been restricted for your librarian account by the administrator."
              );
              return;
            }
            setShowManualInput(prev => !prev);
          }}
          disabled={processing}
          activeOpacity={0.75}
        >
          <View style={[styles.sideBtnIconBox, showManualInput && styles.sideBtnIconBoxActive]}>
            <Ionicons
              name={canManualEntry ? "keypad" : "lock-closed"}
              size={18}
              color={!canManualEntry ? theme.danger : (showManualInput ? theme.primary : theme.iconNeutral)}
            />
          </View>
          <Text
            style={[
              styles.sideBtnText,
              !canManualEntry && { color: theme.danger },
              showManualInput && { color: theme.primary, fontWeight: "800" },
            ]}
          >
            {canManualEntry ? "Manual" : "Locked"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* MODERN & AESTHETIC RESULT MODAL: ALL 8 ITEMS (Title, Author, Genre, ISBN, */}
      {/* Copies, Edition, Volume, Summary)                                        */}
      {/* ========================================================================= */}
      <Modal
        visible={bookModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setBookModalVisible(false);
          setScanned(false);
          setBookCoverPhoto(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Modal Drag Handle */}
            <View style={styles.modalDragHandle} />

            {/* Modal Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderInfo}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                  <View style={[styles.modalStatusBadge, ocrEngine === "gemini-vision" ? styles.modalStatusBadgeAi : null]}>
                    <MaterialCommunityIcons
                      name={ocrEngine === "gemini-vision" ? "auto-fix" : "check-decagram"}
                      size={15}
                      color={ocrEngine === "gemini-vision" ? theme.accentStrong : theme.successText}
                    />
                    <Text style={[styles.modalStatusBadgeText, ocrEngine === "gemini-vision" ? styles.modalStatusBadgeAiText : null]}>
                      {ocrEngine === "gemini-vision" ? "AI VISION RECOGNITION" : "NEURAL OCR ENHANCED"} • {ocrConfidence}% ACCURACY
                    </Text>
                  </View>
                  {parsedFields.docType ? (
                    <View style={styles.docTypeBadge}>
                      <MaterialCommunityIcons name="file-document-outline" size={13} color={theme.primary} />
                      <Text style={styles.docTypeBadgeText}>{parsedFields.docType}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.sheetTitle}>Scanned Book Details</Text>
                <Text style={styles.sheetSubtitle}>
                  {ocrEngine === "gemini-vision"
                    ? "Deciphered handwriting strokes & typography with high precision"
                    : "Verified from document & converted to digital catalog items"}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => {
                  setBookModalVisible(false);
                  setScanned(false);
                  setBookCoverPhoto(null);
                }}
              >
                <Ionicons name="close-circle" size={26} color={theme.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
              {/* OPTIONAL BOOK PHOTO UPLOAD SECTION (Visible after scanning) */}
              <View style={styles.photoUploadSection}>
                <View style={styles.photoSectionHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="camera-outline" size={15} color={theme.primary} />
                    <Text style={styles.sectionLabel}>BOOK COVER PICTURE</Text>
                  </View>
                  <View style={styles.optionalBadge}>
                    <Text style={styles.optionalBadgeText}>OPTIONAL</Text>
                  </View>
                </View>

                {bookCoverPhoto ? (
                  <View style={styles.photoPreviewCard}>
                    <Image source={{ uri: bookCoverPhoto }} style={styles.photoThumbnail} resizeMode="cover" />
                    <View style={styles.photoInfoContainer}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 3 }}>
                        <Ionicons name="checkmark-circle" size={15} color={theme.successText || "#10B981"} />
                        <Text style={styles.photoSuccessText}>Cover Picture Attached</Text>
                      </View>
                      <Text style={styles.photoSubtext}>Will be displayed with this book in catalog & details</Text>
                      <View style={styles.photoActionButtonsRow}>
                        <TouchableOpacity
                          style={styles.photoMiniBtn}
                          onPress={handlePickBookCoverPhoto}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="pencil" size={12} color={theme.primary} />
                          <Text style={styles.photoMiniBtnText}>Change</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.photoMiniBtn, { borderColor: "rgba(239, 68, 68, 0.3)" }]}
                          onPress={() => setBookCoverPhoto(null)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={12} color="#EF4444" />
                          <Text style={[styles.photoMiniBtnText, { color: "#EF4444" }]}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.uploadPhotoButton}
                    onPress={handlePickBookCoverPhoto}
                    activeOpacity={0.8}
                  >
                    <BookCoverImage
                      title={parsedFields.title || "Book Cover"}
                      author={parsedFields.author || "Author"}
                      category={parsedFields.genre || parsedFields.department}
                      style={{ width: 46, height: 62, borderRadius: 8 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.uploadPhotoButtonTitle}>Upload Book Picture (Optional)</Text>
                      <Text style={styles.uploadPhotoButtonSubtitle}>Take a photo or choose from library</Text>
                    </View>
                    <Ionicons name="camera" size={18} color={theme.primary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* EDIT TOGGLE BAR */}
              <View style={styles.editToggleRow}>
                <Text style={styles.sectionLabel}>EXTRACTED CATALOG FIELDS</Text>
                <TouchableOpacity
                  style={styles.editToggleBtn}
                  onPress={() => setIsEditingFields(prev => !prev)}
                >
                  <Ionicons
                    name={isEditingFields ? "checkmark" : "create-outline"}
                    size={14}
                    color={theme.primary}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.editToggleText}>
                    {isEditingFields ? "Done Editing" : "Edit Fields"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ============================================================ */}
              {/* THE STRUCTURED BOOK FIELDS (MATCHING ADD NEW BOOK LAYOUT)   */}
              {/* ============================================================ */}
              <View style={styles.fieldsCard}>
                {/* ROW 1: BOOK TITLE */}
                <View style={styles.fieldItem}>
                  <View style={styles.fieldLabelRow}>
                    <Ionicons name="book-outline" size={15} color={theme.primary} />
                    <Text style={styles.fieldLabel}>BOOK TITLE</Text>
                  </View>
                  {isEditingFields ? (
                    <TextInput
                      style={styles.fieldInput}
                      value={parsedFields.title}
                      onChangeText={val => setParsedFields(prev => ({ ...prev, title: val }))}
                      placeholder="Enter book title"
                      placeholderTextColor={theme.muted}
                    />
                  ) : (
                    <Text style={styles.titleValueText}>{parsedFields.title || "Untitled"}</Text>
                  )}
                </View>

                {/* ROW 2: AUTHOR & ISBN (2 COLUMNS) */}
                <View style={styles.fieldDivider} />
                <View style={styles.twoColRow}>
                  {/* AUTHOR */}
                  <View style={styles.twoColItem}>
                    <View style={styles.fieldLabelRow}>
                      <FontAwesome5 name="pen-nib" size={13} color={theme.primary} />
                      <Text style={styles.fieldLabel}>AUTHOR</Text>
                    </View>
                    {isEditingFields ? (
                      <TextInput
                        style={styles.fieldInput}
                        value={parsedFields.author}
                        onChangeText={val => setParsedFields(prev => ({ ...prev, author: val }))}
                        placeholder="Enter author name"
                        placeholderTextColor={theme.muted}
                      />
                    ) : (
                      <Text style={styles.fieldValueText}>{parsedFields.author || "Unknown"}</Text>
                    )}
                  </View>

                  {/* ISBN */}
                  <View style={styles.twoColItem}>
                    <View style={styles.fieldLabelRow}>
                      <MaterialCommunityIcons name="barcode-scan" size={15} color={theme.primary} />
                      <Text style={styles.fieldLabel}>ISBN</Text>
                    </View>
                    {isEditingFields ? (
                      <TextInput
                        style={styles.fieldInput}
                        value={parsedFields.isbn}
                        onChangeText={val => setParsedFields(prev => ({ ...prev, isbn: val.replace(/[—–]/g, "-").replace(/-+/g, "-") }))}
                        placeholder="e.g. 933-1428-103"
                        placeholderTextColor={theme.muted}
                      />
                    ) : (
                      <Text style={styles.isbnValueText}>{parsedFields.isbn || "No ISBN specified"}</Text>
                    )}
                  </View>
                </View>

                {/* ROW 3: SECTION & CLASSIFICATION (2 COLUMNS) */}
                <View style={styles.fieldDivider} />
                <View style={styles.twoColRow}>
                  {/* SECTION */}
                  <View style={styles.twoColItem}>
                    <View style={styles.fieldLabelRow}>
                      <Ionicons name="location-outline" size={14} color={theme.primary} />
                      <Text style={styles.fieldLabel}>SECTION</Text>
                    </View>
                    {isEditingFields ? (
                      <TextInput
                        style={styles.fieldInput}
                        value={parsedFields.department || "Circulation"}
                        onChangeText={val => setParsedFields(prev => ({ ...prev, department: val }))}
                        placeholder="Section"
                        placeholderTextColor={theme.muted}
                      />
                    ) : (
                      <View style={styles.genrePill}>
                        <Text style={styles.genrePillText}>{parsedFields.department || "Circulation"}</Text>
                      </View>
                    )}
                  </View>

                  {/* CLASSIFICATION */}
                  <View style={styles.twoColItem}>
                    <View style={styles.fieldLabelRow}>
                      <Ionicons name="pricetag-outline" size={14} color={theme.primary} />
                      <Text style={styles.fieldLabel}>CLASSIFICATION</Text>
                    </View>
                    {isEditingFields ? (
                      <TextInput
                        style={styles.fieldInput}
                        value={parsedFields.genre}
                        onChangeText={val => setParsedFields(prev => ({ ...prev, genre: val }))}
                        placeholder="Classification"
                        placeholderTextColor={theme.muted}
                      />
                    ) : (
                      <View style={styles.genrePill}>
                        <Text style={styles.genrePillText}>{parsedFields.genre || "General"}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* ROW 4: PUBLISHER & PUB. DATE (2 COLUMNS) */}
                <View style={styles.fieldDivider} />
                <View style={styles.twoColRow}>
                  {/* PUBLISHER */}
                  <View style={styles.twoColItem}>
                    <View style={styles.fieldLabelRow}>
                      <Ionicons name="business-outline" size={14} color={theme.primary} />
                      <Text style={styles.fieldLabel}>PUBLISHER</Text>
                    </View>
                    {isEditingFields ? (
                      <TextInput
                        style={styles.fieldInput}
                        value={parsedFields.publisher || ""}
                        onChangeText={val => setParsedFields(prev => ({ ...prev, publisher: val }))}
                        placeholder="e.g. Bloomsbury, Pearson"
                        placeholderTextColor={theme.muted}
                      />
                    ) : (
                      <Text style={styles.fieldValueText}>{parsedFields.publisher || "Bloomsbury Publishing"}</Text>
                    )}
                  </View>

                  {/* PUB. DATE */}
                  <View style={styles.twoColItem}>
                    <View style={styles.fieldLabelRow}>
                      <Ionicons name="calendar-outline" size={14} color={theme.primary} />
                      <Text style={styles.fieldLabel}>PUB. DATE</Text>
                    </View>
                    {isEditingFields ? (
                      <TextInput
                        style={styles.fieldInput}
                        value={parsedFields.publicationDate || parsedFields.publishedYear || ""}
                        onChangeText={val => setParsedFields(prev => ({ ...prev, publicationDate: val, publishedYear: val.slice(0, 4) }))}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={theme.muted}
                      />
                    ) : (
                      <Text style={styles.fieldValueText}>{parsedFields.publicationDate || parsedFields.publishedYear || "2026-09-01"}</Text>
                    )}
                  </View>
                </View>

                {/* ROW 5: VOLUME | SERIES | EDITION (3 COLUMNS) */}
                <View style={styles.fieldDivider} />
                <View style={styles.threeColRow}>
                  {/* VOLUME */}
                  <View style={styles.colItem}>
                    <View style={styles.fieldLabelRow}>
                      <Ionicons name="folder-outline" size={14} color={theme.primary} />
                      <Text style={styles.fieldLabel}>VOLUME</Text>
                    </View>
                    {isEditingFields ? (
                      <TextInput
                        style={styles.colInput}
                        value={parsedFields.volume}
                        onChangeText={val => setParsedFields(prev => ({ ...prev, volume: val }))}
                      />
                    ) : (
                      <View style={styles.colBadge}>
                        <Text style={styles.colBadgeText}>{parsedFields.volume || "1"}</Text>
                      </View>
                    )}
                  </View>

                  {/* SERIES */}
                  <View style={styles.colItem}>
                    <View style={styles.fieldLabelRow}>
                      <Ionicons name="albums-outline" size={14} color={theme.primary} />
                      <Text style={styles.fieldLabel}>SERIES</Text>
                    </View>
                    {isEditingFields ? (
                      <TextInput
                        style={styles.colInput}
                        value={parsedFields.series || ""}
                        placeholder="Series"
                        placeholderTextColor={theme.muted}
                        onChangeText={val => setParsedFields(prev => ({ ...prev, series: val }))}
                      />
                    ) : (
                      <View style={styles.colBadge}>
                        <Text style={styles.colBadgeText} numberOfLines={1}>{parsedFields.series || "None"}</Text>
                      </View>
                    )}
                  </View>

                  {/* EDITION */}
                  <View style={styles.colItem}>
                    <View style={styles.fieldLabelRow}>
                      <Ionicons name="bookmark-outline" size={14} color={theme.primary} />
                      <Text style={styles.fieldLabel}>EDITION</Text>
                    </View>
                    {isEditingFields ? (
                      <TextInput
                        style={styles.colInput}
                        value={parsedFields.edition}
                        onChangeText={val => setParsedFields(prev => ({ ...prev, edition: val }))}
                      />
                    ) : (
                      <View style={styles.colBadge}>
                        <Text style={styles.colBadgeText}>{parsedFields.edition || "1st"}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* ROW 6: CALL NUMBER & ACCESSION NUMBER (2 COLUMNS) */}
                <View style={styles.fieldDivider} />
                <View style={styles.twoColRow}>
                  {/* CALL NUMBER */}
                  <View style={styles.twoColItem}>
                    <View style={styles.fieldLabelRow}>
                      <Ionicons name="compass-outline" size={14} color={theme.primary} />
                      <Text style={styles.fieldLabel}>CALL NUMBER</Text>
                    </View>
                    {isEditingFields ? (
                      <TextInput
                        style={[styles.fieldInput, { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }]}
                        value={parsedFields.shelfLocation || ""}
                        onChangeText={val => setParsedFields(prev => ({ ...prev, shelfLocation: val }))}
                        placeholder="e.g. CIR-16D.4"
                        placeholderTextColor={theme.muted}
                      />
                    ) : (
                      <Text style={styles.isbnValueText}>{parsedFields.shelfLocation || "CIR-16D.4"}</Text>
                    )}
                  </View>

                  {/* ACCESSION NUMBER */}
                  <View style={styles.twoColItem}>
                    <View style={styles.fieldLabelRow}>
                      <MaterialCommunityIcons name="tag-outline" size={14} color={theme.primary} />
                      <Text style={styles.fieldLabel}>ACCESSION NO.</Text>
                    </View>
                    {isEditingFields ? (
                      <TextInput
                        style={[styles.fieldInput, { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }]}
                        value={parsedFields.accessionNumber || ""}
                        onChangeText={val => setParsedFields(prev => ({ ...prev, accessionNumber: val }))}
                        placeholder="e.g. ACC-2026-41191"
                        placeholderTextColor={theme.muted}
                      />
                    ) : (
                      <Text style={styles.isbnValueText}>{parsedFields.accessionNumber || "ACC-2026-41191"}</Text>
                    )}
                  </View>
                </View>

                {/* ROW 7: COPIES & PRICE (PHP) (2 COLUMNS) */}
                <View style={styles.fieldDivider} />
                <View style={styles.twoColRow}>
                  {/* COPIES */}
                  <View style={styles.twoColItem}>
                    <View style={styles.fieldLabelRow}>
                      <MaterialCommunityIcons name="layers-outline" size={14} color={theme.primary} />
                      <Text style={styles.fieldLabel}>COPIES</Text>
                    </View>
                    {isEditingFields ? (
                      <TextInput
                        style={styles.fieldInput}
                        keyboardType="numeric"
                        value={String(parsedFields.copies)}
                        onChangeText={val => setParsedFields(prev => ({ ...prev, copies: parseInt(val, 10) || 1 }))}
                      />
                    ) : (
                      <View style={styles.colBadge}>
                        <Text style={styles.colBadgeText}>
                          {parsedFields.copies} {parsedFields.copies === 1 ? "copy" : "copies"}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* PRICE (PHP) */}
                  <View style={styles.twoColItem}>
                    <View style={styles.fieldLabelRow}>
                      <FontAwesome5 name="coins" size={13} color={theme.primary} />
                      <Text style={styles.fieldLabel}>PRICE (PHP)</Text>
                    </View>
                    {isEditingFields ? (
                      <View style={{ position: "relative", justifyContent: "center" }}>
                        <Text
                          style={{
                            position: "absolute",
                            left: 10,
                            zIndex: 2,
                            fontSize: 13,
                            fontWeight: "normal",
                            color: isDarkMode ? "#FFFFFF" : "#64748B",
                          }}
                        >
                          ₱
                        </Text>
                        <TextInput
                          style={[styles.fieldInput, { paddingLeft: 24 }]}
                          keyboardType="numeric"
                          value={String(parsedFields.price || "")}
                          onChangeText={val => {
                            const raw = val.replace(/[^0-9.]/g, "");
                            const parts = raw.split(".");
                            const formatted = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (parts.length > 1 ? "." + parts[1] : "");
                            setParsedFields(prev => ({ ...prev, price: formatted }));
                          }}
                          placeholder="450.00"
                          placeholderTextColor={theme.muted}
                        />
                      </View>
                    ) : (
                      <View style={styles.colBadge}>
                        <Text style={styles.colBadgeText}>
                          ₱{typeof parsedFields.price === "number" ? parsedFields.price.toLocaleString("en-US", { minimumFractionDigits: 2 }) : (parsedFields.price || "450.00")}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* ROW 8: SUMMARY */}
                <View style={styles.fieldDivider} />
                <View style={styles.fieldItem}>
                  <View style={styles.fieldLabelRow}>
                    <Ionicons name="document-text-outline" size={15} color={theme.primary} />
                    <Text style={styles.fieldLabel}>SUMMARY</Text>
                  </View>
                  {isEditingFields ? (
                    <TextInput
                      style={[styles.fieldInput, { height: 75, textAlignVertical: "top" }]}
                      multiline
                      value={parsedFields.summary}
                      onChangeText={val => setParsedFields(prev => ({ ...prev, summary: val }))}
                      placeholder="Enter book summary..."
                      placeholderTextColor={theme.muted}
                    />
                  ) : (
                    <Text style={styles.summaryValueText}>
                      {parsedFields.summary ? `"${parsedFields.summary}"` : "No summary provided on paper."}
                    </Text>
                  )}
                </View>
              </View>

              {/* RAW SCANNED WORDS DISCLOSURE */}
              <TouchableOpacity
                style={styles.rawWordsToggleBtn}
                onPress={() => setShowRawText(prev => !prev)}
              >
                <MaterialCommunityIcons name="text-recognition" size={16} color={theme.primary} />
                <Text style={styles.rawWordsToggleText}>
                  {showRawText ? "Hide Raw Scanned Words" : "View Raw Scanned Words from Paper"}
                </Text>
                <Ionicons
                  name={showRawText ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={theme.muted}
                  style={{ marginLeft: "auto" }}
                />
              </TouchableOpacity>

              {showRawText && (
                <View style={styles.rawWordsBox}>
                  <Text style={styles.rawWordsContent}>
                    {stripEmbeddedCoverUri(scannedPaperText || parsedFields.rawText || "") || "No raw text available."}
                  </Text>
                </View>
              )}

              {/* ============================================================ */}
              {/* ACTION BUTTONS: Save to Catalog / Issue to Student           */}
              {/* ============================================================ */}
              <View style={styles.modalActionButtons}>
                {/* 1. Save & Add to Catalog */}
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={handleSaveToCatalog}
                  disabled={isSaving}
                  activeOpacity={0.85}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={19} color={isDarkMode ? "#080F1E" : "#FFFFFF"} />
                      <Text style={styles.primaryActionBtnText}>Save & Add to Catalog</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* 2. Issue / Checkout to Student */}
                <TouchableOpacity
                  style={styles.secondaryActionBtn}
                  onPress={() => {
                    Alert.prompt
                      ? Alert.prompt(
                          "Check Out Book",
                          `Enter Student ID to issue "${parsedFields.title}":`,
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Issue Book",
                              onPress: (studentId?: string) => {
                                if (studentId) {
                                  Alert.alert(
                                    "Checkout Completed",
                                    `"${parsedFields.title}" issued to Student ID ${studentId}.`
                                  );
                                  setBookModalVisible(false);
                                  setScanned(false);
                                }
                              },
                            },
                          ]
                        )
                      : Alert.alert("Issue Book", `Ready to issue "${parsedFields.title}" to a student.`);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="arrow-up-circle-outline" size={18} color={theme.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.secondaryActionBtnText}>Issue / Checkout to Student</Text>
                </TouchableOpacity>

                {/* 3. Scan Another Paper */}
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setBookModalVisible(false);
                    setScanned(false);
                    setBookCoverPhoto(null);
                  }}
                >
                  <Text style={styles.cancelBtnText}>Scan Another Paper</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* CIRCULATION RECEIPT VERIFICATION & PICK-UP MODAL */}
      <Modal
        visible={receiptModalVisible && scannedReceipt !== null}
        transparent
        animationType="slide"
        onRequestClose={handleCloseReceiptModal}
      >
        <View style={styles.receiptBackdrop}>
          <View style={styles.receiptCard}>
            {/* Header Brand Bar */}
            <View style={styles.receiptHeaderRow}>
              <View style={styles.receiptBrandRow}>
                <View style={styles.receiptLogoBox}>
                  <Ionicons name="book" size={16} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.receiptBrandTitle}>BOOKHIVE</Text>
                  <Text style={styles.receiptBrandSub}>STI West Negros University • Official Circulation Desk</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={handleCloseReceiptModal}
                style={styles.receiptCloseBtn}
                accessibilityLabel="Close receipt modal"
              >
                <Ionicons name="close" size={20} color={theme.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.receiptScrollContent}>
              {/* Slip Title & Status Badge */}
              <View style={styles.receiptTitleBlock}>
                <Text style={styles.receiptDocumentTitle}>CIRCULATION LOAN SLIP</Text>

                <View
                  style={[
                    styles.receiptBadge,
                    scannedReceipt?.isPickedUp
                      ? styles.receiptBadgePickedUp
                      : styles.receiptBadgeApproved,
                  ]}
                >
                  <View
                    style={[
                      styles.receiptStatusDot,
                      {
                        backgroundColor: scannedReceipt?.isPickedUp ? "#10B981" : "#0284C7",
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.receiptBadgeText,
                      {
                        color: scannedReceipt?.isPickedUp ? "#10B981" : "#0284C7",
                      },
                    ]}
                  >
                    {scannedReceipt?.isPickedUp ? "PICKED UP / ACTIVE LOAN" : "READY FOR PICKUP (CLAIM BOOK)"}
                  </Text>
                </View>

                {/* Monospace Slip Badge */}
                <View style={styles.slipPillBox}>
                  <Ionicons name="receipt-outline" size={13} color={theme.muted} />
                  <Text style={styles.receiptNumberText}>
                    SLIP NO: {scannedReceipt?.receiptNumber || "RCP-PROVED-2130"}
                  </Text>
                </View>
              </View>

              {/* Perforated Ticket Notches & Dashed Divider */}
              <View style={styles.ticketDividerContainer}>
                <View style={styles.ticketNotchLeft} />
                <View style={styles.receiptDashedLine} />
                <View style={styles.ticketNotchRight} />
              </View>

              {/* 1. Book Details Section */}
              <View style={styles.receiptSection}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="book-outline" size={14} color={theme.primary} />
                  <Text style={styles.receiptSectionHeader}>BOOK DETAILS</Text>
                </View>

                <View style={styles.receiptBookCard}>
                  <Text style={styles.receiptBookTitle} numberOfLines={2}>
                    {scannedReceipt?.bookTitle || "The Struggle"}
                  </Text>

                  {scannedReceipt?.author ? (
                    <View style={styles.receiptAuthorRow}>
                      <Ionicons name="person-circle-outline" size={14} color={theme.muted} />
                      <Text style={styles.receiptAuthorText}>by {scannedReceipt.author}</Text>
                    </View>
                  ) : null}

                  <View style={styles.receiptTagRow}>
                    {scannedReceipt?.isbn ? (
                      <View style={[styles.receiptMetaTag, { backgroundColor: isDarkMode ? "rgba(56, 189, 248, 0.12)" : "#E0F2FE" }]}>
                        <Ionicons name="barcode-outline" size={11} color={isDarkMode ? "#38BDF8" : "#0284C7"} />
                        <Text style={[styles.receiptMetaTagText, { color: isDarkMode ? "#38BDF8" : "#0284C7" }]}>
                          ISBN: {scannedReceipt.isbn}
                        </Text>
                      </View>
                    ) : null}

                    {scannedReceipt?.category ? (
                      <View style={[styles.receiptMetaTag, { backgroundColor: isDarkMode ? "rgba(168, 85, 247, 0.12)" : "#F3E8FF" }]}>
                        <Ionicons name="pricetag-outline" size={11} color={isDarkMode ? "#C084FC" : "#7E22CE"} />
                        <Text style={[styles.receiptMetaTagText, { color: isDarkMode ? "#C084FC" : "#7E22CE" }]}>
                          {scannedReceipt.category}
                        </Text>
                      </View>
                    ) : null}

                    {scannedReceipt?.shelf ? (
                      <View style={[styles.receiptMetaTag, { backgroundColor: isDarkMode ? "rgba(251, 191, 36, 0.12)" : "#FEF3C7" }]}>
                        <Ionicons name="library-outline" size={11} color={isDarkMode ? "#FBBF24" : "#B45309"} />
                        <Text style={[styles.receiptMetaTagText, { color: isDarkMode ? "#FBBF24" : "#B45309" }]}>
                          {scannedReceipt.shelf}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>

              {/* 2. Circulation Timeline & Dates */}
              <View style={styles.receiptSection}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="time-outline" size={14} color={theme.primary} />
                  <Text style={styles.receiptSectionHeader}>CIRCULATION TIMELINE</Text>
                </View>

                <View style={styles.receiptDateGrid}>
                  <View style={styles.receiptDateBox}>
                    <View style={styles.dateBoxHeader}>
                      <Ionicons name="calendar-outline" size={12} color={theme.muted} />
                      <Text style={styles.receiptDateBoxLabel}>DATE BORROWED</Text>
                    </View>
                    <Text style={styles.receiptDateBoxValue}>{scannedReceipt?.borrowDate || "N/A"}</Text>
                  </View>

                  <View style={styles.receiptDateBox}>
                    <View style={styles.dateBoxHeader}>
                      <Ionicons
                        name={scannedReceipt?.isPickedUp ? "checkmark-done-circle" : "time"}
                        size={12}
                        color={scannedReceipt?.isPickedUp ? "#10B981" : "#F59E0B"}
                      />
                      <Text
                        style={[
                          styles.receiptDateBoxLabel,
                          { color: scannedReceipt?.isPickedUp ? "#10B981" : "#F59E0B" },
                        ]}
                      >
                        {scannedReceipt?.isPickedUp ? "PICKED UP" : "PICKUP STATUS"}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.receiptDateBoxValue,
                        scannedReceipt?.isPickedUp
                          ? { color: "#10B981", fontWeight: "800" }
                          : { color: "#F59E0B", fontWeight: "700" },
                      ]}
                    >
                      {scannedReceipt?.isPickedUp
                        ? scannedReceipt?.pickupDate || "Completed"
                        : "Ready for Pickup"}
                    </Text>
                  </View>
                </View>

                {/* Due Date Hero Card */}
                <View style={styles.receiptDueHeroCard}>
                  <View style={styles.dueHeroTopRow}>
                    <View style={styles.dueHeroLabelGroup}>
                      <Ionicons name="calendar" size={16} color={isDarkMode ? "#38BDF8" : "#0284C7"} />
                      <Text style={styles.dueHeroTitle}>DUE RETURN DEADLINE</Text>
                    </View>
                    <View style={styles.dueHeroStatusPill}>
                      <Text style={styles.dueHeroStatusPillText}>ON SCHEDULE</Text>
                    </View>
                  </View>

                  <Text style={styles.dueHeroDateValue}>
                    {scannedReceipt?.returnDate || "2026-10-20"}
                  </Text>

                  <View style={styles.dueHeroNoticeRow}>
                    <Ionicons name="information-circle-outline" size={13} color={isDarkMode ? "#94A3B8" : "#64748B"} />
                    <Text style={styles.dueHeroNoticeText}>
                      Physical book copy must be returned to the circulation desk on or before this date.
                    </Text>
                  </View>
                </View>
              </View>

              {/* 3. Borrower Details Section */}
              <View style={styles.receiptSection}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="id-card-outline" size={14} color={theme.primary} />
                  <Text style={styles.receiptSectionHeader}>BORROWER DETAILS</Text>
                </View>

                <View style={styles.receiptBorrowerCard}>
                  <View style={styles.borrowerInfoRow}>
                    <View style={styles.borrowerAvatarBox}>
                      <Ionicons name="person" size={18} color={theme.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.borrowerNameText}>
                        {scannedReceipt?.studentName || "Student Borrower"}
                      </Text>
                      <View style={styles.borrowerPillRow}>
                        <View style={[styles.borrowerPill, { backgroundColor: isDarkMode ? "#1E2D40" : "#EDE9FE" }]}>
                          <Text style={[styles.borrowerPillText, { color: isDarkMode ? "#A78BFA" : "#6D28D9" }]}>
                            ID: {scannedReceipt?.studentId || "N/A"}
                          </Text>
                        </View>
                        <View style={[styles.borrowerPill, { backgroundColor: isDarkMode ? "#1E2D40" : "#E0F2FE" }]}>
                          <Text style={[styles.borrowerPillText, { color: isDarkMode ? "#38BDF8" : "#0369A1" }]}>
                            Dept: {scannedReceipt?.department || "General"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              {/* Official Verified Desk Badge */}
              <View style={styles.receiptVerifiedBadgeContainer}>
                <View style={styles.qrVerifiedBadge}>
                  <Ionicons name="shield-checkmark" size={13} color="#10B981" />
                  <Text style={styles.qrVerifiedBadgeText}>
                    Verified by BookHive Circulation Desk • STI WNU
                  </Text>
                </View>
              </View>

              {/* 4. Action Buttons at the End */}
              <View style={styles.receiptActionWrapper}>
                {!scannedReceipt?.isPickedUp ? (
                  <TouchableOpacity
                    style={[styles.receiptPickupBtn, isPickingUp && { opacity: 0.7 }]}
                    onPress={handleConfirmPickup}
                    disabled={isPickingUp}
                    activeOpacity={0.85}
                  >
                    {isPickingUp ? (
                      <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                    ) : (
                      <Ionicons name="hand-right-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    )}
                    <View style={styles.pickupBtnTextCol}>
                      <Text style={styles.receiptPickupBtnText}>
                        {isPickingUp ? "Recording Pick-up..." : "Pick-up Book"}
                      </Text>
                      <Text style={styles.receiptPickupBtnSub}>
                        Confirm physical book hand-over to student
                      </Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.receiptPickupBtnPicked}>
                    <Ionicons name="checkmark-done-circle" size={22} color="#10B981" style={{ marginRight: 8 }} />
                    <View style={styles.pickupBtnTextCol}>
                      <Text style={styles.receiptPickupBtnPickedText}>Book Picked Up ✓</Text>
                      <Text style={styles.receiptPickupBtnPickedSub}>
                        Handed over to student on {scannedReceipt?.pickupDate || "today"}
                      </Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.receiptCloseSecondaryBtn}
                  onPress={handleCloseReceiptModal}
                  activeOpacity={0.8}
                >
                  <Text style={styles.receiptCloseSecondaryText}>Close & Return to Scanner</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AnimatedScreen>
  );
}

const getStyles = (theme: typeof LIGHT_THEME, isDarkMode: boolean) =>
  StyleSheet.create({
    screenRoot: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    shutterFlashOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "#FFFFFF",
      zIndex: 999,
    },
    topBar: {
      paddingHorizontal: 12,
      paddingBottom: 8,
      minHeight: 52,
      backgroundColor: theme.panel,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: theme.primaryLine,
    },
    brandTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      flexShrink: 1,
      marginRight: 6,
    },
    brandTitleText: {
      fontSize: 15,
      fontWeight: "900",
      color: theme.primary,
      letterSpacing: 0.6,
    },
    librarianBadgePill: {
      marginLeft: 6,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.primarySoft,
      borderWidth: 1,
      borderColor: isDarkMode ? "rgba(56, 189, 248, 0.25)" : "rgba(2, 132, 199, 0.2)",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
      gap: 4,
    },
    activeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#10B981",
    },
    librarianBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.primary,
    },
    topBarIcons: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexShrink: 0,
    },
    iconHit: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.iconNeutralBg,
      borderWidth: 1,
      borderColor: theme.iconNeutralBorder,
      justifyContent: "center",
      alignItems: "center",
    },
    iconHitActiveTorch: {
      backgroundColor: "rgba(245, 158, 11, 0.18)",
      borderColor: "#F59E0B",
    },
    logoutHit: {
      backgroundColor: theme.dangerBg,
      borderColor: isDarkMode ? "rgba(239, 68, 68, 0.3)" : "rgba(239, 68, 68, 0.2)",
    },

    /* UPPER VIEWPORT */
    scannerCardContainer: {
      flex: 1,
      paddingHorizontal: 14,
      paddingTop: 8,
      paddingBottom: 4,
    },
    scannerGrayBox: {
      flex: 1,
      backgroundColor: theme.panelStrong,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: isDarkMode ? "rgba(255, 255, 255, 0.1)" : "#CBD5E1",
      position: "relative",
      overflow: "hidden",
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 4,
    },

    /* RETICLE OVERLAYS */
    reticleOverlay: {
      width: Math.min(width * 0.74, 270),
      height: Math.min(height * 0.38, 280),
      position: "relative",
      justifyContent: "center",
      alignItems: "center",
    },
    paperReticleOverlay: {
      width: Math.min(width * 0.86, 320),
      height: Math.min(height * 0.44, 340),
      position: "relative",
      justifyContent: "center",
      alignItems: "center",
    },
    reticleBadgeBox: {
      position: "absolute",
      top: -12,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.webTapBg,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.2)",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
    },
    reticleBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      color: "#FFFFFF",
      letterSpacing: 0.6,
    },
    cornerBracket: {
      position: "absolute",
      width: 48,
      height: 48,
      borderColor: theme.primary,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 8,
    },
    bracketTopLeft: {
      top: 0,
      left: 0,
      borderTopWidth: 3.5,
      borderLeftWidth: 3.5,
      borderTopLeftRadius: 18,
    },
    bracketTopRight: {
      top: 0,
      right: 0,
      borderTopWidth: 3.5,
      borderRightWidth: 3.5,
      borderTopRightRadius: 18,
    },
    bracketBottomLeft: {
      bottom: 0,
      left: 0,
      borderBottomWidth: 3.5,
      borderLeftWidth: 3.5,
      borderBottomLeftRadius: 18,
    },
    bracketBottomRight: {
      bottom: 0,
      right: 0,
      borderBottomWidth: 3.5,
      borderRightWidth: 3.5,
      borderBottomRightRadius: 18,
    },
    animatedLaserLine: {
      width: "92%",
      height: 2.5,
      backgroundColor: theme.accent,
      borderRadius: 2,
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.95,
      shadowRadius: 8,
      position: "absolute",
    },
    reticleGuidePill: {
      position: "absolute",
      bottom: 14,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.webTapBg,
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.15)",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    },
    reticleGuideText: {
      fontSize: 11,
      color: "#F8FAFC",
      fontWeight: "700",
      textAlign: "center",
      letterSpacing: 0.2,
    },

    /* PROCESSING / OCR HUD OVERLAY */
    processingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: isDarkMode ? "rgba(8, 13, 26, 0.88)" : "rgba(15, 23, 42, 0.75)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
      zIndex: 20,
    },
    hudCard: {
      width: "90%",
      backgroundColor: theme.panel,
      borderRadius: 20,
      padding: 22,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.primaryLine,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 14,
      elevation: 8,
    },
    processingOverlayText: {
      marginTop: 14,
      fontSize: 16,
      fontWeight: "800",
      color: theme.primary,
      textAlign: "center",
    },
    processingOverlaySub: {
      marginTop: 5,
      fontSize: 12,
      fontWeight: "600",
      color: theme.muted,
      textAlign: "center",
    },
    hudPillRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 6,
      marginTop: 14,
    },
    hudPill: {
      backgroundColor: theme.primarySoft,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.primaryLine,
    },
    hudPillText: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.primary,
    },

    /* WEB SIMULATOR */
    webSimulatorContainer: {
      position: "absolute",
      bottom: 8,
      left: 10,
      right: 10,
      backgroundColor: theme.webTapBg,
      borderRadius: 12,
      padding: 8,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.15)",
      alignItems: "center",
    },
    webSimulatorTitle: {
      fontSize: 11,
      fontWeight: "700",
      color: "#94A3B8",
      marginBottom: 5,
    },
    webChipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 6,
    },
    webChip: {
      backgroundColor: isDarkMode ? "#1E293B" : "#FFFFFF",
      borderWidth: 1,
      borderColor: theme.primaryLine,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    webChipText: {
      fontSize: 11,
      color: theme.primary,
      fontWeight: "700",
    },

    /* MANUAL INPUT DRAWER */
    manualInputDrawer: {
      flexDirection: "row",
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: theme.panel,
      marginHorizontal: 14,
      marginBottom: 6,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.primaryLine,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    drawerInput: {
      flex: 1,
      height: 42,
      borderWidth: 1,
      borderColor: theme.primaryLine,
      backgroundColor: theme.inputBg,
      borderRadius: 10,
      paddingHorizontal: 12,
      fontSize: 13,
      color: theme.textDark,
    },
    drawerSubmitBtn: {
      backgroundColor: theme.primary,
      paddingHorizontal: 16,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 10,
      marginLeft: 8,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    drawerSubmitText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
    },

    /* FLOATING MODE SWITCHER */
    modeSwitcherContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 6,
      paddingHorizontal: 8,
      width: "100%",
    },
    floatingModePill: {
      flexDirection: "row",
      backgroundColor: theme.panel,
      borderRadius: 30,
      borderWidth: 1,
      borderColor: theme.primaryLine,
      padding: 3,
      maxWidth: "96%",
      alignSelf: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    modeSegmentBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 22,
    },
    modeSegmentBtnActive: {
      backgroundColor: theme.primary,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 5,
      elevation: 3,
    },
    modeSegmentText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.muted,
    },
    modeSegmentTextActive: {
      color: "#FFFFFF",
      fontWeight: "800",
    },

    /* CAMERA SHUTTER BAR */
    shutterBarContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 4,
    },
    shutterSideBtn: {
      alignItems: "center",
      justifyContent: "center",
      width: 62,
    },
    sideBtnIconBox: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.iconNeutralBg,
      borderWidth: 1,
      borderColor: theme.iconNeutralBorder,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    sideBtnIconBoxActive: {
      backgroundColor: theme.primarySoft,
      borderColor: theme.primary,
    },
    sideBtnText: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.muted,
      marginTop: 5,
      textAlign: "center",
      letterSpacing: 0.2,
    },
    shutterOuterRing: {
      width: 82,
      height: 82,
      borderRadius: 41,
      borderWidth: 3.5,
      borderColor: theme.shutterBorder,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "transparent",
    },
    shutterInnerButton: {
      width: 66,
      height: 66,
      borderRadius: 33,
      backgroundColor: theme.shutterInner,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 6,
    },

    /* MODAL STYLES */
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.modalOverlay,
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: theme.panel,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 18,
      paddingTop: 12,
      elevation: 16,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      maxHeight: "90%",
    },
    modalDragHandle: {
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.primaryLine,
      alignSelf: "center",
      marginBottom: 10,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    sheetHeaderInfo: {
      flex: 1,
    },
    modalStatusBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.successBg,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      alignSelf: "flex-start",
      gap: 4,
      marginBottom: 6,
    },
    modalStatusBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.successText,
      letterSpacing: 0.5,
    },
    modalStatusBadgeAi: {
      backgroundColor: theme.accentSoft,
      borderWidth: 1,
      borderColor: "rgba(245, 158, 11, 0.25)",
    },
    modalStatusBadgeAiText: {
      color: theme.accentStrong,
    },
    docTypeBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.primarySoft,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      alignSelf: "flex-start",
      gap: 4,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: isDarkMode ? "rgba(56, 189, 248, 0.25)" : "rgba(2, 132, 199, 0.2)",
    },
    docTypeBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.primary,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    sheetTitle: {
      fontSize: 21,
      fontWeight: "900",
      color: theme.primary,
      letterSpacing: -0.3,
    },
    sheetSubtitle: {
      fontSize: 12,
      color: theme.muted,
      marginTop: 2,
    },
    sheetCloseBtn: {
      padding: 4,
    },

    /* EDIT TOGGLE */
    editToggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
      marginTop: 4,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.muted,
      letterSpacing: 0.6,
    },
    editToggleBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.primarySoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.primaryLine,
    },
    editToggleText: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.primary,
    },

    /* OPTIONAL BOOK PHOTO UPLOAD */
    photoUploadSection: {
      marginBottom: 14,
    },
    photoSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    optionalBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
      backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "#F1F5F9",
      borderWidth: 1,
      borderColor: isDarkMode ? "rgba(255, 255, 255, 0.15)" : "#E2E8F0",
    },
    optionalBadgeText: {
      fontSize: 9.5,
      fontWeight: "800",
      letterSpacing: 0.5,
      color: theme.muted,
    },
    uploadPhotoButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: isDarkMode ? "rgba(2, 116, 187, 0.45)" : "rgba(2, 116, 187, 0.35)",
      backgroundColor: isDarkMode ? "rgba(2, 116, 187, 0.08)" : "#F0F7FF",
    },
    uploadPhotoIconCircle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: isDarkMode ? "rgba(2, 116, 187, 0.22)" : "#E0F2FE",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: isDarkMode ? "rgba(2, 116, 187, 0.35)" : "rgba(2, 116, 187, 0.2)",
    },
    uploadPhotoButtonTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.textPrimary,
    },
    uploadPhotoButtonSubtitle: {
      fontSize: 11,
      color: theme.muted,
      marginTop: 2,
    },
    photoPreviewCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 10,
      borderRadius: 14,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.primaryLine,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    photoThumbnail: {
      width: 58,
      height: 74,
      borderRadius: 8,
      backgroundColor: isDarkMode ? "#1E293B" : "#F1F5F9",
    },
    photoInfoContainer: {
      flex: 1,
    },
    photoSuccessText: {
      fontSize: 12.5,
      fontWeight: "800",
      color: theme.successText,
    },
    photoSubtext: {
      fontSize: 10.5,
      color: theme.muted,
      marginBottom: 6,
    },
    photoActionButtonsRow: {
      flexDirection: "row",
      gap: 8,
    },
    photoMiniBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.primaryLine,
      backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.04)" : "#F8FAFC",
    },
    photoMiniBtnText: {
      fontSize: 10.5,
      fontWeight: "700",
      color: theme.primary,
    },

    /* 8 FIELDS CARD */
    fieldsCard: {
      backgroundColor: theme.cardBg,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.primaryLine,
      padding: 16,
      marginBottom: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
    fieldItem: {
      paddingVertical: 4,
    },
    fieldDivider: {
      height: 1,
      backgroundColor: theme.primaryLine,
      marginVertical: 10,
    },
    fieldLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginBottom: 4,
    },
    fieldLabel: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.muted,
      letterSpacing: 0.6,
    },
    titleValueText: {
      fontSize: 18,
      fontWeight: "900",
      color: theme.textPrimary,
      letterSpacing: -0.2,
    },
    fieldValueText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.textDark,
    },
    isbnValueText: {
      fontSize: 13,
      fontWeight: "800",
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
      color: theme.textDark,
    },
    genrePill: {
      backgroundColor: theme.primarySoft,
      borderWidth: 1,
      borderColor: isDarkMode ? "rgba(56, 189, 248, 0.25)" : "rgba(2, 132, 199, 0.2)",
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 10,
      alignSelf: "flex-start",
    },
    genrePillText: {
      fontSize: 12,
      fontWeight: "800",
      color: theme.primary,
    },
    fieldInput: {
      borderWidth: 1,
      borderColor: theme.primary,
      backgroundColor: theme.inputBg,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 13,
      color: theme.textDark,
    },

    /* 3 COLUMNS GRID (COPIES, EDITION, VOLUME) */
    threeColRow: {
      flexDirection: "row",
      gap: 8,
    },
    colItem: {
      flex: 1,
    },
    colBadge: {
      backgroundColor: theme.iconNeutralBg,
      borderWidth: 1,
      borderColor: theme.primaryLine,
      paddingVertical: 6,
      borderRadius: 10,
      alignItems: "center",
    },
    colBadgeText: {
      fontSize: 12,
      fontWeight: "800",
      color: theme.textDark,
    },
    colInput: {
      borderWidth: 1,
      borderColor: theme.primary,
      backgroundColor: theme.inputBg,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      fontSize: 13,
      color: theme.textDark,
      textAlign: "center",
    },

    /* 2 COLUMNS ROW */
    twoColRow: {
      flexDirection: "row",
      gap: 10,
    },
    twoColItem: {
      flex: 1,
    },

    summaryValueText: {
      fontSize: 13,
      color: theme.textDark,
      fontStyle: "italic",
      lineHeight: 18,
    },

    /* RAW WORDS TOGGLE & BOX */
    rawWordsToggleBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.iconNeutralBg,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.primaryLine,
      marginBottom: 12,
      gap: 6,
    },
    rawWordsToggleText: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.textDark,
    },
    rawWordsBox: {
      backgroundColor: theme.iconNeutralBg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.primaryLine,
      padding: 12,
      marginBottom: 14,
    },
    rawWordsContent: {
      fontSize: 11,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
      color: theme.textDark,
      lineHeight: 16,
    },

    /* ACTION BUTTONS */
    modalActionButtons: {
      gap: 10,
      marginTop: 8,
    },
    primaryActionBtn: {
      height: 50,
      borderRadius: 14,
      backgroundColor: theme.primary,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      elevation: 4,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      gap: 6,
    },
    primaryActionBtnText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "800",
    },
    secondaryActionBtn: {
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.primaryLine,
      backgroundColor: theme.iconNeutralBg,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },
    secondaryActionBtnText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.textDark,
    },
    cancelBtn: {
      alignItems: "center",
      paddingVertical: 10,
    },
    cancelBtnText: {
      color: theme.muted,
      fontSize: 13,
      fontWeight: "600",
    },

    /* RECEIPT VERIFICATION & PICK-UP MODAL STYLES */
    receiptBackdrop: {
      flex: 1,
      backgroundColor: "rgba(15, 23, 42, 0.75)",
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    receiptCard: {
      width: "100%",
      maxWidth: 440,
      maxHeight: "92%",
      backgroundColor: theme.cardBg,
      borderRadius: 22,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
      elevation: 10,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 18,
    },
    receiptHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? "rgba(255,255,255,0.08)" : "#F1F5F9",
      backgroundColor: isDarkMode ? "rgba(255,255,255,0.03)" : "#F8FAFC",
    },
    receiptBrandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    receiptLogoBox: {
      width: 32,
      height: 32,
      borderRadius: 9,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    receiptBrandTitle: {
      fontSize: 14,
      fontWeight: "900",
      color: theme.primary,
      letterSpacing: 0.6,
    },
    receiptBrandSub: {
      fontSize: 10,
      color: theme.muted,
      fontWeight: "500",
    },
    receiptCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "#F1F5F9",
      alignItems: "center",
      justifyContent: "center",
    },
    receiptScrollContent: {
      padding: 18,
      paddingBottom: 28,
    },
    receiptTitleBlock: {
      alignItems: "center",
      marginBottom: 14,
    },
    receiptDocumentTitle: {
      fontSize: 17,
      fontWeight: "900",
      letterSpacing: 0.8,
      color: theme.textPrimary,
      marginBottom: 8,
    },
    receiptBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1,
      marginBottom: 10,
      gap: 6,
    },
    receiptBadgeApproved: {
      backgroundColor: "rgba(2, 132, 199, 0.12)",
      borderColor: "rgba(2, 132, 199, 0.35)",
    },
    receiptBadgePickedUp: {
      backgroundColor: "rgba(16, 185, 129, 0.12)",
      borderColor: "rgba(16, 185, 129, 0.35)",
    },
    receiptStatusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    receiptBadgeText: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.4,
    },
    slipPillBox: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: isDarkMode ? "#132337" : "#F1F5F9",
      gap: 6,
    },
    receiptNumberText: {
      fontSize: 11,
      fontWeight: "700",
      color: isDarkMode ? "#CBD5E1" : "#475569",
      letterSpacing: 0.5,
    },
    ticketDividerContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 14,
      position: "relative",
    },
    ticketNotchLeft: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: "rgba(15, 23, 42, 0.75)",
      marginLeft: -25,
    },
    ticketNotchRight: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: "rgba(15, 23, 42, 0.75)",
      marginRight: -25,
    },
    receiptDashedLine: {
      flex: 1,
      borderBottomWidth: 1,
      borderStyle: "dashed",
      borderColor: isDarkMode ? "#1E324A" : "#CBD5E1",
      marginHorizontal: 8,
    },
    receiptSection: {
      marginBottom: 14,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 8,
    },
    receiptSectionHeader: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.6,
      color: theme.primary,
    },
    receiptBookCard: {
      padding: 14,
      borderRadius: 14,
      backgroundColor: isDarkMode ? "#101F33" : "#F8FAFC",
      borderWidth: 1,
      borderColor: isDarkMode ? "#1E324A" : "#E2E8F0",
    },
    receiptBookTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.textPrimary,
      marginBottom: 4,
    },
    receiptAuthorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginBottom: 10,
    },
    receiptAuthorText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.muted,
    },
    receiptTagRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    receiptMetaTag: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      gap: 4,
    },
    receiptMetaTagText: {
      fontSize: 11,
      fontWeight: "700",
    },
    receiptDateGrid: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 10,
    },
    receiptDateBox: {
      flex: 1,
      padding: 12,
      borderRadius: 12,
      backgroundColor: isDarkMode ? "#101F33" : "#F8FAFC",
      borderWidth: 1,
      borderColor: isDarkMode ? "#1E324A" : "#E2E8F0",
    },
    dateBoxHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginBottom: 4,
    },
    receiptDateBoxLabel: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.muted,
      letterSpacing: 0.3,
    },
    receiptDateBoxValue: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.textPrimary,
    },
    receiptDueHeroCard: {
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      backgroundColor: isDarkMode ? "rgba(2, 116, 187, 0.10)" : "#F0F9FF",
      borderColor: isDarkMode ? "#0284C7" : "#BAE6FD",
    },
    dueHeroTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    dueHeroLabelGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    dueHeroTitle: {
      fontSize: 11,
      fontWeight: "900",
      color: isDarkMode ? "#38BDF8" : "#0284C7",
      letterSpacing: 0.4,
    },
    dueHeroStatusPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: "rgba(2, 132, 199, 0.15)",
    },
    dueHeroStatusPillText: {
      fontSize: 10,
      fontWeight: "800",
      color: isDarkMode ? "#38BDF8" : "#0284C7",
    },
    dueHeroDateValue: {
      fontSize: 20,
      fontWeight: "900",
      color: isDarkMode ? "#38BDF8" : "#0369A1",
      marginBottom: 6,
      letterSpacing: 0.5,
    },
    dueHeroNoticeRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
    },
    dueHeroNoticeText: {
      fontSize: 11,
      color: isDarkMode ? "#94A3B8" : "#64748B",
      flex: 1,
      lineHeight: 15,
    },
    receiptBorrowerCard: {
      padding: 14,
      borderRadius: 14,
      backgroundColor: isDarkMode ? "#101F33" : "#F8FAFC",
      borderWidth: 1,
      borderColor: isDarkMode ? "#1E324A" : "#E2E8F0",
    },
    borrowerInfoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    borrowerAvatarBox: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDarkMode ? "#1E324A" : "#E2E8F0",
      alignItems: "center",
      justifyContent: "center",
    },
    borrowerNameText: {
      fontSize: 15,
      fontWeight: "800",
      color: theme.textPrimary,
      marginBottom: 5,
    },
    borrowerPillRow: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
    },
    borrowerPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    borrowerPillText: {
      fontSize: 11,
      fontWeight: "700",
    },
    receiptVerifiedBadgeContainer: {
      alignItems: "center",
      marginVertical: 10,
    },
    qrVerifiedBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: "rgba(16, 185, 129, 0.08)",
      borderWidth: 1,
      borderColor: "rgba(16, 185, 129, 0.25)",
      gap: 6,
    },
    qrVerifiedBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#10B981",
    },
    receiptActionWrapper: {
      marginTop: 10,
      gap: 10,
    },
    receiptPickupBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#10B981",
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 14,
      elevation: 4,
      shadowColor: "#10B981",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
    },
    pickupBtnTextCol: {
      alignItems: "center",
    },
    receiptPickupBtnText: {
      fontSize: 16,
      fontWeight: "900",
      color: "#FFFFFF",
      letterSpacing: 0.4,
    },
    receiptPickupBtnSub: {
      fontSize: 11,
      color: "rgba(255, 255, 255, 0.85)",
      fontWeight: "600",
      marginTop: 1,
    },
    receiptPickupBtnPicked: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDarkMode ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5",
      borderWidth: 1.5,
      borderColor: "#10B981",
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 14,
    },
    receiptPickupBtnPickedText: {
      fontSize: 15,
      fontWeight: "900",
      color: "#10B981",
    },
    receiptPickupBtnPickedSub: {
      fontSize: 11,
      color: isDarkMode ? "#6EE7B7" : "#059669",
      fontWeight: "600",
      marginTop: 1,
    },
    receiptCloseSecondaryBtn: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.primaryLine,
      backgroundColor: theme.iconNeutralBg,
    },
    receiptCloseSecondaryText: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.muted,
    },
  });
