import { getUniqueBookCover } from "../../data/bookCovers";
import { BookCoverImage } from "../../components/BookCoverImage";
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Modal,
  Animated,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimatedScreen from "../../components/AnimatedScreen";

import {
  Feather,
  Ionicons,
  MaterialCommunityIcons,
  FontAwesome5,
} from "@expo/vector-icons";

import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../data/AuthContext";
import { useThemeColors } from "../../hooks/useThemeColors";
import {
  getAnnouncements,
  subscribe,
  syncAnnouncementsWithBackend,
  AnnouncementItem,
  getUpcomingReservations,
  getReservationHistory,
  ReservationBook,
  getNotifications,
  syncNotifications,
  NotificationItem,
  setBooksTabOverride,
  getLibraryPoints,
  saveSearchQuery,
  setCachedAllBooks,
  getCachedAllBooks,
  getPersonalizedRecommendedBooks,
  getLibraryCardHistory,
  getActiveBorrowCount,
  getActiveReservationCount,
  getBorrowedBooks,
  getReservedBooks,
  syncTransactionsWithBackend,
  getStudentProfile,
} from "../../data/store";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import { API_URL, getAuthHeaders } from "../../data/authService";
import localBooks from "../../data/books";
import socketService from "../../services/socketService";

const STOP_WORDS_SET = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "as", "at", 
  "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can", "did", "do", 
  "does", "doing", "don", "down", "during", "each", "few", "for", "from", "further", "had", "has", "have", 
  "having", "he", "her", "here", "hers", "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it", 
  "its", "itself", "just", "me", "more", "most", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", 
  "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she", "should", "so", "some", 
  "such", "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there", "these", "they", 
  "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "were", "what", "when", 
  "where", "which", "while", "who", "whom", "why", "with", "you", "your", "yours", "yourself", "yourselves",
  "find", "me", "book", "books", "show", "search", "get", "read", "want", "please", "library", "recommend",
  "similar", "file", "files", "document", "documents", "handout", "handouts", "pdf", "handout01",
  "syllabus", "notes", "attached", "upload", "uploaded", "paper", "copy", "related", "like"
]);

export const extractFileKeywords = async (file: { name: string; uri?: string; mimeType?: string }): Promise<string[]> => {
  if (!file || !file.name) return [];

  const nameKeywords = file.name
    .replace(/\.[^/.]+$/, "")
    .split(/[\s_.\-\/\(\)\[\]]+/)
    .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 1 && !STOP_WORDS_SET.has(w));

  // Academic Course Code Knowledge Base Heuristics
  const academicHeuristics: string[] = [];
  const fileNameLower = file.name.toLowerCase();
  if (fileNameLower.includes("euthenics") || fileNameLower.includes("euth")) {
    academicHeuristics.push("euthenics", "ethics", "values", "personality", "character", "attitude", "happiness");
  } else if (fileNameLower.includes("nstp") || fileNameLower.includes("cwts") || fileNameLower.includes("rotc")) {
    academicHeuristics.push("nstp", "civic", "community", "citizenship", "philippines");
  } else if (fileNameLower.includes("algo") || fileNameLower.includes("data_struct") || fileNameLower.includes("dsa")) {
    academicHeuristics.push("data", "structures", "algorithms", "programming");
  } else if (fileNameLower.includes("cyber") || fileNameLower.includes("security")) {
    academicHeuristics.push("cybersecurity", "security", "cryptography", "network");
  }

  let textContentKeywords: string[] = [];

  try {
    const isTextFile =
      file.mimeType?.includes("text") ||
      file.mimeType?.includes("json") ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".csv") ||
      file.name.endsWith(".json") ||
      file.name.endsWith(".md");

    if (isTextFile && file.uri) {
      const response = await fetch(file.uri);
      const text = await response.text();
      textContentKeywords = text
        .split(/[\s,.:;!?'"()\[\]\/-]+/)
        .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ""))
        .filter((w) => w.length > 2 && !STOP_WORDS_SET.has(w))
        .slice(0, 40);
    }
  } catch (e) {
    console.log("Error reading file text content:", e);
  }

  return Array.from(new Set([...nameKeywords, ...academicHeuristics, ...textContentKeywords]));
};

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const formatDateTime = (date: Date) => {
  const month = monthNames[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  let hours = date.getHours();

  const minutes = date
    .getMinutes()
    .toString()
    .padStart(2, "0");

  const ampm = hours >= 12 ? "PM" : "AM";

  hours = hours % 12 || 12;

  return `${month} ${day}, ${year} • ${hours}:${minutes} ${ampm}`;
};

const formatSafeAnnouncementDate = (dateVal?: any): string => {
  if (!dateVal) return "Recently";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "Recently";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "as", "at", 
  "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can", "did", "do", 
  "does", "doing", "don", "down", "during", "each", "few", "for", "from", "further", "had", "has", "have", 
  "having", "he", "her", "here", "hers", "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it", 
  "its", "itself", "just", "me", "more", "most", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", 
  "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she", "should", "so", "some", 
  "such", "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there", "these", "they", 
  "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "were", "what", "when", 
  "where", "which", "while", "who", "whom", "why", "with", "you", "your", "yours", "yourself", "yourselves",
  "find", "me", "book", "books", "show", "search", "get", "read", "want", "please", "library", "recommend",
  "recommended", "looking", "for", "about", "describe", "detail", "details", "analyse", "analyze"
]);

function getCategoryThemedPalette(category?: string, title?: string, isDarkMode: boolean = false) {
  const norm = ((category || "") + " " + (title || "")).toLowerCase();

  if (
    norm.includes("tech") ||
    norm.includes("computer") ||
    norm.includes("algorithm") ||
    norm.includes("program") ||
    norm.includes("data") ||
    norm.includes("network") ||
    norm.includes("software") ||
    norm.includes("code") ||
    norm.includes("systems")
  ) {
    return {
      bg: isDarkMode ? "#082F49" : "#E0F2FE",
      spine: "#0284C7",
      ribbon: "#38BDF8",
      border: isDarkMode ? "#0C4A6E" : "#BAE6FD",
      iconBg: isDarkMode ? "rgba(56, 189, 248, 0.22)" : "rgba(2, 132, 199, 0.12)",
      iconColor: isDarkMode ? "#38BDF8" : "#0284C7",
      iconName: "code-tags" as const,
      tag: "TECH",
    };
  }
  if (
    norm.includes("fiction") ||
    norm.includes("novel") ||
    norm.includes("literature") ||
    norm.includes("story") ||
    norm.includes("wayward") ||
    norm.includes("harry") ||
    norm.includes("fantasy")
  ) {
    return {
      bg: isDarkMode ? "#2E1065" : "#F3E8FF",
      spine: "#7C3AED",
      ribbon: "#C084FC",
      border: isDarkMode ? "#4C1D95" : "#DDD6FE",
      iconBg: isDarkMode ? "rgba(192, 132, 252, 0.22)" : "rgba(124, 58, 237, 0.12)",
      iconColor: isDarkMode ? "#C084FC" : "#7C3AED",
      iconName: "feather" as const,
      tag: "FICTION",
    };
  }
  if (
    norm.includes("filipiniana") ||
    norm.includes("philippine") ||
    norm.includes("rizal") ||
    norm.includes("history") ||
    norm.includes("tagalog")
  ) {
    return {
      bg: isDarkMode ? "#451A03" : "#FEF3C7",
      spine: "#D97706",
      ribbon: "#FCD400",
      border: isDarkMode ? "#78350F" : "#FDE68A",
      iconBg: isDarkMode ? "rgba(252, 212, 0, 0.22)" : "rgba(217, 119, 6, 0.12)",
      iconColor: isDarkMode ? "#FCD400" : "#D97706",
      iconName: "bank" as const,
      tag: "FILIPINIANA",
    };
  }
  if (
    norm.includes("periodical") ||
    norm.includes("magazine") ||
    norm.includes("journal") ||
    norm.includes("news")
  ) {
    return {
      bg: isDarkMode ? "#134E4A" : "#CCFBF1",
      spine: "#0D9488",
      ribbon: "#2DD4BF",
      border: isDarkMode ? "#115E59" : "#99F6E4",
      iconBg: isDarkMode ? "rgba(45, 212, 191, 0.22)" : "rgba(13, 148, 136, 0.12)",
      iconColor: isDarkMode ? "#2DD4BF" : "#0D9488",
      iconName: "newspaper-variant-outline" as const,
      tag: "PERIODICAL",
    };
  }
  if (
    norm.includes("math") ||
    norm.includes("science") ||
    norm.includes("physics") ||
    norm.includes("biology") ||
    norm.includes("chemistry") ||
    norm.includes("calculus") ||
    norm.includes("discrete")
  ) {
    return {
      bg: isDarkMode ? "#064E3B" : "#D1FAE5",
      spine: "#059669",
      ribbon: "#34D399",
      border: isDarkMode ? "#065F46" : "#A7F3D0",
      iconBg: isDarkMode ? "rgba(52, 211, 153, 0.22)" : "rgba(5, 150, 105, 0.12)",
      iconColor: isDarkMode ? "#34D399" : "#059669",
      iconName: "atom" as const,
      tag: "SCIENCE",
    };
  }
  if (
    norm.includes("reference") ||
    norm.includes("encyclopedia") ||
    norm.includes("dictionary") ||
    norm.includes("general")
  ) {
    return {
      bg: isDarkMode ? "#1E1B4B" : "#EEF2FF",
      spine: "#4F46E5",
      ribbon: "#818CF8",
      border: isDarkMode ? "#312E81" : "#C7D2FE",
      iconBg: isDarkMode ? "rgba(129, 140, 248, 0.22)" : "rgba(79, 70, 229, 0.12)",
      iconColor: isDarkMode ? "#818CF8" : "#4F46E5",
      iconName: "book-open-page-variant" as const,
      tag: "REFERENCE",
    };
  }
  if (
    norm.includes("special") ||
    norm.includes("archive") ||
    norm.includes("rare")
  ) {
    return {
      bg: isDarkMode ? "#3B0764" : "#FDF4FF",
      spine: "#9333EA",
      ribbon: "#E879F9",
      border: isDarkMode ? "#581C87" : "#F5D0FE",
      iconBg: isDarkMode ? "rgba(232, 121, 249, 0.22)" : "rgba(147, 51, 234, 0.12)",
      iconColor: isDarkMode ? "#E879F9" : "#9333EA",
      iconName: "star-four-points" as const,
      tag: "SPECIAL",
    };
  }

  // Default Circulation
  return {
    bg: isDarkMode ? "#0E1729" : "#F0F7FF",
    spine: "#0274BB",
    ribbon: "#FCD400",
    border: isDarkMode ? "#1E2E47" : "#BAE6FD",
    iconBg: isDarkMode ? "rgba(2, 116, 187, 0.22)" : "rgba(2, 116, 187, 0.1)",
    iconColor: isDarkMode ? "#60A5FA" : "#0274BB",
    iconName: "book-open-outline" as const,
    tag: "BOOK",
  };
}

function getCategoryGenreColor(genreOrCategory?: string, isDarkMode: boolean = true): string {
  if (!genreOrCategory) return isDarkMode ? "#94A3B8" : "#64748B";
  const norm = genreOrCategory.toLowerCase();
  if (norm.includes("fiction") && !norm.includes("non")) {
    return isDarkMode ? "#14B8A6" : "#0D9488"; // teal/emerald
  }
  if (norm.includes("children") || norm.includes("young") || norm.includes("adult")) {
    return isDarkMode ? "#818CF8" : "#6366F1"; // lavender/indigo
  }
  if (norm.includes("art") || norm.includes("folk") || norm.includes("folklore")) {
    return isDarkMode ? "#F59E0B" : "#D97706"; // amber
  }
  if (norm.includes("play") || norm.includes("media") || norm.includes("game")) {
    return isDarkMode ? "#FB7185" : "#E11D48"; // rose
  }
  if (norm.includes("history") || norm.includes("social")) {
    return isDarkMode ? "#F59E0B" : "#D97706"; // amber
  }
  if (norm.includes("periodical") || norm.includes("journal") || norm.includes("news")) {
    return isDarkMode ? "#0D9488" : "#0F766E"; // teal
  }
  if (norm.includes("special") || norm.includes("reserve")) {
    return isDarkMode ? "#C084FC" : "#9333EA"; // purple
  }
  if (norm.includes("general") || norm.includes("collection")) {
    return isDarkMode ? "#F59E0B" : "#D97706"; // amber
  }
  if (norm.includes("science") || norm.includes("tech")) {
    return isDarkMode ? "#38BDF8" : "#0284C7"; // sky blue
  }
  return isDarkMode ? "#94A3B8" : "#64748B";
}

function getBookCoverBadge(book: any, categoryTitle?: string): string | null {
  if (!book) return null;
  const catLower = (categoryTitle || "").toLowerCase();
  if (catLower.includes("new")) {
    return "New";
  }
  if (catLower.includes("recommended")) {
    return "Top Pick";
  }
  if (catLower.includes("filipiniana")) {
    return "Heritage";
  }
  if (catLower.includes("special")) {
    return "Special";
  }
  if (catLower.includes("circulation")) {
    if (book.edition && book.edition !== "Single Edition / None") {
      return "Edition";
    }
    return "General";
  }
  if (book.edition && book.edition !== "Single Edition / None") {
    return "Edition";
  }
  if (book.category && book.category.length < 15) {
    return book.category;
  }
  return null;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const profile = React.useMemo(() => getStudentProfile(), []);
  const studentDisplayName = user?.fullName || profile?.name || "Student";
  const avatarUri = user?.avatar || profile?.avatar || "";
  const hasValidAvatar = Boolean(avatarUri && avatarUri.trim().length > 0);

  const [announcements, setAnnouncements] = React.useState<AnnouncementItem[]>(
    getAnnouncements()
  );
  const [selectedAnnouncement, setSelectedAnnouncement] = React.useState<AnnouncementItem | null>(null);

  const [activeReservations, setActiveReservations] = React.useState<ReservationBook[]>(
    getUpcomingReservations()
  );
  const [libraryCardBooks, setLibraryCardBooks] = React.useState<ReservationBook[]>(
    getLibraryCardHistory()
  );
  const [borrowHistory, setBorrowHistory] = React.useState<ReservationBook[]>(
    getReservationHistory()
  );
  const [notifications, setNotifications] = React.useState<NotificationItem[]>(
    getNotifications()
  );
  const [libraryPoints, setLibraryPoints] = React.useState<number>(getLibraryPoints());

  const dismissedAnnouncementsRef = React.useRef<Set<string>>(new Set());
  const checkedAnnouncementIdRef = React.useRef<string | null>(null);

  const dismissAnnouncementModal = React.useCallback(() => {
    setSelectedAnnouncement((prev) => {
      if (prev === null) return null;
      if (prev.id) {
        dismissedAnnouncementsRef.current.add(prev.id);
        AsyncStorage.setItem(`@seen_ann_popup_${prev.id}`, "true").catch(() => {});
      }
      return null;
    });
  }, []);

  React.useEffect(() => {
    setAnnouncements(getAnnouncements());
    setActiveReservations(getUpcomingReservations());
    setLibraryCardBooks(getLibraryCardHistory());
    setBorrowHistory(getReservationHistory());
    setNotifications(getNotifications());
    setLibraryPoints(getLibraryPoints());
    void syncAnnouncementsWithBackend(false);
    void syncTransactionsWithBackend(false).then(() => {
      setActiveReservations(getUpcomingReservations());
      setLibraryCardBooks(getLibraryCardHistory());
      setBorrowHistory(getReservationHistory());
    });

    const unsubscribe = subscribe(() => {
      setAnnouncements(getAnnouncements());
      setActiveReservations(getUpcomingReservations());
      setLibraryCardBooks(getLibraryCardHistory());
      setBorrowHistory(getReservationHistory());
      setNotifications(getNotifications());
      setLibraryPoints(getLibraryPoints());
    });

    const unsubReturn = socketService.subscribeToReturn(() => {
      setLibraryCardBooks(getLibraryCardHistory());
      setActiveReservations(getUpcomingReservations());
    });

    const unsubDecided = socketService.subscribeToTransactionDecided(() => {
      setActiveReservations(getUpcomingReservations());
      setLibraryCardBooks(getLibraryCardHistory());
      setNotifications(getNotifications());
    });

    // Poll notifications & announcements every 15 seconds to sync in real-time
    const interval = setInterval(() => {
      void syncNotifications(false);
      void syncAnnouncementsWithBackend(false);
    }, 15000);

    return () => {
      unsubscribe();
      unsubReturn();
      unsubDecided();
      clearInterval(interval);
    };
  }, []);

  // Automatically pop up fresh unread announcement when student opens screen or announcements update
  React.useEffect(() => {
    if (announcements.length > 0) {
      const latest = announcements[0];
      if (!latest || !latest.id) return;
      if (checkedAnnouncementIdRef.current === latest.id || dismissedAnnouncementsRef.current.has(latest.id)) {
        return;
      }
      checkedAnnouncementIdRef.current = latest.id;
      AsyncStorage.getItem(`@seen_ann_popup_${latest.id}`)
        .then((seen) => {
          if (!seen && !dismissedAnnouncementsRef.current.has(latest.id)) {
            setSelectedAnnouncement(latest);
          }
        })
        .catch(() => {});
    }
  }, [announcements]);

  // Real-time socket event: automatically POP UP announcement when published live!
  React.useEffect(() => {
    const unsubAnn = socketService.subscribeToAnnouncementPublished((data: any) => {
      if (data && data.title) {
        const item: AnnouncementItem = {
          id: String(data.id || `ann-${Date.now()}`),
          title: data.title,
          content: data.content || "",
          priority: data.priority || "Normal",
          author: data.author || "BookHive Administration",
          updatedAt: data.updatedAt || new Date().toISOString(),
        };
        setSelectedAnnouncement(item);
        void syncAnnouncementsWithBackend(true);
      }
    });

    return () => {
      unsubAnn();
    };
  }, []);

  // Instant Stale-While-Revalidate initial catalog hydration
  const initialLocalBooks = React.useMemo(() => {
    const cached = getCachedAllBooks();
    if (Array.isArray(cached) && cached.length > 0) return cached;
    if (Array.isArray(localBooks) && localBooks.length > 0) {
      return localBooks.slice(0, 100).map((book: any, idx: number) => {
        const charSum = book.title ? book.title.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) : 0;
        const pseudoRating = (4.2 + (charSum % 8) / 10).toFixed(1);
        const dept = book.department || "Circulation";
        return {
          id: String(book.id || `book-${idx}`),
          title: book.title || "STI Library Resource",
          author: book.author || "Unknown Author",
          rating: (book.rating && Number(book.rating) > 0) ? String(book.rating) : String(pseudoRating),
          category: book.genres || book.category || dept,
          department: dept,
          isbn: book.isbn || "",
          shelf: book.shelfLocation || book.shelf || "CIR-01A.1",
          available: String(book.availableCopies !== undefined ? book.availableCopies > 0 : (book.availability === "Available" || book.availability === "true" || book.status === "Available" || book.status !== "Unavailable" || book.available !== false)),
          status: book.status || (book.available === false ? "Unavailable" : "Available"),
          year: book.publicationDate ? String(book.publicationDate).substring(0, 4) : (book.year ? String(book.year) : "2024"),
          publicationDate: book.publicationDate || (book.year ? `${book.year}-01-01` : "2024-01-01"),
          pages: String(book.pages && book.pages > 0 ? book.pages : "320"),
          language: book.language || "EN",
          description: book.summary || book.description || "",
          coverImage: book.coverUrl || book.coverImage || book.cover || getUniqueBookCover(book),
          copies: String(book.copies !== undefined && book.copies !== null ? book.copies : 1),
          volume: book.volume || "Single Volume / None",
          edition: book.edition || "Single Edition / None",
          accessionNumber: book.accessionNumber || "",
        };
      });
    }
    return [];
  }, []);

  const [allBooks, setAllBooks] = React.useState<any[]>(initialLocalBooks);
  const [newArrivals, setNewArrivals] = React.useState<any[]>(initialLocalBooks);
  const [isLoadingBooks, setIsLoadingBooks] = React.useState<boolean>(() => initialLocalBooks.length === 0);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);
  const [activeCarouselIndex, setActiveCarouselIndex] = React.useState<number>(0);
  const [liveBanner, setLiveBanner] = React.useState<{ title: string; body: string } | null>(null);

  // Synchronized default trending books (matches Web System dashboard topBooks)
  const [trendingBooks, setTrendingBooks] = React.useState<any[]>([
    {
      id: "b6cc6355-b6ed-49e3-91a9-60c99c8025bb-1",
      title: "Wayward Son",
      author: "Rainbow Rowell (Goodreads Author), Jim Tierney (Illustrator)",
      rating: "4.5",
      category: "Circulation",
      isbn: "9781250146076",
      shelf: "CIR-26B.8",
      available: "true",
      year: "2019",
      pages: "368",
      language: "EN",
      description: "Wayward Son is the spellbinding sequel to Carry On.",
      department: "Circulation",
      coverImage: getUniqueBookCover("Wayward Son", "Tom Pollack"),
      borrowCount: 1,
    },
    {
      id: "b6cc6355-b6ed-49e3-91a9-60c99c8025bb-2",
      title: "Yana Brich Daily Life",
      author: "Brich",
      rating: "5.0",
      category: "Filipiniana",
      isbn: "912-123456789",
      shelf: "FIL 899.2 .B94y 2026",
      available: "true",
      year: "2026",
      pages: "120",
      language: "Filipino",
      description: "A daily life of Yana and Brich together.",
      department: "Filipiniana",
      coverImage: getUniqueBookCover("Yana Brich Daily Life", "Brich"),
      borrowCount: 1,
    },
    {
      id: "b6cc6355-b6ed-49e3-91a9-60c99c8025bb-3",
      title: "Brichoox Gaming Experience",
      author: "Brich",
      rating: "4.0",
      category: "Special Collections",
      isbn: "912-234567890",
      shelf: "SPE 090 .B94b 2026 v.10 ed.10",
      available: "true",
      year: "2026",
      pages: "90",
      language: "English",
      description: "A Girl sharing her experience playing MLBB",
      department: "Special Collections",
      coverImage: getUniqueBookCover("Brichoox Gaming Experience", "Brich"),
      borrowCount: 1,
    },
    {
      id: "b6cc6355-b6ed-49e3-91a9-60c99c8025bb-4",
      title: "Charmed",
      author: "Michelle Krys (Goodreads Author)",
      rating: "4.5",
      category: "Circulation",
      isbn: "9780385743433",
      shelf: "CIR-20B.6",
      available: "true",
      year: "2014",
      pages: "320",
      language: "EN",
      description: "Set in a gripping modern world of witchcraft and intrigue.",
      department: "Circulation",
      coverImage: getUniqueBookCover("Charmed", "Michelle Krys"),
      borrowCount: 1,
    },
    {
      id: "b6cc6355-b6ed-49e3-91a9-60c99c8025bb-5",
      title: "Gio",
      author: "Elizabeth Reyes (Goodreads Author)",
      rating: "4.5",
      category: "Circulation",
      isbn: "9780985926526",
      shelf: "CIR-09C.3",
      available: "true",
      year: "2012",
      pages: "320",
      language: "EN",
      description: "A compelling romance novel by Elizabeth Reyes.",
      department: "Circulation",
      coverImage: getUniqueBookCover("Gio", "Elizabeth Reyes"),
      borrowCount: 1,
    },
  ]);

  const allBooksRef = React.useRef(allBooks);
  allBooksRef.current = allBooks;
  const trendingBooksRef = React.useRef(trendingBooks);
  trendingBooksRef.current = trendingBooks;

  const fetchBooksPayload = React.useCallback(async (forceLoading = false) => {
    // Only show full loading spinner if there are no books currently rendered
    if (forceLoading && allBooksRef.current.length === 0) {
      setIsLoadingBooks(true);
    }
    try {
      const headers = await getAuthHeaders();
      const client = axios.create({ timeout: 8000 });

      // Parallel non-blocking requests for both trending books and catalog
      const [trendingPromise, booksPromise] = await Promise.allSettled([
        client.get(`${API_URL}/api/trending-books`, headers).catch(() => client.get(`${API_URL}/api/dashboard`, headers)),
        client.get(`${API_URL}/api/books?limit=100`, headers).catch(() => client.get(`${API_URL}/api/student/books?limit=100`, headers)),
      ]);

      let trendingArray: any[] = [];
      let booksArray: any[] = [];

      if (trendingPromise.status === "fulfilled" && trendingPromise.value?.data) {
        const tData = trendingPromise.value.data;
        if (Array.isArray(tData.books)) trendingArray = tData.books;
        else if (Array.isArray(tData.topBooks)) trendingArray = tData.topBooks;
      }

      if (booksPromise.status === "fulfilled" && booksPromise.value?.data) {
        const bData = booksPromise.value.data;
        if (Array.isArray(bData.books)) booksArray = bData.books;
      }

      let mappedBooks: any[] = [];
      if (Array.isArray(booksArray) && booksArray.length > 0) {
        mappedBooks = booksArray.map((book: any, idx: number) => {
          const charSum = book.title ? book.title.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) : 0;
          const pseudoRating = (4.2 + (charSum % 8) / 10).toFixed(1);
          return {
            id: String(book.id || `book-${idx}`),
            title: book.title || "Untitled Book",
            author: book.author || "Unknown Author",
            rating: (book.rating && Number(book.rating) > 0) ? String(book.rating) : String(pseudoRating),
            category: book.genres || book.category || book.department || "Circulation",
            department: book.department || "Circulation",
            isbn: book.isbn || "",
            shelf: book.shelfLocation || book.shelf || "CIR-01A.1",
            available: String(book.availableCopies !== undefined ? book.availableCopies > 0 : (book.availability === "Available" || book.availability === "true" || book.status === "Available" || book.status !== "Unavailable")),
            year: book.publicationDate ? String(book.publicationDate).substring(0, 4) : (book.year ? String(book.year) : "2026"),
            publicationDate: book.publicationDate || (book.year ? `${book.year}-01-01` : "2026-09-01"),
            pages: String(book.pages && book.pages > 0 ? book.pages : "320"),
            language: book.language || "EN",
            description: book.summary || book.description || "",
            coverImage: book.coverUrl || book.coverImage || book.cover || book.imageUrl || book.image || getUniqueBookCover(book),
            copies: String(book.copies !== undefined && book.copies !== null ? book.copies : 1),
            volume: book.volume || "Single Volume / None",
            edition: book.edition || "Single Edition / None",
            accessionNumber: book.accessionNumber || "",
          };
        });
      }

      if (mappedBooks.length > 0) {
        setAllBooks(mappedBooks);
        setCachedAllBooks(mappedBooks);
        setNewArrivals(mappedBooks);
      } else if (allBooksRef.current.length === 0 && Array.isArray(localBooks) && localBooks.length > 0) {
        const fallback = localBooks.slice(0, 100).map((book: any, idx: number) => {
          const charSum = book.title ? book.title.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) : 0;
          const pseudoRating = (4.2 + (charSum % 8) / 10).toFixed(1);
          const dept = book.department || "General";
          return {
            id: `local-book-${idx}`,
            title: book.title,
            author: book.author,
            description: book.description || "",
            year: String(book.year || "2024"),
            pages: String(book.pages || "320"),
            language: "EN",
            category: dept,
            department: dept,
            rating: String(pseudoRating),
            shelf: "General Shelf",
            available: String(book.available !== false),
            coverImage: null,
          };
        });
        setAllBooks(fallback);
        setCachedAllBooks(fallback);
        setNewArrivals(fallback);
      }

      // Process Trending Books (synced with Web System topBooks)
      if (Array.isArray(trendingArray) && trendingArray.length > 0) {
        const mappedTrending = trendingArray.map((book: any, idx: number) => {
          const charSum = book.title ? book.title.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) : 0;
          const pseudoRating = (4.5 + (charSum % 5) / 10).toFixed(1);
          const totalCopies = Math.max(1, Number(book.copies || book.totalCopies || 1));
          const availableCopies = book.availableCopies !== undefined && book.availableCopies !== null && !isNaN(Number(book.availableCopies))
            ? Number(book.availableCopies)
            : (book.availability ? (book.availability.toLowerCase() === "available" ? totalCopies : 0) : totalCopies);
          const isAvail = availableCopies > 0;
          return {
            id: String(book.id || `trending-${idx}`),
            title: book.title || "Untitled Book",
            author: book.author || "STI Library",
            rating: (book.rating && Number(book.rating) > 0) ? String(book.rating) : String(pseudoRating),
            category: book.genres || book.category || book.department || "Trending",
            department: book.department || "Circulation",
            isbn: book.isbn || "",
            shelf: book.shelfLocation || book.shelf || "CIR-01A.1",
            available: String(isAvail),
            status: isAvail ? "Available" : (book.status || book.availability || "Unavailable"),
            availability: isAvail ? "Available" : (book.status || book.availability || "Unavailable"),
            availableCopies,
            totalCopies,
            borrowedCount: Number(book.borrowedCount || 0),
            unavailableCopies: Number(book.unavailableCopies || Math.max(0, totalCopies - availableCopies)),
            reservedCount: Number(book.reservedCount || 0),
            year: book.publicationDate ? String(book.publicationDate).substring(0, 4) : "2026",
            publicationDate: book.publicationDate || "2026-09-01",
            pages: String(book.pages && book.pages > 0 ? book.pages : "320"),
            language: book.language || "English",
            description: book.summary || book.description || "",
            coverImage: book.coverImg || book.coverUrl || book.coverImage || getUniqueBookCover(book),
            copies: String(totalCopies),
            volume: book.volume || "Single Volume / None",
            edition: book.edition || "Single Edition / None",
            accessionNumber: book.accessionNumber || "",
            borrowCount: Number(book.borrowCount || book.borrows || 0),
          };
        });
        setTrendingBooks(mappedTrending.slice(0, 5));
      } else if (mappedBooks.length > 0 && trendingBooksRef.current.length === 0) {
        setTrendingBooks(mappedBooks.slice(0, 5));
      }
    } catch (error) {
      console.log("Error fetching books payload:", error);
    } finally {
      setIsLoadingBooks(false);
    }
  }, []);

  // Real-time socket updates: automatically refresh when new books are added or borrowed
  React.useEffect(() => {
    const unsubBookAdded = socketService.subscribeToBookAdded(() => {
      void fetchBooksPayload();
    });
    const unsubBorrow = socketService.subscribeToBorrowRequest(() => {
      void fetchBooksPayload();
    });

    return () => {
      unsubBookAdded();
      unsubBorrow();
    };
  }, [fetchBooksPayload]);

  const getCategoryBooks = React.useCallback((categoryName: string) => {
    if (!allBooks || allBooks.length === 0) return [];
    const nameLower = categoryName.toLowerCase().trim();

    if (nameLower === "new arrivals" || nameLower === "new arrival") {
      return (newArrivals.length > 0 ? newArrivals : allBooks).slice(0, 20);
    }

    if (nameLower === "recommended books" || nameLower === "recommended") {
      return getPersonalizedRecommendedBooks(allBooks, 8, {
        userCourse: user?.course || user?.department,
      });
    }

    if (nameLower === "circulation") {
      const filtered = allBooks.filter((b) => {
        const dept = (b.department || "").toLowerCase();
        const cat = (b.category || "").toLowerCase();
        return dept.includes("circulation") || cat.includes("fiction") || cat.includes("computer") || cat.includes("science") || cat.includes("engineering") || cat.includes("business");
      });
      return filtered.length > 0 ? filtered.slice(0, 6) : allBooks.slice(0, 6);
    }

    if (nameLower === "general references" || nameLower === "general reference") {
      const filtered = allBooks.filter((b) => {
        const dept = (b.department || "").toLowerCase();
        const cat = (b.category || "").toLowerCase();
        return dept.includes("general") || dept.includes("reference") || cat.includes("reference") || cat.includes("nonfiction") || cat.includes("history") || cat.includes("arts");
      });
      return filtered.length > 0 ? filtered.slice(0, 6) : allBooks.slice(6, 12);
    }

    if (nameLower === "filipiniana") {
      const filtered = allBooks.filter((b) => {
        const dept = (b.department || "").toLowerCase();
        const cat = (b.category || "").toLowerCase();
        const title = (b.title || "").toLowerCase();
        return dept.includes("filipiniana") || cat.includes("filipiniana") || cat.includes("philippine") || title.includes("philippine") || title.includes("ilustrado") || title.includes("rizal");
      });
      return filtered.length > 0 ? filtered.slice(0, 6) : allBooks.slice(12, 18);
    }

    if (nameLower === "periodicals" || nameLower === "periodical") {
      const filtered = allBooks.filter((b) => {
        const dept = (b.department || "").toLowerCase();
        const cat = (b.category || "").toLowerCase();
        const title = (b.title || "").toLowerCase();
        return dept.includes("periodical") || cat.includes("periodical") || cat.includes("journal") || cat.includes("magazine") || title.includes("journal") || title.includes("review");
      });
      return filtered.length > 0 ? filtered.slice(0, 6) : allBooks.slice(18, 24);
    }

    if (nameLower === "special collections" || nameLower === "special collection") {
      const filtered = allBooks.filter((b) => {
        const dept = (b.department || "").toLowerCase();
        const cat = (b.category || "").toLowerCase();
        return dept.includes("special") || dept.includes("reserve") || cat.includes("special") || cat.includes("pedagogy") || cat.includes("education") || cat.includes("rare") || cat.includes("classic");
      });
      return filtered.length > 0 ? filtered.slice(0, 6) : allBooks.slice(24, 30);
    }

    return allBooks.slice(0, 6);
  }, [allBooks]);

  const [searchText, setSearchText] = React.useState("");
  const { isDarkMode, toggleTheme, theme } = useThemeColors();
  const [wordSuggestions, setWordSuggestions] = React.useState<string[]>([]);

  // Pre-populate with base terms + dynamic terms from local books
  const vocabulary = React.useMemo(() => {
    const wordsSet = new Set<string>();
    const baseWords = [
      "Artificial", "Intelligence", "Machine", "Learning", "Data", "Science", "Programming",
      "Cybersecurity", "Networking", "Database", "Systems", "Java", "Python", "Research",
      "Methodology", "Software", "Design", "Development", "Cloud", "Architecture", "Engineering",
      "Entrepreneurship", "Analytics", "Inclusive", "Teaching", "Strategies", "Managerial",
      "Accounting", "Foundations", "Philippine", "Literature", "Contemporary", "Context",
      "Advanced", "Algorithms", "Mechanical", "Principles", "Psychology", "Financial",
      "Management", "Early", "Childhood", "Education", "Structures", "Civil", "Materials",
      "Web", "Mobile", "Security", "Code", "Computer", "Network", "Systems", "Analysis"
    ];
    baseWords.forEach(w => wordsSet.add(w));
    
    // Add words from local catalog (sample 500 books for instant speed)
    if (Array.isArray(localBooks)) {
      localBooks.slice(0, 500).forEach(book => {
        if (book.title) {
          book.title.split(/[^a-zA-Z0-9+#]+/).forEach((w: string) => {
            if (w.length > 2) {
              const capWord = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
              wordsSet.add(capWord);
            }
          });
        }
        if (book.author) {
          book.author.split(/[^a-zA-Z0-9]+/).forEach((w: string) => {
            if (w.length > 2) {
              const capWord = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
              wordsSet.add(capWord);
            }
          });
        }
      });
    }
    
    // Add words from trendingBooks
    if (Array.isArray(trendingBooks)) {
      trendingBooks.forEach(book => {
        if (book.title) {
          book.title.split(/[^a-zA-Z0-9+#]+/).forEach((w: string) => {
            if (w.length > 2) {
              const capWord = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
              wordsSet.add(capWord);
            }
          });
        }
        if (book.author) {
          book.author.split(/[^a-zA-Z0-9]+/).forEach((w: string) => {
            if (w.length > 2) {
              const capWord = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
              wordsSet.add(capWord);
            }
          });
        }
      });
    }
    
    return Array.from(wordsSet);
  }, [trendingBooks]);

  const [selectedFile, setSelectedFile] = React.useState<{
    uri: string;
    name: string;
    size?: number;
    mimeType?: string;
    keywords?: string[];
  } | null>(null);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["*/*"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const keywords = await extractFileKeywords({
          name: file.name,
          uri: file.uri,
          mimeType: file.mimeType,
        });

        const fileObj = {
          uri: file.uri,
          name: file.name,
          size: file.size,
          mimeType: file.mimeType,
          keywords,
        };

        setSelectedFile(fileObj);

        router.push({
          pathname: "/search",
          params: {
            fileName: file.name,
            fileUri: file.uri,
            fileKeywords: keywords.join(","),
          },
        });
      }
    } catch (error) {
      console.log("Home document picking error:", error);
    }
  };

  // Immediate auto-redirection on input typing
  const handleSearchTextChange = (text: string) => {
    if (text.length > 0) {
      const paramsToPass: any = { q: text, autoFocus: "true" };
      if (selectedFile) {
        paramsToPass.fileName = selectedFile.name;
        paramsToPass.fileUri = selectedFile.uri;
        if (selectedFile.keywords && selectedFile.keywords.length > 0) {
          paramsToPass.fileKeywords = selectedFile.keywords.join(",");
        }
      }
      setSearchText("");
      setWordSuggestions([]);
      router.push({
        pathname: "/search",
        params: paramsToPass,
      });
    } else {
      setSearchText(text);
    }
  };

  const handleHomeSearchSubmit = (queryToSearch?: string) => {
    const query = (queryToSearch !== undefined ? queryToSearch : searchText).trim();
    if (query.length > 0 || selectedFile !== null) {
      const paramsToPass: any = { q: query };
      if (selectedFile) {
        paramsToPass.fileName = selectedFile.name;
        paramsToPass.fileUri = selectedFile.uri;
        if (selectedFile.keywords && selectedFile.keywords.length > 0) {
          paramsToPass.fileKeywords = selectedFile.keywords.join(",");
        }
      }
      setSearchText("");
      setSelectedFile(null);
      setWordSuggestions([]);
      router.push({
        pathname: "/search",
        params: paramsToPass,
      });
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    const words = searchText.split(/\s+/);
    if (words.length > 0) {
      words[words.length - 1] = suggestion;
      const newText = words.join(" ").trim();
      setWordSuggestions([]);
      handleHomeSearchSubmit(newText);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const lastFocusFetchTimeRef = React.useRef<number>(0);
  useFocusEffect(
    React.useCallback(() => {
      const now = Date.now();
      // Fast tab switching: avoid re-fetching heavy payload if focused within last 15 seconds
      if (now - lastFocusFetchTimeRef.current > 15000) {
        lastFocusFetchTimeRef.current = now;
        syncAnnouncementsWithBackend(false);
        void syncTransactionsWithBackend(false);
        fetchBooksPayload();
      }
    }, [fetchBooksPayload])
  );

  // Unified active borrow count strictly matching Library Card active borrow ledger
  const activeBorrowedCount = React.useMemo(() => {
    const seenIds = new Set<string>();
    let count = 0;

    const checkItem = (item: ReservationBook) => {
      if (!item || !item.id || seenIds.has(item.id)) return;
      if (item.status === 'Declined' || item.status === 'Cancelled' || item.status === 'Rejected') return;

      const isReturned = !!(
        item.isReturned === true ||
        item.status === 'Completed' ||
        item.status === 'Returned' ||
        item.date === 'Returned' ||
        (item as any).returnedAt
      );
      if (isReturned) return;

      const isReservation = !!(
        item.action === 'Reserve' ||
        (item as any).type === 'Reservation' ||
        item.status === 'Reserved' ||
        item.status === 'Reservation' ||
        (item as any).dueReturnDate === 'Reservation' ||
        item.status === 'Waitlisted'
      );
      if (isReservation) return;

      const isBorrow =
        item.action === 'Borrow' ||
        (item as any).type === 'Borrow' ||
        (item as any).type === 'Borrowing' ||
        (!item.action && !(item as any).type);

      const isActiveStatus =
        item.status === 'Approved' ||
        item.status === 'Picked Up' ||
        item.status === 'On Loan' ||
        item.status === 'Active' ||
        item.status === 'Active Loan' ||
        item.status === 'Due to Return' ||
        item.status === 'Overdue' ||
        item.status === 'Due' ||
        Boolean(item.isPickedUp || item.pickedUpAt);

      if (isBorrow && isActiveStatus) {
        seenIds.add(item.id);
        count++;
      }
    };

    libraryCardBooks.forEach(checkItem);
    borrowHistory.forEach(checkItem);
    activeReservations.forEach(checkItem);
    return count;
  }, [libraryCardBooks, borrowHistory, activeReservations]);

  // Unified active reserved count strictly matching Library Card & Reservations tab
  const activeReservedCount = React.useMemo(() => {
    const seenIds = new Set<string>();
    let count = 0;

    const checkItem = (item: ReservationBook) => {
      if (!item || !item.id || seenIds.has(item.id)) return;
      if (item.status === 'Declined' || item.status === 'Cancelled' || item.status === 'Rejected') return;

      const isReturned = !!(
        item.isReturned === true ||
        item.status === 'Completed' ||
        item.status === 'Returned' ||
        item.date === 'Returned' ||
        (item as any).returnedAt
      );
      if (isReturned) return;

      const isReservation = !!(
        item.action === 'Reserve' ||
        (item as any).type === 'Reservation' ||
        item.status === 'Reserved' ||
        item.status === 'Reservation' ||
        (item as any).dueReturnDate === 'Reservation'
      );

      if (isReservation) {
        seenIds.add(item.id);
        count++;
      }
    };

    libraryCardBooks.forEach(checkItem);
    activeReservations.forEach(checkItem);
    return count;
  }, [libraryCardBooks, activeReservations]);

  React.useEffect(() => {
    const unsubscribe = socketService.subscribeToBookAdded((newBook: any) => {
      if (newBook && newBook.title) {
        setLiveBanner({
          title: "New Book Added to Library Catalog!",
          body: `"${newBook.title}" was added to the STI Library catalog.`,
        });
        fetchBooksPayload();
        setTimeout(() => setLiveBanner(null), 6000);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [fetchBooksPayload]);

  const nextPickupDate = formatDateTime(
    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
  );

  const queuedBook = {
    id: "202",
    title: "Deep Learning Essentials",
    author: "Dr. Samantha Reed",
    description:
      "A detailed guide to modern deep learning techniques, neural networks, and practical implementations for academic and research applications.",
    year: "2025",
    pages: "392",
    language: "EN",
    category: "Computer Science",
    rating: "4.9",
    reviews: "87",
    shelf: "Shelf C-208, 3rd Floor",
    available: "false",
  };

  const getAnnouncementPriorityStyle = (priority: string) => {
    const isUrgent = priority.toLowerCase() === "urgent";
    const isImportant = priority.toLowerCase() === "important";
    
    if (isUrgent) {
      return {
        borderLeftColor: "#EF4444",
        backgroundColor: isDarkMode ? "#1F1315" : "#FEF2F2",
        borderColor: isDarkMode ? "#3F1B1F" : "#FEE2E2",
      };
    }
    if (isImportant) {
      return {
        borderLeftColor: "#F59E0B",
        backgroundColor: isDarkMode ? "#1C1810" : "#FFFBEB",
        borderColor: isDarkMode ? "#3D2C12" : "#FEF3C7",
      };
    }
    return {
      borderLeftColor: "#38BDF8",
      backgroundColor: theme.cardBg,
      borderColor: theme.cardBorder,
    };
  };

  const screenWidth = Dimensions.get("window").width;
  const trendingCardWidth = screenWidth - 32;

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: isDarkMode ? "#080F1E" : theme.background }]}>
      {/* HEADER */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            height: 56 + insets.top,
            backgroundColor: isDarkMode ? "#080F1E" : theme.headerBg,
            borderBottomColor: isDarkMode ? "rgba(255,255,255,0.06)" : theme.headerBorder,
          },
        ]}
      >
        <View style={styles.headerLeftContainer}>
          <TouchableOpacity
            style={styles.avatarTouchable}
            onPress={() => router.push("/(tabs)/profile")}
            activeOpacity={0.8}
            accessibilityLabel="Open profile"
          >
            {hasValidAvatar ? (
              <Image source={{ uri: avatarUri }} style={styles.headerAvatar} />
            ) : (
              <View
                style={[
                  styles.headerAvatarFallback,
                  { backgroundColor: isDarkMode ? "#16233B" : "#E2E8F0" },
                ]}
              >
                <MaterialCommunityIcons
                  name="account"
                  size={20}
                  color={isDarkMode ? "#FFD700" : "#0274BB"}
                />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.headerBrandRow}>
            <Ionicons name="flag" size={16} color="#FFD700" />
            <Text style={styles.headerTitleText}>BookHive Monitor</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[
              styles.circleHeaderBtn,
              {
                backgroundColor: isDarkMode ? "#16233B" : "#F1F5F9",
                borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "#E2E8F0",
              },
            ]}
            onPress={toggleTheme}
            activeOpacity={0.75}
          >
            <Ionicons
              name={isDarkMode ? "sunny-outline" : "moon-outline"}
              size={17}
              color={isDarkMode ? "#94A3B8" : "#64748B"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.circleHeaderBtn,
              {
                backgroundColor: isDarkMode ? "#16233B" : "#F1F5F9",
                borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "#E2E8F0",
              },
            ]}
            onPress={() => router.push("/notifications")}
            activeOpacity={0.75}
          >
            <Ionicons
              name="notifications-outline"
              size={18}
              color={isDarkMode ? "#94A3B8" : "#64748B"}
            />
            {unreadCount > 0 && (
              <View style={styles.redBadgeCircle}>
                <Text style={styles.redBadgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {liveBanner && (
        <TouchableOpacity
          style={{
            backgroundColor: "#059669",
            marginHorizontal: 16,
            marginTop: 8,
            padding: 12,
            borderRadius: 10,
            flexDirection: "row",
            alignItems: "center",
            elevation: 4,
          }}
          onPress={() => setLiveBanner(null)}
        >
          <Ionicons name="notifications-outline" size={22} color="#FFFFFF" style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#FFFFFF", fontWeight: "bold", fontSize: 13 }}>{liveBanner.title}</Text>
            <Text style={{ color: "#E0E7FF", fontSize: 12 }}>{liveBanner.body}</Text>
          </View>
          <Ionicons name="close" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={async () => {
              setIsRefreshing(true);
              try {
                await fetchBooksPayload();
                await syncAnnouncementsWithBackend(true);
                await syncTransactionsWithBackend(true);
                setActiveReservations(getUpcomingReservations());
                setLibraryCardBooks(getLibraryCardHistory());
                setBorrowHistory(getReservationHistory());
              } finally {
                setIsRefreshing(false);
              }
            }}
            tintColor="#FFD700"
            colors={["#FFD700"]}
          />
        }
      >
        {/* GREETING */}
        <View style={styles.greetingSection}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
            <Text style={[styles.greetingHello, { color: isDarkMode ? "#FFFFFF" : "#0F172A" }]}>
              Hello,{" "}
            </Text>
            <Text style={styles.greetingName}>{studentDisplayName}!</Text>
          </View>

          <Text
            style={[
              styles.greetingSubtitle,
              { color: isDarkMode ? "#94A3B8" : "#64748B" },
            ]}
          >
            Ready to discover something new today?
          </Text>
        </View>

        {/* SEARCH BAR (Brought back with light & dark mode support) */}
        <View style={styles.searchBarContainer}>
          <View
            style={[
              styles.searchBarPill,
              {
                backgroundColor: isDarkMode ? "#16233B" : "#FFFFFF",
                borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "#E2E8F0",
              },
            ]}
          >
            <TouchableOpacity onPress={() => handleHomeSearchSubmit()}>
              <Feather
                name="search"
                size={17}
                color={isDarkMode ? "#64748B" : "#94A3B8"}
                style={styles.searchIcon}
              />
            </TouchableOpacity>

            <TextInput
              style={[
                styles.searchInputText,
                { color: isDarkMode ? "#FFFFFF" : "#0F172A" },
              ]}
              placeholder="Search books, authors..."
              placeholderTextColor={isDarkMode ? "#64748B" : "#94A3B8"}
              value={searchText}
              onChangeText={handleSearchTextChange}
              onFocus={() => {
                if (searchText.trim().length > 0) {
                  handleHomeSearchSubmit();
                }
              }}
              returnKeyType="search"
              onSubmitEditing={() => handleHomeSearchSubmit()}
            />

            {searchText.length > 0 ? (
              <TouchableOpacity
                onPress={() => handleSearchTextChange("")}
                style={styles.clearIcon}
              >
                <Ionicons name="close-circle" size={20} color="#64748B" />
              </TouchableOpacity>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <TouchableOpacity
                  style={styles.searchScannerBtn}
                  onPress={handlePickDocument}
                  activeOpacity={0.7}
                  accessibilityLabel="Upload file or syllabus"
                >
                  <Feather
                    name="paperclip"
                    size={18}
                    color={isDarkMode ? "#94A3B8" : "#64748B"}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleHomeSearchSubmit()}
                  activeOpacity={0.8}
                  style={styles.searchSubmitPill}
                >
                  <Text style={styles.searchSubmitText}>SEARCH</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* SELECTED FILE PREVIEW BADGE */}
          {selectedFile && (
            <View
              style={[
                styles.fileBadgeChip,
                {
                  backgroundColor: isDarkMode ? "#16233B" : "#FFFFFF",
                  borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "#E2E8F0",
                },
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={16}
                color={isDarkMode ? theme.accentGold : theme.accentBlue}
              />
              <Text
                style={[
                  styles.fileBadgeName,
                  { color: isDarkMode ? "#FFFFFF" : "#0F172A" },
                ]}
                numberOfLines={1}
              >
                {selectedFile.name}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedFile(null)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="close-circle" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* STATS ROW (BORROWED / RESERVED) */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => router.push("/reservations")}
            style={[
              styles.statCard,
              {
                backgroundColor: isDarkMode ? "#16233B" : "#FFFFFF",
                borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "#E2E8F0",
              },
            ]}
          >
            <View style={styles.statHeader}>
              <View
                style={[
                  styles.statIconBadge,
                  { backgroundColor: "rgba(245, 158, 11, 0.15)" },
                ]}
              >
                <Ionicons name="book-outline" size={15} color="#F59E0B" />
              </View>
              <Text
                style={[
                  styles.statLabel,
                  { color: isDarkMode ? "#94A3B8" : "#64748B" },
                ]}
              >
                BORROWED
              </Text>
            </View>
            <Text
              style={[
                styles.statValue,
                { color: isDarkMode ? "#FFFFFF" : "#0F172A" },
              ]}
            >
              {activeBorrowedCount}
            </Text>
            <Text
              style={[
                styles.statSub,
                { color: isDarkMode ? "#64748B" : "#64748B" },
              ]}
            >
              Active on loan
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => router.push("/reservations")}
            style={[
              styles.statCard,
              {
                backgroundColor: isDarkMode ? "#16233B" : "#FFFFFF",
                borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "#E2E8F0",
              },
            ]}
          >
            <View style={styles.statHeader}>
              <View
                style={[
                  styles.statIconBadge,
                  { backgroundColor: "rgba(16, 185, 129, 0.15)" },
                ]}
              >
                <MaterialCommunityIcons
                  name="barcode-scan"
                  size={15}
                  color="#10B981"
                />
              </View>
              <Text
                style={[
                  styles.statLabel,
                  { color: isDarkMode ? "#94A3B8" : "#64748B" },
                ]}
              >
                RESERVED
              </Text>
            </View>
            <Text
              style={[
                styles.statValue,
                { color: isDarkMode ? "#FFFFFF" : "#0F172A" },
              ]}
            >
              {activeReservedCount}
            </Text>
            <Text
              style={[
                styles.statSub,
                { color: isDarkMode ? "#64748B" : "#64748B" },
              ]}
            >
              Awaiting pickup
            </Text>
          </TouchableOpacity>
        </View>

        {/* TRENDING BOOKS HERO SECTION */}
        <Text
          style={[
            styles.trendingSectionTitle,
            { color: isDarkMode ? "#FFFFFF" : "#0F172A" },
          ]}
        >
          Trending Books
        </Text>

        <View
          style={[
            styles.trendingSpotlightCard,
            {
              width: trendingCardWidth,
              backgroundColor: isDarkMode ? "#16233B" : "#F8FAFC",
              borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "#E2E8F0",
            },
          ]}
        >
          {isLoadingBooks && trendingBooks.length === 0 ? (
            <View style={styles.categoryLoadingBox}>
              <ActivityIndicator size="small" color="#FFD700" />
              <Text style={styles.loadingText}>Loading Trending Books...</Text>
            </View>
          ) : (
            <>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={trendingCardWidth}
                snapToAlignment="center"
                onScroll={(e) => {
                  const contentOffsetX = e.nativeEvent.contentOffset.x;
                  const idx = Math.min(
                    trendingBooks.length - 1,
                    Math.max(0, Math.round(contentOffsetX / trendingCardWidth))
                  );
                  setActiveCarouselIndex(idx);
                }}
                scrollEventThrottle={16}
                style={{ width: trendingCardWidth }}
              >
                {trendingBooks.slice(0, 5).map((book, idx) => {
                  const bookCopies = Math.max(1, Number(book.copies || book.totalCopies || 1));
                  const isAvail = book.availableCopies !== undefined
                    ? Number(book.availableCopies) > 0
                    : (book.isAvailable !== undefined 
                        ? Boolean(book.isAvailable) 
                        : (book.availability ? book.availability === 'Available' : (book.available !== undefined ? String(book.available) === 'true' : true)));
                  const availCopies = book.availableCopies !== undefined 
                    ? Number(book.availableCopies) 
                    : (isAvail ? bookCopies : 0);

                  const navigateToDetail = () => {
                    router.push({
                      pathname: "/book-details",
                      params: {
                        from: "home",
                        id: book.id,
                        title: book.title,
                        author: book.author,
                        description: book.description,
                        year: book.year,
                        publicationDate: book.publicationDate,
                        pages: book.pages,
                        language: book.language,
                        category: book.category,
                        department: book.department,
                        rating: book.rating,
                        shelf: book.shelf,
                        available: String(isAvail),
                        status: isAvail ? 'Available' : (book.status || book.availability || 'Unavailable'),
                        availableCopies: String(availCopies),
                        reservedCount: String(book.reservedCount || 0),
                        borrowedCount: String(book.borrowedCount || Math.max(0, bookCopies - availCopies)),
                        unavailableCopies: String(book.unavailableCopies || Math.max(0, bookCopies - availCopies)),
                        isbn: book.isbn || "",
                        copies: String(bookCopies),
                        totalCopies: String(bookCopies),
                        volume: book.volume,
                        edition: book.edition,
                        accessionNumber: book.accessionNumber,
                        coverImage: book.coverImage || undefined,
                        coverUrl: book.coverImage || undefined,
                      },
                    });
                  };

                  return (
                    <TouchableOpacity
                      key={idx}
                      activeOpacity={0.9}
                      onPress={navigateToDetail}
                      style={[styles.trendingSlide, { width: trendingCardWidth }]}
                    >
                      {/* Left: Book Cover with yellow "TRENDING" badge */}
                      <View style={styles.trendingCoverWrapper}>
                        <BookCoverImage
                          uri={book.coverImage}
                          title={book.title}
                          author={book.author}
                          category={book.category}
                          style={styles.trendingCoverImage}
                          iconSize={32}
                          showText={false}
                        />
                        <View style={styles.trendingTopBadge}>
                          <Text style={styles.trendingTopBadgeText}>TRENDING</Text>
                        </View>
                      </View>

                      {/* Right: Content & Action Row */}
                      <View style={styles.trendingContentCol}>
                        <View>
                          <View
                            style={[
                              styles.trendingGenreChip,
                              {
                                backgroundColor: isDarkMode ? "#0F172A" : "#EDE9FE",
                                borderColor: isDarkMode ? "rgba(255,255,255,0.12)" : "#DDD6FE",
                              },
                            ]}
                          >
                            <Text style={styles.trendingGenreText}>
                              {(book.category || "FANTASY").toUpperCase()}
                            </Text>
                          </View>

                          <Text
                            style={[
                              styles.trendingTitle,
                              { color: isDarkMode ? "#FFFFFF" : "#0F172A" },
                            ]}
                            numberOfLines={2}
                          >
                            {book.title}
                          </Text>

                          <Text style={styles.trendingAuthor} numberOfLines={1}>
                            by {book.author}
                          </Text>
                        </View>

                        {/* Bottom Row: View Detail button + Available status */}
                        <View style={styles.trendingActionRow}>
                          <TouchableOpacity
                            style={styles.viewDetailBtn}
                            activeOpacity={0.8}
                            onPress={navigateToDetail}
                          >
                            <Text style={styles.viewDetailBtnText}>View Detail</Text>
                          </TouchableOpacity>

                          <View style={styles.availableIndicatorRow}>
                            <View
                              style={[
                                styles.statusDot,
                                { backgroundColor: isAvail ? "#22C55E" : "#EF4444" },
                              ]}
                            />
                            <Text
                              style={[
                                styles.availableText,
                                { color: isAvail ? "#22C55E" : "#EF4444" },
                              ]}
                            >
                              {isAvail ? "Available" : "Unavailable"}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Elongated active pill pagination dots */}
              <View style={styles.trendingPaginationDots}>
                {trendingBooks.slice(0, 5).map((_, idx) => (
                  <View
                    key={idx}
                    style={
                      idx === activeCarouselIndex
                        ? styles.dotActive
                        : [
                            styles.dotInactive,
                            {
                              backgroundColor: isDarkMode
                                ? "#334155"
                                : "#CBD5E1",
                            },
                          ]
                    }
                  />
                ))}
              </View>
            </>
          )}
        </View>

        {/* 7 CATEGORY SECTIONS (Monochrome white fonts & icons, no colored classification) */}
        {[
          { title: "New Arrivals", icon: "sparkles", tag: "NEW" },
          { title: "Recommended Books", icon: "flame", tag: "TOP PICK" },
          { title: "Circulation", icon: "book-outline", tag: "MAIN" },
          { title: "General References", icon: "bookmark-outline", tag: "REF" },
          { title: "Filipiniana", icon: "flag-outline", tag: "LOCAL" },
          { title: "Periodicals", icon: "newspaper-outline", tag: "JOURNAL" },
          { title: "Special Collections", icon: "star-outline", tag: "SPECIAL" },
        ].map((categoryConfig, cIndex) => {
          const categoryTitle = categoryConfig.title;
          const categoryBooks = getCategoryBooks(categoryTitle);

          return (
            <View key={cIndex} style={styles.categorySection}>
              {/* Section Header with dynamic theme colors (white in dark mode, dark slate in light mode) */}
              <View style={styles.categoryHeaderRow}>
                <View style={styles.categoryHeaderLeft}>
                  <Ionicons
                    name={categoryConfig.icon as any}
                    size={16}
                    color={isDarkMode ? "#FFFFFF" : "#0F172A"}
                  />
                  <Text
                    style={[
                      styles.categoryTitleText,
                      { color: isDarkMode ? "#FFFFFF" : "#0F172A" },
                    ]}
                  >
                    {categoryTitle}
                  </Text>
                  {categoryConfig.tag && (
                    <View
                      style={[
                        styles.categoryTagChip,
                        {
                          borderColor: isDarkMode
                            ? "rgba(255,255,255,0.20)"
                            : "#CBD5E1",
                          backgroundColor: isDarkMode
                            ? "rgba(255,255,255,0.06)"
                            : "#F1F5F9",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryTagText,
                          { color: isDarkMode ? "#FFFFFF" : "#334155" },
                        ]}
                      >
                        {categoryConfig.tag}
                      </Text>
                    </View>
                  )}
                </View>

                {/* See All link */}
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() =>
                    router.push({
                      pathname: "/department-books",
                      params: { department: categoryTitle },
                    })
                  }
                  style={styles.seeAllBtn}
                >
                  <Text
                    style={[
                      styles.seeAllBtnText,
                      { color: isDarkMode ? "#FFFFFF" : "#0F172A" },
                    ]}
                  >
                    See All &gt;
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Category Books Horizontal Scroll */}
              {isLoadingBooks && categoryBooks.length === 0 ? (
                <View style={styles.categoryLoadingBox}>
                  <ActivityIndicator size="small" color={isDarkMode ? "#FFFFFF" : "#0F172A"} />
                </View>
              ) : categoryBooks.length === 0 ? (
                <View
                  style={[
                    styles.emptyCategoryCard,
                    {
                      backgroundColor: isDarkMode ? "#16233B" : "#FFFFFF",
                      borderColor: isDarkMode
                        ? "rgba(255,255,255,0.08)"
                        : "#E2E8F0",
                    },
                  ]}
                >
                  <Ionicons
                    name="folder-open-outline"
                    size={16}
                    color={isDarkMode ? "#FFFFFF" : "#64748B"}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.emptyCategoryText, { color: isDarkMode ? "#CBD5E1" : "#64748B" }]}>
                    No books available in this category
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryScrollContainer}
                >
                  {categoryBooks.map((book, cardIdx) => {
                    const bookCopies = Math.max(1, Number(book.copies || book.totalCopies || 1));
                    const isAvail = book.availableCopies !== undefined
                      ? Number(book.availableCopies) > 0
                      : (book.isAvailable !== undefined 
                          ? Boolean(book.isAvailable) 
                          : (book.availability ? book.availability === 'Available' : (book.available !== undefined ? String(book.available) === 'true' : true)));
                    const availCopies = book.availableCopies !== undefined 
                      ? Number(book.availableCopies) 
                      : (isAvail ? bookCopies : 0);

                    const badgeText = getBookCoverBadge(book, categoryTitle);

                    return (
                      <TouchableOpacity
                        key={cardIdx}
                        activeOpacity={0.85}
                        style={styles.bookItemCard}
                        onPress={() => {
                          router.push({
                            pathname: "/book-details",
                            params: {
                              from: "home",
                              id: book.id,
                              title: book.title,
                              author: book.author,
                              description: book.description,
                              year: book.year,
                              publicationDate: book.publicationDate,
                              pages: book.pages,
                              language: book.language,
                              category: book.category,
                              department: book.department,
                              rating: book.rating,
                              shelf: book.shelf,
                              available: String(isAvail),
                              status: isAvail ? 'Available' : (book.status || book.availability || 'Unavailable'),
                              availableCopies: String(availCopies),
                              reservedCount: String(book.reservedCount || 0),
                              borrowedCount: String(book.borrowedCount || Math.max(0, bookCopies - availCopies)),
                              unavailableCopies: String(book.unavailableCopies || Math.max(0, bookCopies - availCopies)),
                              isbn: book.isbn || "",
                              copies: String(bookCopies),
                              totalCopies: String(bookCopies),
                              volume: book.volume,
                              edition: book.edition,
                              accessionNumber: book.accessionNumber,
                              coverImage: book.coverImage || undefined,
                              coverUrl: book.coverImage || undefined,
                            },
                          });
                        }}
                      >
                        {/* Book Cover Container with Overlay Badge */}
                        <View
                          style={[
                            styles.bookCoverBox,
                            {
                              backgroundColor: isDarkMode ? "#16233B" : "#F1F5F9",
                              borderColor: isDarkMode
                                ? "rgba(255,255,255,0.08)"
                                : "#E2E8F0",
                            },
                          ]}
                        >
                          <BookCoverImage
                            uri={book.coverImage}
                            title={book.title}
                            author={book.author}
                            category={book.category || categoryTitle}
                            style={styles.bookCoverImage}
                            iconSize={22}
                            showText={false}
                          />
                          {badgeText && (
                            <View style={styles.bookCoverOverlayBadge}>
                              <Text
                                style={styles.bookCoverOverlayBadgeText}
                                numberOfLines={1}
                              >
                                {badgeText}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Details cleanly beneath cover: Title and Author ONLY (high contrast in both themes) */}
                        <Text
                          style={[
                            styles.bookItemTitle,
                            { color: isDarkMode ? "#FFFFFF" : "#0F172A" },
                          ]}
                          numberOfLines={1}
                        >
                          {book.title}
                        </Text>
                        <Text
                          style={[
                            styles.bookItemAuthor,
                            { color: isDarkMode ? "#94A3B8" : "#64748B" },
                          ]}
                          numberOfLines={1}
                        >
                          {book.author}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          );
        })}

        {/* SYSTEM ANNOUNCEMENTS */}
        {announcements.length > 0 && (
          <View style={styles.announcementsContainer}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 9,
                paddingHorizontal: 16,
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: isDarkMode
                    ? "rgba(255, 255, 255, 0.1)"
                    : "#E2E8F0",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Ionicons
                  name="megaphone"
                  size={14}
                  color={isDarkMode ? "#FFFFFF" : "#0F172A"}
                />
              </View>
              <View>
                <Text
                  style={{
                    fontSize: 9.5,
                    fontWeight: "800",
                    letterSpacing: 1.1,
                    textTransform: "uppercase",
                    color: isDarkMode ? "#FFFFFF" : "#64748B",
                  }}
                >
                  ACTIVE CAMPUS NOTICE
                </Text>
                <Text
                  style={[
                    styles.announcementsTitle,
                    {
                      color: isDarkMode ? "#FFFFFF" : "#0F172A",
                      marginTop: 1,
                      paddingHorizontal: 0,
                      marginBottom: 0,
                      fontSize: 15,
                    },
                  ]}
                >
                  System Announcements ({announcements.length} Active)
                </Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.announcementsRow}
            >
              {announcements.map((item) => {
                const priorityStyle = getAnnouncementPriorityStyle(item.priority);
                const isUrgent = item.priority === "Urgent";
                const isImportant = item.priority === "Important";
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.85}
                    onPress={() => setSelectedAnnouncement(item)}
                    style={[
                      styles.announcementCard,
                      priorityStyle,
                      {
                        backgroundColor: theme.cardBg,
                        borderColor: theme.cardBorder,
                        borderLeftWidth: 4,
                        borderLeftColor: isUrgent
                          ? "#EF4444"
                          : isImportant
                          ? "#F59E0B"
                          : isDarkMode
                          ? "#38BDF8"
                          : "#0274BB",
                      },
                    ]}
                  >
                    <View style={styles.announcementHeader}>
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 12,
                          backgroundColor: isUrgent
                            ? isDarkMode
                              ? "rgba(239, 68, 68, 0.18)"
                              : "#FEE2E2"
                            : isImportant
                            ? isDarkMode
                              ? "rgba(245, 158, 11, 0.18)"
                              : "#FEF3C7"
                            : isDarkMode
                            ? "rgba(56, 189, 248, 0.18)"
                            : "#E0F2FE",
                        }}
                      >
                        <Text
                          style={[
                            styles.announcementPriority,
                            {
                              color: isUrgent
                                ? "#DC2626"
                                : isImportant
                                ? "#D97706"
                                : isDarkMode
                                ? "#38BDF8"
                                : "#0274BB",
                              fontSize: 9.5,
                              fontWeight: "800",
                            },
                          ]}
                        >
                          {item.priority}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 10.5,
                          fontWeight: "500",
                          color: theme.textSecondary,
                        }}
                      >
                        To: {(item as any).audience || "All Users"}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.announcementTitleText,
                        {
                          color: isDarkMode
                            ? theme.textPrimary
                            : theme.brandBlue,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={[
                        styles.announcementBody,
                        { color: theme.textSecondary },
                      ]}
                      numberOfLines={2}
                    >
                      {item.content}
                    </Text>
                    <View
                      style={[
                        styles.announcementFooter,
                        { borderTopColor: theme.cardBorder },
                      ]}
                    >
                      <Text
                        style={[
                          styles.announcementAuthor,
                          { color: theme.textSecondary },
                        ]}
                      >
                        By {item.author || "Library Administration"}
                      </Text>
                      <Text
                        style={[
                          styles.announcementDate,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {formatSafeAnnouncementDate(
                          item.updatedAt ||
                            (item as any).createdAt ||
                            (item as any).date
                        )}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ANNOUNCEMENT DETAIL MODAL */}
      {selectedAnnouncement !== null && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={dismissAnnouncementModal}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={dismissAnnouncementModal}
          >
            <TouchableOpacity
              style={[styles.announcementModalContent, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
              activeOpacity={1}
            >
              {/* Header */}
              <View style={[styles.modalAnnHeader, { borderBottomColor: theme.cardBorder }]}>
                <View style={styles.modalAnnHeaderLeft}>
                  <Ionicons
                    name={
                      selectedAnnouncement?.priority === 'Urgent'
                        ? "alert-circle"
                        : selectedAnnouncement?.priority === 'Important'
                        ? "warning"
                        : "information-circle"
                    }
                    size={20}
                    color={
                      selectedAnnouncement?.priority === 'Urgent'
                        ? "#EF4444"
                        : selectedAnnouncement?.priority === 'Important'
                        ? "#F59E0B"
                        : "#3B82F6"
                    }
                  />
                  <Text style={[
                    styles.modalAnnPriority,
                    selectedAnnouncement?.priority === 'Urgent' && { color: '#EF4444' },
                    selectedAnnouncement?.priority === 'Important' && { color: '#F59E0B' },
                  ]}>
                    {selectedAnnouncement?.priority}
                  </Text>
                </View>
                <TouchableOpacity onPress={dismissAnnouncementModal}>
                  <Ionicons name="close" size={24} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Title */}
              <Text style={[styles.modalAnnTitle, { color: theme.textPrimary }]}>
                {selectedAnnouncement?.title}
              </Text>

              {/* Body */}
              <ScrollView style={styles.modalAnnBodyScroll} showsVerticalScrollIndicator={true}>
                <Text style={[styles.modalAnnBodyText, { color: theme.textSecondary }]}>
                  {selectedAnnouncement?.content}
                </Text>
              </ScrollView>

              {/* Footer */}
              <View style={[styles.modalAnnFooter, { borderTopColor: theme.cardBorder }]}>
                <Text style={[styles.modalAnnAuthor, { color: theme.textSecondary }]}>By {selectedAnnouncement?.author || "Library Administration"}</Text>
                <Text style={[styles.modalAnnDate, { color: theme.textSecondary }]}>
                  {formatSafeAnnouncementDate(selectedAnnouncement?.updatedAt || (selectedAnnouncement as any)?.createdAt || (selectedAnnouncement as any)?.date)}
                </Text>
              </View>

              {/* Close button */}
              <TouchableOpacity
                style={[styles.modalAnnCloseButton, { backgroundColor: theme.background, borderColor: theme.cardBorder }]}
                onPress={dismissAnnouncementModal}
              >
                <Text style={[styles.modalAnnCloseButtonText, { color: isDarkMode ? theme.accentGold : theme.accentBlue }]}>Got it • Close</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080F1E",
  },

  /* HEADER */
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerLeftContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarTouchable: {
    padding: 2,
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  headerAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitleText: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  circleHeaderBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    position: "relative",
  },
  redBadgeCircle: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  redBadgeText: {
    color: "#FFFFFF",
    fontSize: 8.5,
    fontWeight: "900",
  },

  /* GREETING */
  greetingSection: {
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 14,
  },
  greetingHello: {
    fontSize: 22,
    fontWeight: "600",
  },
  greetingName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFD700",
  },
  greetingSubtitle: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 4,
  },

  /* SEARCH BAR */
  searchBarContainer: {
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  searchBarPill: {
    height: 48,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 4,
    borderWidth: 1,
  },
  searchIcon: {
    marginLeft: 14,
    marginRight: 8,
  },
  searchInputText: {
    flex: 1,
    fontSize: 13,
    height: "100%",
    paddingVertical: 0,
  },
  searchScannerBtn: {
    padding: 8,
    marginRight: 2,
  },
  searchSubmitPill: {
    backgroundColor: "#FFD700",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  searchSubmitText: {
    color: "#0B1A2C",
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  clearIcon: {
    padding: 4,
    marginRight: 6,
  },

  /* FILE PREVIEW CHIP */
  fileBadgeChip: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    alignSelf: "flex-start",
  },
  fileBadgeName: {
    fontSize: 12,
    fontWeight: "600",
    maxWidth: 220,
  },

  /* WORD SUGGESTIONS */
  suggestionsWrapper: {
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  suggestionsScrollContent: {
    paddingRight: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  suggestionChip: {
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    marginRight: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  suggestionChipText: {
    fontSize: 12,
    fontWeight: "600",
  },

  /* STATS ROW */
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  statIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "900",
  },
  statSub: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 2,
  },

  /* TRENDING SECTION */
  trendingSectionTitle: {
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
  },
  trendingSpotlightCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 0,
    overflow: "hidden",
  },
  trendingSlide: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  trendingCoverWrapper: {
    width: 90,
    height: 135,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  trendingCoverImage: {
    width: 90,
    height: 135,
    borderRadius: 8,
  },
  trendingTopBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "#FFD700",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 2,
  },
  trendingTopBadgeText: {
    color: "#0F172A",
    fontSize: 8.5,
    fontWeight: "900",
  },
  trendingContentCol: {
    flex: 1,
    marginLeft: 14,
    height: 135,
    justifyContent: "space-between",
  },
  trendingGenreChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 6,
  },
  trendingGenreText: {
    color: "#94A3B8",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  trendingTitle: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 20,
  },
  trendingAuthor: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  trendingActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "auto",
    paddingRight: 6,
  },
  viewDetailBtn: {
    backgroundColor: "#FFD700",
    paddingHorizontal: 12,
    paddingVertical: 6.5,
    borderRadius: 6,
  },
  viewDetailBtnText: {
    color: "#0F172A",
    fontSize: 11,
    fontWeight: "800",
  },
  availableIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  availableText: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  trendingPaginationDots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    paddingTop: 8,
    paddingBottom: 14,
  },
  dotActive: {
    width: 18,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#FFD700",
  },
  dotInactive: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },

  /* CATEGORY SECTION */
  categorySection: {
    marginTop: 20,
  },
  categoryHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  categoryHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryTitleText: {
    fontSize: 15.5,
    fontWeight: "800",
  },
  categoryTagChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  categoryTagText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  seeAllBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  seeAllBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  categoryScrollContainer: {
    paddingHorizontal: 16,
    gap: 14,
  },
  bookItemCard: {
    width: 125,
  },
  bookCoverBox: {
    width: 125,
    height: 175,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    position: "relative",
  },
  bookCoverImage: {
    width: "100%",
    height: "100%",
  },
  bookCoverOverlayBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.20)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 2,
  },
  bookCoverOverlayBadgeText: {
    color: "#FFFFFF",
    fontSize: 8.5,
    fontWeight: "800",
  },
  bookItemTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 7,
  },
  bookItemAuthor: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  bookItemGenre: {
    fontSize: 10.5,
    fontWeight: "600",
    marginTop: 2,
  },

  categoryLoadingBox: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyCategoryCard: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCategoryText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
  },
  loadingText: {
    color: "#8E9DAE",
    fontSize: 12,
    fontWeight: "600",
  },

  /* ANNOUNCEMENTS */
  announcementsContainer: {
    marginTop: 24,
  },
  announcementsTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  announcementsRow: {
    paddingLeft: 16,
    paddingRight: 6,
    paddingBottom: 8,
  },
  announcementCard: {
    width: 280,
    borderRadius: 16,
    padding: 16,
    marginRight: 14,
    borderWidth: 1,
  },
  announcementHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    justifyContent: "space-between",
  },
  announcementPriority: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  announcementTitleText: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  announcementBody: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  announcementFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 8,
  },
  announcementAuthor: {
    fontSize: 11,
    fontWeight: "600",
  },
  announcementDate: {
    fontSize: 11,
  },

  /* MODAL */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  announcementModalContent: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  modalAnnHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    paddingBottom: 10,
  },
  modalAnnHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modalAnnPriority: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    color: "#38BDF8",
  },
  modalAnnTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 14,
  },
  modalAnnBodyScroll: {
    maxHeight: 200,
    marginBottom: 16,
  },
  modalAnnBodyText: {
    fontSize: 14,
    lineHeight: 22,
  },
  modalAnnFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 12,
    marginBottom: 20,
  },
  modalAnnAuthor: {
    fontSize: 12,
    fontWeight: "600",
  },
  modalAnnDate: {
    fontSize: 12,
  },
  modalAnnCloseButton: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  modalAnnCloseButtonText: {
    fontWeight: "800",
    fontSize: 14,
  },
});