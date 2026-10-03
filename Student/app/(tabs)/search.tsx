import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Switch,
  Animated,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimatedScreen from "../../components/AnimatedScreen";
import axios from "axios";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useThemeColors } from "../../hooks/useThemeColors";
import {
  Feather,
  Ionicons,
  MaterialCommunityIcons,
  Entypo,
} from "@expo/vector-icons";
import { API_URL, getAuthHeaders } from "../../data/authService";
import { saveSearchQuery, saveBookToViewHistory, getNotifications, subscribe, NotificationItem } from "../../data/store";
import localCatalogBooks, { searchBooksByPrefix, searchBooksByKeyword, getBooksByDepartment } from "../../data/books";
const DIRECTIVE_PATTERNS = [
  /is\s+there\s+any\s+books?\s+similar\s+to\s+this\s+file\??/i,
  /is\s+there\s+any\s+books?\s+similar\s+to\s+this\??/i,
  /are\s+there\s+any\s+books?\s+similar\s+to\s+this\s+file\??/i,
  /books?\s+similar\s+to\s+this\s+file\??/i,
  /books?\s+similar\s+to\s+this\??/i,
  /books?\s+like\s+this\s+file\??/i,
  /books?\s+like\s+this\??/i,
  /recommend\s+books?\s+for\s+this\s+file\??/i,
  /recommend\s+books?\s+for\s+this\??/i,
  /recommend\s+books?\s+about\s+this\??/i,
  /find\s+books?\s+about\s+this\s+file\??/i,
  /find\s+books?\s+similar\s+to\s+this\??/i,
  /what\s+books?\s+are\s+related\s+to\s+this\??/i,
  /what\s+books?\s+should\s+i\s+read\s+for\s+this\??/i,
];

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
  "recommended", "looking", "for", "about", "describe", "detail", "details", "analyse", "analyze",
  "similar", "file", "files", "document", "documents", "handout", "handouts", "pdf", "handout01",
  "syllabus", "notes", "attached", "upload", "uploaded", "paper", "copy", "related", "like", "give", "suggest"
]);

const aiSuggestions = [
  "Artificial Intelligence books",
  "Machine Learning references",
  "Data Science books",
  "Programming books",
  "Cybersecurity books",
  "Networking books",
  "Database systems",
  "Java programming",
  "Python programming",
  "Research methodology books",
  "Computer Science references",
  "Software engineering books",
  "UI UX design books",
  "Mobile development books",
];

/**
 * Real-Time Prefix Matching Search Algorithm (Title-Exclusive)
 * Checks if query matches the title (case-insensitive).
 * Omits author, description, category, synopsis, etc.
 */
export const matchesPrefix = (text: string, query: string): boolean => {
  if (!text || !query) return false;

  const normalizedQuery = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (normalizedQuery.length === 0) return false;

  const normalizedText = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const cleanText = normalizedText.replace(/[^a-z0-9]/g, "");
  const cleanQuery = normalizedQuery.replace(/[^a-z0-9]/g, "");
  const textNoArticle = normalizedText.replace(/^(the|a|an)\s+/i, "").replace(/[^a-z0-9]/g, "");

  const searchQ = cleanQuery.length > 0 ? cleanQuery : normalizedQuery;
  const searchT = cleanText.length > 0 ? cleanText : normalizedText;

  // Title must start with the query prefix (direct or without leading "the/a/an")
  return searchT.startsWith(searchQ) || (textNoArticle.length > 0 && textNoArticle.startsWith(searchQ));
};

/**
 * Dynamic Real-Time Match Percentage Scoring Calculation
 * Computes relevance match percentage based strictly on matching the beginning (prefix) of the TITLE.
 * - 1 letter typed: matches 1st letter of title (e.g. "B" -> "Brichoox...")
 * - 2 letters typed: matches first 2 letters of title (e.g. "Br" -> "Brichoox...")
 * - N letters typed: matches title starting with those N letters
 */
export const calculateMatchPercentage = (
  title: string,
  query: string,
  _author: string = ""
): number => {
  if (!title || !query) return 0;

  const normalizedQuery = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (normalizedQuery.length === 0) return 0;

  const normalizedTitle = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const cleanTitle = normalizedTitle.replace(/[^a-z0-9]/g, "");
  const cleanQuery = normalizedQuery.replace(/[^a-z0-9]/g, "");

  const searchQ = cleanQuery.length > 0 ? cleanQuery : normalizedQuery;
  const searchT = cleanTitle.length > 0 ? cleanTitle : normalizedTitle;

  // Leading article strip (e.g. "The Book..." -> "Book...")
  const titleNoArticle = normalizedTitle.replace(/^(the|a|an)\s+/i, "").replace(/[^a-z0-9]/g, "");

  // STRICT FIRST-LETTER & PREFIX MATCH REQUIREMENT:
  // When typing the 1st letter, the first letter of the title must match.
  // When typing 2 letters, the first 2 letters of the title must match.
  // When typing N letters, the title must start with those N letters.
  const isDirectPrefix = searchT.startsWith(searchQ);
  const isNoArticlePrefix = titleNoArticle.length > 0 && titleNoArticle.startsWith(searchQ);

  if (!isDirectPrefix && !isNoArticlePrefix) {
    // If the title does NOT start with the searched letter(s), strictly exclude it!
    return 0;
  }

  // 1. Exact Title Match -> 100% Match
  if (normalizedTitle === normalizedQuery || searchT === searchQ || titleNoArticle === searchQ) {
    return 100;
  }

  // 2. Direct or clean prefix match:
  // Starts with 1st letter: 80% (matches user's screenshot exactly!)
  // Starts with 2+ letters: 82% - 98%
  const ratio = Math.min(1, searchQ.length / searchT.length);
  const baseScore = isDirectPrefix ? 80 : 75;
  return Math.min(98, Math.round(baseScore + ratio * 20));
};

/**
 * AI Natural Language Prompt & Keyword Relevance Scoring Calculation
 * (Used when the Filter Toggle is OFF)
 * Evaluates match percentage based on prompt intent, keywords, title, author,
 * summary description, categories, and department.
 */
export const calculateAiPromptMatchPercentage = (
  book: {
    title: string;
    author?: string;
    description?: string;
    category?: string;
  },
  query: string,
  hasFileAttached: boolean = false
): number => {
  if (!book.title) return 0;
  if (!query && !hasFileAttached) return 0;

  const normalizedQuery = (query || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const normalizedTitle = (book.title || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const normalizedAuthor = (book.author || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const normalizedDesc = (book.description || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const normalizedCat = (book.category || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  // 1. Exact Title Match -> 100%
  if (normalizedQuery.length > 0 && normalizedTitle === normalizedQuery) {
    return 100;
  }

  // 2. Exact Query Phrase in Title or Author -> 90% - 95%
  if (normalizedQuery.length > 3 && normalizedTitle.includes(normalizedQuery)) {
    return Math.min(98, 90 + Math.round((normalizedQuery.length / Math.max(1, normalizedTitle.length)) * 8));
  }

  if (normalizedQuery.length > 3 && normalizedAuthor.length > 0 && normalizedAuthor.includes(normalizedQuery)) {
    return 90;
  }

  // 3. Tokenize natural language prompt and extract significant AI keywords
  const allWords = normalizedQuery.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const meaningfulWords = allWords.filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  // If user only provided directive phrases (e.g. "is there any books similar to this file?")
  if (meaningfulWords.length === 0) {
    if (hasFileAttached) {
      return 80;
    }
    return 0;
  }

  let titleMatches = 0;
  let authorMatches = 0;
  let descMatches = 0;
  let catMatches = 0;

  for (const kw of meaningfulWords) {
    if (normalizedTitle.includes(kw)) titleMatches++;
    if (normalizedAuthor.includes(kw)) authorMatches++;
    if (normalizedCat.includes(kw)) catMatches++;
    if (normalizedDesc.includes(kw)) descMatches++;
  }

  const totalMatches = titleMatches + authorMatches + descMatches + catMatches;
  if (totalMatches === 0) {
    return hasFileAttached ? 50 : 0;
  }

  // Compute composite AI score based on keyword coverage
  const titleRatio = titleMatches / meaningfulWords.length;
  const authorRatio = authorMatches / meaningfulWords.length;
  const catRatio = catMatches / meaningfulWords.length;
  const descRatio = Math.min(1, descMatches / meaningfulWords.length);

  let score = 55;
  if (titleMatches > 0) score += Math.round(titleRatio * 30);
  if (authorMatches > 0) score += Math.round(authorRatio * 20);
  if (catMatches > 0) score += Math.round(catRatio * 15);
  if (descMatches > 0) score += Math.round(descRatio * 10);

  return Math.min(98, Math.max(60, score));
};

export const extractFileKeywords = async (file: { name: string; uri?: string; mimeType?: string }): Promise<string[]> => {
  if (!file || !file.name) return [];

  const nameKeywords = file.name
    .replace(/\.[^/.]+$/, "")
    .split(/[\s_.\-\/\(\)\[\]]+/)
    .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

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
        .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
        .slice(0, 40);
    }
  } catch (e) {
    console.log("Error reading file text content:", e);
  }

  return Array.from(new Set([...nameKeywords, ...academicHeuristics, ...textContentKeywords]));
};

export default function SearchScreen() {
  const router = useRouter();
  const { q, autoFocus, fileName, fileUri, fileKeywords } = useLocalSearchParams<{
    q?: string;
    autoFocus?: string;
    fileName?: string;
    fileUri?: string;
    fileKeywords?: string;
  }>();
  const inputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();
  const [searchText, setSearchText] = useState("");
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPrefixFilter, setIsPrefixFilter] = useState(true);

  const aiPulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(aiPulseAnim, {
          toValue: 1.15,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(aiPulseAnim, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const handleSearchTextChange = (text: string) => {
    setSearchText(text);
    setCurrentPage(1);
  };
  const [notifications, setNotifications] = useState<NotificationItem[]>(getNotifications());

  useEffect(() => {
    setNotifications(getNotifications());
    return subscribe(() => {
      setNotifications(getNotifications());
    });
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const [suggestions, setSuggestions] = useState<
    string[]
  >([]);

  const [selectedFile, setSelectedFile] = useState<{
    uri: string;
    name: string;
    size?: number;
    mimeType?: string;
    keywords?: string[];
    base64?: string;
  } | null>(null);

  const [aiAnalysis, setAiAnalysis] = useState<{
    fileName?: string;
    detectedSubject?: string;
    topics?: string[];
    summary?: string;
    totalMatches?: number;
  } | null>(null);

  const [aiBooks, setAiBooks] = useState<any[] | null>(null);

  const [inputHeight, setInputHeight] = useState(40);

  // ACTIVE DEPARTMENT
  const [activeDepartment, setActiveDepartment] =
    useState("Circulation Section");
 
  // DEPARTMENTS
  const departments = [
    {
      name: "Circulation Section",
      description:
        "Houses books that can be borrowed for home use, including fiction and non-fiction resources across various disciplines.",
    },
    {
      name: "Filipiniana & Negrosiana Section",
      description:
        "This department focuses on publications about the Philippines and local history/culture specific to Negros.",
    },
    {
      name: "General Reference Section",
      description:
        "Contains non-circulating materials used for quick research, such as dictionaries and encyclopedias, atlases/maps/gazetteers, yearbooks/handbooks, and periodicals.",
    },
    {
      name: "Periodical Section",
      description:
        "Houses current and bound journals, magazines, and newspapers. While professional journals are grouped by subject, these are mostly for room use only.",
    },
    {
      name: "Engineering & Maritime Section",
      description:
        "A dedicated area for technical books and resources specifically for Engineering and Maritime students.",
    },
    {
      name: "Technical Section",
      description:
        "This is the back-end of the library where books are processed, cataloged, and assigned call numbers before they hit the shelves.",
    },
    {
      name: "Archive Section",
      description:
        "Preserves the history of the university, including faculty research and institutional records.",
    },
    {
      name: "E-Library / Internet Service Center",
      description:
        "Located on the 3rd floor of the CICT building, this area provides computer access and entry to authorized digital databases like ProQuest.",
    },
    {
      name: "Law & Graduate Studies Library",
      description:
        "Located on the ground floor of the Main Library Building, it caters specifically to postgraduate students with specialized legal and advanced academic texts.",
    },
    {
      name: "Reserve Section",
      description:
        "Contains high-demand textbooks or materials requested by instructors to be kept for short-term use so all students in a class have a chance to read them.",
    },
  ];

  // INTELLIGENT DEPARTMENT CLASSIFIER
  const classifyBookDepartment = (
    title: string,
    description?: string,
    categories?: string[],
    searchQuery?: string,
    departmentHint?: string
  ): string => {
    const bookText = (
      (title + " " + (description || "") + " " + (categories || []).join(" ")).toLowerCase()
    ).trim();
    const queryText = (searchQuery || "").toLowerCase();
    const hintText = (departmentHint || "").toLowerCase();
    const combinedText = (
      bookText + " " + queryText + " " + hintText
    ).toLowerCase();

    // ENGINEERING & MARITIME
    if (
      combinedText.includes("engineering") ||
      combinedText.includes("engineer") ||
      combinedText.includes("maritime") ||
      combinedText.includes("naval") ||
      combinedText.includes("aircraft") ||
      combinedText.includes("mechanical") ||
      combinedText.includes("electrical") ||
      combinedText.includes("civil engineering") ||
      combinedText.includes("shipbuilding") ||
      combinedText.includes("marine")
    ) {
      return "Engineering & Maritime Section";
    }

    // COMPUTER SCIENCE / TECHNICAL / PROGRAMMING
    if (
      combinedText.includes("programming") ||
      combinedText.includes("python") ||
      combinedText.includes("javascript") ||
      combinedText.includes("java") ||
      combinedText.includes("code") ||
      combinedText.includes("software") ||
      combinedText.includes("algorithm") ||
      combinedText.includes("data structure") ||
      combinedText.includes("web development") ||
      combinedText.includes("computer science") ||
      combinedText.includes("artificial intelligence") ||
      combinedText.includes("machine learning") ||
      combinedText.includes("database") ||
      combinedText.includes("cybersecurity") ||
      combinedText.includes("network") ||
      combinedText.includes("cloud computing") ||
      combinedText.includes("mobile app")
    ) {
      return "Technical Section";
    }

    // FILIPINIANA & NEGROSIANA
    if (
      combinedText.includes("philippines") ||
      combinedText.includes("filipiniana") ||
      combinedText.includes("negros") ||
      combinedText.includes("negrosiana") ||
      combinedText.includes("local history") ||
      combinedText.includes("bacolod") ||
      combinedText.includes("visayas") ||
      combinedText.includes("tagalog")
    ) {
      return "Filipiniana & Negrosiana Section";
    }

    // REFERENCE SECTION
    if (
      combinedText.includes("dictionary") ||
      combinedText.includes("encyclopedia") ||
      combinedText.includes("reference") ||
      combinedText.includes("thesaurus") ||
      combinedText.includes("atlas") ||
      combinedText.includes("handbook")
    ) {
      return "General Reference Section";
    }

    // LAW & GRADUATE STUDIES
    if (
      combinedText.includes("law") ||
      combinedText.includes("legal") ||
      combinedText.includes("graduate") ||
      combinedText.includes("thesis") ||
      combinedText.includes("postgraduate") ||
      combinedText.includes("research methodology")
    ) {
      return "Law & Graduate Studies Library";
    }

    // ARCHIVE SECTION
    if (
      combinedText.includes("archive") ||
      combinedText.includes("history") ||
      combinedText.includes("historical") ||
      combinedText.includes("university history")
    ) {
      return "Archive Section";
    }

    // PERIODICALS
    if (
      combinedText.includes("journal") ||
      combinedText.includes("magazine") ||
      combinedText.includes("newspaper") ||
      combinedText.includes("periodical") ||
      combinedText.includes("research paper")
    ) {
      return "Periodical Section";
    }

    // FALLBACK TO DEPARTMENT HINT WHEN THE BOOK DOES NOT MATCH A KEYWORD
    const normalizedHint = (departmentHint || "").trim();
    const validDepartments = [
      "Circulation Section",
      "Filipiniana & Negrosiana Section",
      "General Reference Section",
      "Periodical Section",
      "Engineering & Maritime Section",
      "Technical Section",
      "Archive Section",
      "E-Library / Internet Service Center",
      "Law & Graduate Studies Library",
      "Reserve Section",
    ];

    if (
      normalizedHint.length > 0 &&
      validDepartments.includes(normalizedHint)
    ) {
      return normalizedHint;
    }

    // DEFAULT
    return "Circulation Section";
  };

  const departmentSearchQueries: Record<string, string> = {
    "Circulation Section":
      "circulation fiction non-fiction novels stories literature science history",
    "Filipiniana & Negrosiana Section":
      "Philippines history culture literature",
    "General Reference Section":
      "dictionary encyclopedia atlas handbook reference",
    "Periodical Section":
      "journal magazine newspaper periodical research paper",
    "Engineering & Maritime Section":
      "engineering maritime naval shipbuilding mechanical electrical civil engineering",
    "Technical Section":
      "programming software computer science data structures algorithms cybersecurity database web development",
    "Archive Section": "archive historical records university history biographies",
    "E-Library / Internet Service Center":
      "e-library digital databases online library internet service center",
    "Law & Graduate Studies Library":
      "law legal graduate thesis postgraduate research",
    "Reserve Section":
      "textbook reserved reading high demand course book",
  };

  const formatSearchItem = useCallback((book: any, index: number = 0) => {
    return {
      id: String(book.id || book.isbn || `cat-book-${index}`),
      isbn: book.isbn || "",
      local: true,
      status: book.status || book.availability || (book.available !== false ? "Available" : "Borrowed"),
      department: book.department || "Circulation Section",
      shelfLocation: book.shelfLocation || book.shelf || "CIR-01A.1",
      copies: book.copies !== undefined ? Number(book.copies) : 1,
      volume: book.volume || "Single Volume / None",
      edition: book.edition || "Single Edition / None",
      accessionNumber: book.accessionNumber || "",
      volumeInfo: {
        title: book.title || book.volumeInfo?.title || "",
        authors: Array.isArray(book.volumeInfo?.authors)
          ? book.volumeInfo.authors
          : [book.author || "Unknown Author"],
        description: book.description || book.summary || book.volumeInfo?.description || "",
        categories: Array.isArray(book.volumeInfo?.categories)
          ? book.volumeInfo.categories
          : [book.category || book.genre || book.department || "Circulation"],
        publishedDate: String(book.publicationDate || book.year || book.volumeInfo?.publishedDate || "2024-01-01"),
        pageCount: Number(book.pages || book.volumeInfo?.pageCount || 320),
        language: book.language || book.volumeInfo?.language || "en",
        imageLinks: {
          thumbnail: book.coverUrl || book.coverImg || book.volumeInfo?.imageLinks?.thumbnail || "https://via.placeholder.com/100",
        },
      },
    };
  }, []);

  const defaultCatalogItems = React.useMemo(() => {
    return (localCatalogBooks || []).slice(0, 100).map((book: any, index: number) => formatSearchItem(book, index));
  }, [formatSearchItem]);

  const [masterBooksPool, setMasterBooksPool] = useState<any[]>(defaultCatalogItems);

  // Helper to merge fetched items into local pool without duplicates
  const mergeBooksPool = useCallback((newItems: any[]) => {
    setMasterBooksPool((prev) => {
      const map = new Map<string, any>();
      prev.forEach((item) => {
        const key = (item.volumeInfo?.title || "").toLowerCase().trim();
        if (key) map.set(key, item);
      });
      newItems.forEach((item) => {
        const key = (item.volumeInfo?.title || "").toLowerCase().trim();
        if (key) map.set(key, item);
      });
      return Array.from(map.values());
    });
  }, []);

  // AI SEMANTIC PROMPT & DOCUMENT SEARCH
  const performAiSearch = useCallback(
    async (
      query: string,
      fileToSearch?: { name: string; mimeType?: string; size?: number; base64?: string } | null,
      dept?: string
    ) => {
      try {
        setLoading(true);
        const headers = await getAuthHeaders();
        const filePayload = fileToSearch !== undefined ? fileToSearch : (selectedFile ? {
          name: selectedFile.name,
          mimeType: selectedFile.mimeType,
          size: selectedFile.size,
          base64: selectedFile.base64,
        } : null);

        let returnedBooks: any[] = [];

        try {
          const res = await axios.post(
            `${API_URL}/api/student/ai-search`,
            {
              prompt: query || "",
              file: filePayload,
              department: dept || activeDepartment,
              limit: 40,
            },
            headers
          );

          if (res.data?.success && Array.isArray(res.data.books)) {
            setAiAnalysis(res.data.aiAnalysis || null);
            returnedBooks = res.data.books;
          }
        } catch (postErr) {
          console.log("ai-search post error, trying fallback:", postErr);
        }

        // If no file attached and AI search returned few results, query the 48k backend database via /books/search?mode=ai
        if (returnedBooks.length === 0 && query.trim().length > 0 && !filePayload) {
          try {
            const aiQueryRes = await axios.get(
              `${API_URL}/api/student/books/search?q=${encodeURIComponent(query)}&limit=200&mode=ai`,
              headers
            );
            if (aiQueryRes.data?.books && Array.isArray(aiQueryRes.data.books)) {
              returnedBooks = aiQueryRes.data.books.map((b: any, idx: number) => formatSearchItem(b, idx));
            }
          } catch (getErr) {
            console.log("ai search fallback error:", getErr);
          }
        }

        if (returnedBooks.length > 0) {
          setAiBooks(returnedBooks);
          mergeBooksPool(returnedBooks);
        }
      } catch (err) {
        console.log("AI search error:", err);
      } finally {
        setLoading(false);
      }
    },
    [selectedFile, activeDepartment, mergeBooksPool, formatSearchItem]
  );

  // FILE PICKER WITH BASE64 EXTRACTION
  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        let base64 = "";
        try {
          if (file.uri) {
            base64 = await FileSystem.readAsStringAsync(file.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          }
        } catch (readErr) {
          console.log("Error reading file base64:", readErr);
        }

        const keywords = await extractFileKeywords({
          name: file.name,
          uri: file.uri,
          mimeType: file.mimeType,
        });

        const fileData = {
          uri: file.uri,
          name: file.name,
          size: file.size,
          mimeType: file.mimeType,
          keywords,
          base64,
        };

        setSelectedFile(fileData);
        // Switch to AI Prompt mode when file is attached
        setIsPrefixFilter(false);
        setCurrentPage(1);

        // Immediately perform AI search with prompt and file
        performAiSearch(searchText, {
          name: file.name,
          mimeType: file.mimeType,
          size: file.size,
          base64,
        });
      }
    } catch (error) {
      console.log("Document picking error:", error);
    }
  };

  // Fetch available books on mount to enrich the client-side catalog
  useEffect(() => {
    let isMounted = true;
    const fetchInitialBooks = async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await axios.get(`${API_URL}/api/student/books?limit=100`, headers);
        if (res.status === 200 && res.data?.books && isMounted) {
          const mapped = res.data.books.map((b: any) => ({
            id: String(b.id),
            isbn: b.isbn || "",
            copies: b.copies !== undefined && b.copies !== null ? b.copies : 1,
            local: true,
            status: b.status || b.availability || "Available",
            shelfLocation: b.shelfLocation || "Shelf A-102",
            volumeInfo: {
              title: b.title || "",
              authors: [b.author || "Unknown Author"],
              description: b.description || b.summary || "",
              categories: [b.category || b.department || "Circulation"],
              publishedDate: String(b.publicationDate || b.year || "2024"),
              pageCount: b.pages || 320,
              language: b.language || "en",
              imageLinks: {
                thumbnail: b.coverUrl || b.coverImg || "https://via.placeholder.com/100",
              },
            },
          }));
          mergeBooksPool(mapped);
        }
      } catch (err) {
        console.log("Initial books fetch error:", err);
      }
    };
    fetchInitialBooks();
    return () => {
      isMounted = false;
    };
  }, [mergeBooksPool]);

  // FETCH BOOKS FROM BACKEND (Prefix or AI mode)
  const fetchBooks = useCallback(
    async (query: string, overrideMode?: boolean) => {
      const usePrefix = overrideMode !== undefined ? overrideMode : isPrefixFilter;

      // If in AI mode or if a file is attached, run AI Search!
      if (!usePrefix || selectedFile !== null) {
        await performAiSearch(query, selectedFile);
        return;
      }

      // Otherwise in Prefix mode without file:
      try {
        setLoading(true);
        setAiAnalysis(null);
        setAiBooks(null);
        const headers = await getAuthHeaders();
        const localRes = await axios.get(
          `${API_URL}/api/student/books/search?q=${encodeURIComponent(query)}&limit=200&mode=prefix`,
          headers
        );
        if (localRes.status === 200 && localRes.data?.books) {
          const fetchedItems = localRes.data.books.map((book: any, idx: number) => formatSearchItem(book, idx));
          mergeBooksPool(fetchedItems);
        }
      } catch (err) {
        console.log("Local search error:", err);
      } finally {
        setLoading(false);
      }
    },
    [mergeBooksPool, isPrefixFilter, selectedFile, performAiSearch]
  );

  const toggleFilterMode = (newValue: boolean) => {
    setIsPrefixFilter(newValue);
    setCurrentPage(1);
    if (!newValue || selectedFile !== null) {
      performAiSearch(searchText, selectedFile);
    } else {
      setAiAnalysis(null);
      setAiBooks(null);
      if (searchText.trim().length > 0) {
        fetchBooks(searchText.trim(), true);
      }
    }
  };

  // HANDLE INCOMING ROUTE PARAMS (FROM HOME SCREEN SEARCH BAR)
  useEffect(() => {
    let isCancelled = false;
    if (fileName && typeof fileName === "string") {
      const kwList = fileKeywords ? fileKeywords.split(",") : [];
      const loadParamFile = async () => {
        let base64 = "";
        if (fileUri) {
          try {
            base64 = await FileSystem.readAsStringAsync(fileUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          } catch (e) {
            console.log("Error reading param file base64:", e);
          }
        }
        if (!isCancelled) {
          const fileData = {
            name: fileName,
            uri: fileUri || "",
            keywords: kwList,
            base64,
          };
          setSelectedFile(fileData);
          setIsPrefixFilter(false);
          performAiSearch(q || "", {
            name: fileName,
            base64,
          });
        }
      };
      loadParamFile();
    }
    if (q && typeof q === "string" && q.trim().length > 0) {
      const incomingQuery = q.trim();
      setSearchText(incomingQuery);
      if (!fileName) {
        fetchBooks(incomingQuery);
      }
      if (!isPrefixFilter) {
        saveSearchQuery(incomingQuery);
      }
    }
    if (autoFocus === "true") {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
    return () => {
      isCancelled = true;
    };
  }, [q, autoFocus, fileName, fileUri, fileKeywords, fetchBooks, performAiSearch, isPrefixFilter]);

  // LIVE SEARCH & PROMPT HISTORY EFFECT
  useEffect(() => {
    const trimmed = searchText.trim();
    if (trimmed.length > 0) {
      const timer = setTimeout(() => {
        fetchBooks(trimmed);
        // Only save to Prompted tab if Filter is OFF (i.e. AI Prompt / Ask BookHive mode)
        if (trimmed.length >= 2 && !isPrefixFilter) {
          saveSearchQuery(trimmed);
        }
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [searchText, isPrefixFilter, fetchBooks]);

  // DEPARTMENT CLICK
  const handleDepartmentPress = (department: string) => {
    setActiveDepartment(department);
    setSearchText(department);
    fetchBooks(department);
  };

  const activeQuery = searchText.trim();
  const isSearchActive = activeQuery.length > 0 || selectedFile !== null;

  // Client-Side Hybrid Multimodal Relevance Match & Scoring
  const processedBooks = React.useMemo(() => {
    if (!isSearchActive) return [];

    // 1. If AI search has returned books from backend (in AI Prompt mode or with file attached), use them!
    if (aiBooks && aiBooks.length > 0 && (!isPrefixFilter || selectedFile !== null)) {
      return aiBooks.map((item: any) => ({
        item,
        match: item.matchPercentage || 85,
      }));
    }

    const fileKw = selectedFile?.keywords || [];
    const isDirectiveOnly = DIRECTIVE_PATTERNS.some((p) => p.test(activeQuery));

    // Gather candidate books across all 48k books:
    let candidatePool: any[] = [];

    // Check if query is a department name (e.g. from department chips)
    const isDeptQuery = departments.some(
      (d) => d.name.toLowerCase() === activeQuery.toLowerCase()
    );

    if (isDeptQuery) {
      const deptMatches = getBooksByDepartment(activeQuery, 200);
      candidatePool = deptMatches.map((b, idx) => formatSearchItem(b, idx));
      masterBooksPool.forEach((item) => {
        const itemDept = (item.department || item.volumeInfo?.categories?.[0] || "").toLowerCase();
        if (itemDept.includes(activeQuery.toLowerCase())) {
          candidatePool.push(item);
        }
      });
    } else if (isPrefixFilter && activeQuery.length > 0) {
      // 1. Title Prefix Filter mode: query the 48,000+ local books via prefix index (instant 1-2 ms)
      const prefixMatches = searchBooksByPrefix(activeQuery, 300);
      candidatePool = prefixMatches.map((b, idx) => formatSearchItem(b, idx));

      // Also combine any backend-fetched books in masterBooksPool that match the prefix
      masterBooksPool.forEach((item) => {
        const title = item.volumeInfo?.title || "";
        if (matchesPrefix(title, activeQuery)) {
          candidatePool.push(item);
        }
      });
    } else if (!isPrefixFilter && activeQuery.length > 0) {
      // 2. AI Prompt / Keyword mode: query the 48,000+ local books via keyword matching
      const kwMatches = searchBooksByKeyword(activeQuery, 150);
      candidatePool = kwMatches.map((b, idx) => formatSearchItem(b, idx));

      // Also merge any backend-fetched items in masterBooksPool
      masterBooksPool.forEach((item) => {
        candidatePool.push(item);
      });
    } else {
      candidatePool = masterBooksPool;
    }

    // Deduplicate candidate pool by title or isbn
    const dedupMap = new Map<string, any>();
    candidatePool.forEach((item) => {
      const key = (item.volumeInfo?.title || item.title || "").toLowerCase().trim();
      if (key && !dedupMap.has(key)) {
        dedupMap.set(key, item);
      }
    });
    const uniqueCandidates = Array.from(dedupMap.values());

    return uniqueCandidates
      .map((item: any) => {
        const info = item.volumeInfo || {};
        const title = info.title || "";
        const author = (info.authors || []).join(" ") || "";
        const description = info.description || "";
        const category = (info.categories || []).join(" ") || "";
        const bookFullText = `${title} ${author} ${description} ${category}`.toLowerCase();

        // 1. Text Query Match Score (Prefix mode vs AI Prompt mode)
        let textScore = 0;
        if (activeQuery.length > 0) {
          textScore = isPrefixFilter
            ? calculateMatchPercentage(title, activeQuery)
            : calculateAiPromptMatchPercentage(
                {
                  title,
                  author,
                  description,
                  category,
                },
                activeQuery,
                Boolean(selectedFile)
              );
        }

        // 2. File Context Match Score
        let fileScore = 0;
        if (selectedFile && selectedFile.name) {
          const kwList = fileKw.length > 0
            ? fileKw
            : selectedFile.name.replace(/\.[^/.]+$/, "").split(/[\s_.-]+/).map((w) => w.toLowerCase());

          let kwMatches = 0;
          for (const kw of kwList) {
            if (kw && kw.length > 1 && bookFullText.includes(kw.toLowerCase())) {
              kwMatches++;
            }
          }
          if (kwList.length > 0) {
            fileScore = Math.min(100, Math.round((kwMatches / Math.min(kwList.length, 3)) * 85) + (kwMatches > 0 ? 15 : 0));
          } else {
            fileScore = 50;
          }
        }

        // 3. Hybrid Combination Score Calculation
        let finalScore = 0;
        if (activeQuery.length > 0 && selectedFile !== null) {
          if (isDirectiveOnly) {
            finalScore = fileScore > 0 ? fileScore : 80;
          } else if (textScore > 0) {
            finalScore = fileScore > 0 ? Math.min(100, Math.round(textScore * 0.5 + fileScore * 0.5)) : textScore;
          } else {
            finalScore = fileScore > 0 ? Math.round(fileScore * 0.85) : 0;
          }
        } else if (activeQuery.length > 0) {
          finalScore = textScore;
        } else if (selectedFile !== null) {
          finalScore = fileScore;
        }

        return { item, match: finalScore };
      })
      .filter((entry: any) => entry.match > 0)
      .sort((a: any, b: any) => {
        if (b.match !== a.match) {
          return b.match - a.match;
        }
        return (a.item.volumeInfo?.title || "").localeCompare(
          b.item.volumeInfo?.title || ""
        );
      });
  }, [masterBooksPool, activeQuery, selectedFile, isSearchActive, isPrefixFilter, aiBooks, departments, formatSearchItem]);

    const itemsPerPage = 10;
    const totalPages = Math.max(1, Math.ceil(processedBooks.length / itemsPerPage));
    const paginatedBooks = processedBooks.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  
    return (
      <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
        {/* HEADER */}
        <View style={[styles.header, { paddingTop: insets.top, height: 70 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons
              name="arrow-back"
              size={22}
              color={isDarkMode ? theme.accentGold : theme.accentBlue}
            />
          </TouchableOpacity>
  
          <Text style={[styles.headerTitle, { color: theme.headerTitle }]}>
            BOOKHIVE SEARCH
          </Text>
  
          <TouchableOpacity
            style={styles.notificationButtonRelative}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons
              name="notifications-outline"
              size={22}
              color={isDarkMode ? theme.accentGold : theme.accentBlue}
            />
            {unreadCount > 0 && (
              <View style={styles.badgeContainerRelative}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: 120,
          }}
        >
          {/* HERO CARD */}
          <View style={[styles.heroCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={styles.aiRow}>
                <Animated.View style={{ transform: [{ scale: aiPulseAnim }] }}>
                  <MaterialCommunityIcons
                    name="robot-outline"
                    size={18}
                    color={isDarkMode ? theme.accentGold : theme.accentBlue}
                  />
                </Animated.View>

                <Text style={[styles.aiText, { color: isDarkMode ? theme.accentGold : theme.accentBlue }]}>
                  ASK BOOKHIVE
                </Text>
              </View>

              {/* FILTER TOGGLE (Equal width and height in both ON and OFF states) */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => toggleFilterMode(!isPrefixFilter)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: 136,
                  height: 32,
                  backgroundColor: isPrefixFilter
                    ? (isDarkMode ? "rgba(255, 243, 0, 0.12)" : "rgba(2, 116, 187, 0.10)")
                    : (isDarkMode ? "rgba(56, 189, 248, 0.14)" : "rgba(2, 132, 199, 0.10)"),
                  borderWidth: 1,
                  borderColor: isPrefixFilter
                    ? (isDarkMode ? "rgba(255, 243, 0, 0.5)" : "#0274BB")
                    : (isDarkMode ? "rgba(56, 189, 248, 0.5)" : "#0284C7"),
                  paddingHorizontal: 9,
                  borderRadius: 16,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Ionicons
                    name={isPrefixFilter ? "funnel-outline" : "sparkles"}
                    size={12}
                    color={isPrefixFilter
                      ? (isDarkMode ? theme.accentGold : theme.accentBlue)
                      : (isDarkMode ? "#38BDF8" : "#0284C7")}
                  />
                  <Text style={{
                    fontSize: 10.5,
                    fontWeight: "800",
                    letterSpacing: 0.3,
                    color: isPrefixFilter
                      ? (isDarkMode ? theme.accentGold : theme.accentBlue)
                      : (isDarkMode ? "#38BDF8" : "#0284C7")
                  }}>
                    {isPrefixFilter ? "FILTER: ON" : "FILTER: OFF"}
                  </Text>
                </View>
                <Switch
                  value={isPrefixFilter}
                  onValueChange={(val) => toggleFilterMode(val)}
                  trackColor={{
                    false: isDarkMode ? "#334155" : "#CBD5E1",
                    true: isDarkMode ? "rgba(255, 243, 0, 0.5)" : "rgba(2, 116, 187, 0.5)"
                  }}
                  thumbColor={isPrefixFilter ? (isDarkMode ? theme.accentGold : "#0274BB") : "#94A3B8"}
                  style={{ transform: [{ scaleX: 0.72 }, { scaleY: 0.72 }], marginVertical: -4, marginRight: -4 }}
                />
              </TouchableOpacity>
            </View>

            {/* UNCOLLAPSED TITLE (EMPTY STATE ONLY) */}
            {!isSearchActive && (
              <Text style={[styles.heroTitle, { color: theme.sectionTitle }]}>
                Search our entire digital ecosystem with AI intelligence.
              </Text>
            )}

            {/* SEARCH BAR */}
            <View style={[
              styles.searchBar,
              {
                backgroundColor: theme.background,
                borderColor: theme.cardBorder,
                marginTop: isSearchActive ? 12 : 20,
                alignItems: !isPrefixFilter && (searchText.length > 20 || inputHeight > 42) ? "flex-start" : "center",
                minHeight: !isPrefixFilter ? Math.max(56, inputHeight + 14) : 56,
              }
            ]}>
              <Feather
                name="search"
                size={18}
                color={isDarkMode ? theme.accentGold : theme.accentBlue}
                style={{ marginTop: !isPrefixFilter && (searchText.length > 20 || inputHeight > 42) ? 6 : 0 }}
              />

              <TextInput
                ref={inputRef}
                value={searchText}
                onChangeText={handleSearchTextChange}
                placeholder={isPrefixFilter ? "Search by title prefix (e.g. B, BR)..." : "Ask BookHive or search prompt/keywords..."}
                placeholderTextColor={isDarkMode ? "#64748B" : "#94A3B8"}
                style={[
                  styles.input,
                  {
                    color: isDarkMode ? theme.textPrimary : "#0F172A",
                    textAlignVertical: !isPrefixFilter ? "top" : "center",
                    minHeight: !isPrefixFilter ? Math.max(38, inputHeight) : 38,
                    paddingTop: Platform.OS === 'ios' ? (!isPrefixFilter ? 6 : 0) : (!isPrefixFilter ? 4 : 0),
                    paddingBottom: Platform.OS === 'ios' ? (!isPrefixFilter ? 6 : 0) : (!isPrefixFilter ? 4 : 0),
                  }
                ]}
                multiline={!isPrefixFilter}
                onContentSizeChange={(e) => {
                  if (!isPrefixFilter) {
                    setInputHeight(Math.max(38, Math.min(120, e.nativeEvent.contentSize.height)));
                  }
                }}
                blurOnSubmit={true}
                onSubmitEditing={() => {
                  if (!isPrefixFilter && searchText.trim().length >= 2) {
                    saveSearchQuery(searchText.trim());
                  }
                  fetchBooks(searchText);
                }}
                returnKeyType="search"
              />

              {/* ATTACHMENT BUTTON */}
              <TouchableOpacity
                style={[
                  styles.iconButton,
                  { marginTop: !isPrefixFilter && (searchText.length > 20 || inputHeight > 42) ? 4 : 0 }
                ]}
                onPress={pickDocument}
              >
                <Feather
                  name="paperclip"
                  size={18}
                  color={isDarkMode ? theme.accentGold : theme.accentBlue}
                />
              </TouchableOpacity>

              {/* ANALYZE BUTTON (Matches Web System) */}
              <TouchableOpacity
                onPress={() => {
                  if (!isPrefixFilter && searchText.trim().length >= 2) {
                    saveSearchQuery(searchText.trim());
                  }
                  fetchBooks(searchText);
                }}
                activeOpacity={0.85}
                style={{
                  backgroundColor: isDarkMode ? theme.accentGold : theme.buttonPrimaryBg,
                  paddingHorizontal: 11,
                  paddingVertical: 5.5,
                  borderRadius: 14,
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 4,
                  marginTop: !isPrefixFilter && (searchText.length > 20 || inputHeight > 42) ? 4 : 0,
                }}
              >
                <Text style={{
                  color: isDarkMode ? "#090D16" : theme.buttonPrimaryText,
                  fontWeight: "800",
                  fontSize: 11,
                  letterSpacing: 0.5,
                }}>
                  ANALYZE
                </Text>
              </TouchableOpacity>
            </View>

            {/* SEARCH MODE HINT BAR */}
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 9,
              paddingHorizontal: 6,
              gap: 5,
            }}>
              <Ionicons
                name={isPrefixFilter ? "funnel-outline" : "sparkles-outline"}
                size={12}
                color={isPrefixFilter
                  ? (isDarkMode ? theme.accentGold : theme.accentBlue)
                  : (isDarkMode ? "#38BDF8" : "#0284C7")}
              />
              <Text style={{
                fontSize: 11,
                color: theme.textSecondary,
                fontWeight: "600",
              }}>
                {isPrefixFilter
                  ? "Title Prefix Filter: Matches first letters of title (A-Z)"
                  : "AI Prompt Mode: Natural language prompts, authors & keywords"}
              </Text>
            </View>

            {/* SELECTED FILE PREVIEW */}
            {selectedFile && (
              <View style={[styles.filePreviewCard, { backgroundColor: theme.background, borderColor: theme.cardBorder }]}>
                <Ionicons
                  name="document-outline"
                  size={22}
                  color={isDarkMode ? theme.accentGold : theme.accentBlue}
                />
                <Text style={[styles.filePreviewName, { color: theme.textPrimary }]} numberOfLines={1}>
                  {selectedFile.name}
                </Text>
                <TouchableOpacity onPress={() => {
                  setSelectedFile(null);
                  setAiAnalysis(null);
                  setAiBooks(null);
                  if (searchText.trim().length > 0) {
                    fetchBooks(searchText.trim());
                  }
                }}>
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color="#EF4444"
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* SEARCH ACTIVE STATE: RESULTS & PAGINATION */}
          {isSearchActive && (
            <View style={styles.resultsContainer}>
              {/* RESULTS HEADER */}
              <View style={styles.resultHeader}>
                <Text style={[styles.resultTitle, { color: theme.textSecondary }]}>
                  QUERY RESULTS ({processedBooks.length})
                </Text>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{
                    paddingHorizontal: 7,
                    paddingVertical: 2.5,
                    borderRadius: 8,
                    backgroundColor: isPrefixFilter
                      ? (isDarkMode ? "rgba(255, 243, 0, 0.15)" : "rgba(2, 116, 187, 0.12)")
                      : (isDarkMode ? "rgba(56, 189, 248, 0.15)" : "rgba(2, 132, 199, 0.12)"),
                  }}>
                    <Text style={{
                      fontSize: 10,
                      fontWeight: "800",
                      color: isPrefixFilter
                        ? (isDarkMode ? theme.accentGold : theme.accentBlue)
                        : (isDarkMode ? "#38BDF8" : "#0284C7"),
                    }}>
                      {isPrefixFilter ? "PREFIX A-Z" : "AI PROMPT"}
                    </Text>
                  </View>
                  <Text style={[styles.resultSort, { color: theme.textSecondary }]}>
                    SORT: RELEVANCE
                  </Text>
                </View>
              </View>

              {/* AI ANALYSIS SUMMARY CARD */}
              {aiAnalysis && (
                <View style={[
                  styles.aiAnalysisCard,
                  {
                    backgroundColor: isDarkMode ? "rgba(56, 189, 248, 0.08)" : "rgba(2, 132, 199, 0.07)",
                    borderColor: isDarkMode ? "rgba(56, 189, 248, 0.3)" : "rgba(2, 132, 199, 0.22)",
                  }
                ]}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <MaterialCommunityIcons
                        name="robot-outline"
                        size={17}
                        color={isDarkMode ? "#38BDF8" : "#0284C7"}
                      />
                      <Text style={{
                        fontSize: 11.5,
                        fontWeight: "800",
                        color: isDarkMode ? "#38BDF8" : "#0284C7",
                        letterSpacing: 0.5,
                      }}>
                        AI SEMANTIC ANALYSIS
                      </Text>
                    </View>
                    <View style={{
                      backgroundColor: isDarkMode ? "rgba(56, 189, 248, 0.2)" : "rgba(2, 132, 199, 0.15)",
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 10,
                    }}>
                      <Text style={{
                        fontSize: 10,
                        fontWeight: "800",
                        color: isDarkMode ? "#38BDF8" : "#0284C7",
                      }}>
                        {aiAnalysis.totalMatches} MATCHES
                      </Text>
                    </View>
                  </View>

                  <Text style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: isDarkMode ? theme.textPrimary : "#1E293B",
                    lineHeight: 18,
                    marginBottom: 8,
                  }}>
                    {aiAnalysis.summary}
                  </Text>

                  {aiAnalysis.topics && aiAnalysis.topics.length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
                      {aiAnalysis.topics.map((topic: string, tIdx: number) => (
                        <View
                          key={tIdx}
                          style={{
                            backgroundColor: isDarkMode ? "rgba(255, 243, 0, 0.15)" : theme.badgeYellowBg,
                            paddingHorizontal: 8,
                            paddingVertical: 2.5,
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: isDarkMode ? "rgba(255, 243, 0, 0.3)" : theme.badgeYellowBorder,
                          }}
                        >
                          <Text style={{
                            fontSize: 10,
                            fontWeight: "800",
                            color: isDarkMode ? "#FFD700" : theme.badgeYellowText,
                          }}>
                            #{topic}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* LOADING */}
              {loading && (
                <ActivityIndicator
                  size="large"
                  color={isDarkMode ? theme.accentGold : theme.accentBlue}
                  style={{ marginTop: 30, marginBottom: 30 }}
                />
              )}

              {/* RESULT CARDS */}
              {!loading && paginatedBooks.length > 0 && (
                paginatedBooks.map(({ item, match }: { item: any; match: number }, index: number) => {
                  const info = item.volumeInfo || {};
                  const authorNames = info.authors?.join(", ") || info.author || "Unknown Author";

                  const classifiedDepartment =
                    classifyBookDepartment(
                      info.title || "",
                      info.description || "",
                      info.categories || [],
                      searchText,
                      activeDepartment
                    );

                  return (
                    <TouchableOpacity
                      key={`search-item-${item.id || index}-${index}`}
                      activeOpacity={0.7}
                      style={[styles.bookCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                      onPress={() => {
                        const bookObj = {
                          id: item.id || '',
                          title: info.title || '',
                          author: authorNames,
                          description: info.description || 'No description available.',
                          available: item.local ? (item.status === 'Available' ? 'true' : 'false') : 'true',
                          department: item.department || classifiedDepartment,
                          category: info.categories?.[0] || item.department || classifiedDepartment,
                          isbn: item.isbn || info.industryIdentifiers?.find((i: any) => i.type === 'ISBN_13')?.identifier || info.industryIdentifiers?.find((i: any) => i.type === 'ISBN_10')?.identifier || '',
                          shelf: item.local ? (item.shelfLocation || 'Shelf A, Row 2') : 'Shelf A-102, 2nd Floor',
                          year: info.publishedDate ? info.publishedDate.split('-')[0] : '2026',
                          publicationDate: info.publishedDate || '2026-09-01',
                          pages: String(info.pageCount || 320),
                          language: info.language || 'en',
                          copies: String(item.copies !== undefined ? item.copies : 1),
                          volume: item.volume || 'Single Volume / None',
                          edition: item.edition || 'Single Edition / None',
                          accessionNumber: item.accessionNumber || '',
                        };
                        saveBookToViewHistory(bookObj);
                        router.push({
                          pathname: '/book-details',
                          params: {
                            from: 'search',
                            ...bookObj,
                          },
                        });
                      }}
                    >
                      {/* LEFT: TITLE & AUTHOR */}
                      <View style={styles.cardLeftContent}>
                        <Text
                          style={[styles.bookTitle, { color: theme.textPrimary }]}
                          numberOfLines={1}
                        >
                          {info.title}
                        </Text>
                        <Text
                          style={[styles.authorText, { color: theme.textSecondary }]}
                          numberOfLines={1}
                        >
                          By: {authorNames}
                        </Text>
                      </View>

                      {/* RIGHT: MATCH BADGE */}
                      <View style={[styles.matchBadge, { backgroundColor: isDarkMode ? "rgba(255, 215, 0, 0.15)" : theme.badgeYellowBg, borderColor: isDarkMode ? "rgba(255, 215, 0, 0.3)" : theme.badgeYellowBorder, borderWidth: 1 }]}>
                        <Text style={[styles.matchPercentText, { color: isDarkMode ? "#FFD700" : theme.badgeYellowText, fontWeight: "900" }]}>
                          {match}%
                        </Text>
                        <Text style={[styles.matchLabelText, { color: isDarkMode ? "#FFD700" : theme.badgeYellowText, fontWeight: "800" }]}>
                          MATCH
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}

              {/* EMPTY RESULTS STATE */}
              {!loading && processedBooks.length === 0 && (
                <View style={styles.emptyBox}>
                  <MaterialCommunityIcons
                    name="book-search-outline"
                    size={50}
                    color={theme.textSecondary}
                  />
                  <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                    No books match your query
                  </Text>
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    Try searching for another title, author, or keyword.
                  </Text>
                </View>
              )}

              {/* PAGINATION CONTROLS */}
              {!loading && processedBooks.length > 0 && (
                <View style={styles.paginationRow}>
                  <TouchableOpacity
                    style={[
                      styles.paginationArrowBtn,
                      currentPage <= 1 && styles.paginationArrowDisabled
                    ]}
                    disabled={currentPage <= 1}
                    onPress={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={24}
                      color={currentPage > 1 ? (isDarkMode ? theme.accentGold : theme.accentBlue) : (isDarkMode ? "#475569" : "#CBD5E1")}
                    />
                  </TouchableOpacity>

                  <View style={[styles.pageNumberBox, { backgroundColor: !isDarkMode ? theme.tabBarActivePill : theme.cardBg, borderColor: !isDarkMode ? theme.badgeYellowBorder : theme.cardBorder }]}>
                    <Text style={[styles.pageNumberText, { color: !isDarkMode ? "#0274BB" : theme.textPrimary, fontWeight: "800" }]}>
                      {currentPage}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.paginationArrowBtn,
                      currentPage >= totalPages && styles.paginationArrowDisabled
                    ]}
                    disabled={currentPage >= totalPages}
                    onPress={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={24}
                      color={currentPage < totalPages ? (isDarkMode ? theme.accentGold : theme.accentBlue) : (isDarkMode ? "#475569" : "#CBD5E1")}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </AnimatedScreen>
    );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080F1E",
  },

  header: {
    height: 70,
    backgroundColor: "#080F1E",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#111A2E",
  },

  headerTitle: {
    color: "#F8FAFC",
    fontWeight: "800",
    fontSize: 18,
    letterSpacing: 1.2,
  },

  heroCard: {
    backgroundColor: "#111A2E",
    margin: 20,
    borderRadius: 30,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1E293B",
  },

  aiRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  aiText: {
    color: "#FCD34D",
    marginLeft: 8,
    fontWeight: "800",
    letterSpacing: 1,
  },

  heroTitle: {
    color: "#F8FAFC",
    fontSize: 26,
    fontWeight: "800",
    marginTop: 16,
    lineHeight: 36,
  },

  searchBar: {
    marginTop: 24,
    backgroundColor: "#080F1E",
    borderRadius: 20,
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#1E293B",
  },

  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: "#F8FAFC",
    maxHeight: 120,
  },

  iconButton: {
    marginLeft: 10,
  },

  analyzeBtn: {
    backgroundColor: "#FCD34D",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    marginLeft: 12,
  },

  analyzeText: {
    color: "#080F1E",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 1,
  },

  previewImage: {
    width: "100%",
    height: 180,
    borderRadius: 20,
    marginTop: 18,
  },

  filePreviewCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#080F1E",
    padding: 12,
    borderRadius: 14,
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#1E293B",
    gap: 12,
  },

  filePreviewName: {
    color: "#F8FAFC",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },

  suggestionContainer: {
    marginTop: 14,
  },

  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1E293B",
  },

  suggestionText: {
    color: "#F8FAFC",
    marginLeft: 10,
    fontSize: 14,
  },

  departmentContainer: {
    marginHorizontal: 20,
  },

  departmentTitle: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 14,
  },

  activeChip: {
    backgroundColor: "#FCD34D",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    marginRight: 10,
  },

  activeChipText: {
    color: "#080F1E",
    fontWeight: "800",
    fontSize: 11,
  },

  chip: {
    backgroundColor: "#111A2E",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#1E293B",
  },

  chipText: {
    color: "#94A3B8",
    fontWeight: "700",
    fontSize: 11,
  },

  departmentInfoCard: {
    marginTop: 16,
    backgroundColor: "#111A2E",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
  },

  departmentInfoTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FCD34D",
    marginBottom: 8,
  },

  departmentInfoText: {
    color: "#CBD5E1",
    fontSize: 13,
    lineHeight: 20,
  },

  resultsContainer: {
    paddingBottom: 20,
  },

  resultHeader: {
    marginTop: 16,
    marginBottom: 12,
    marginHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  resultTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#64748B",
    textTransform: "uppercase",
  },

  resultSort: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  bookCard: {
    backgroundColor: "#111A2E",
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: "#1E293B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cardLeftContent: {
    flex: 1,
    marginRight: 14,
  },

  bookTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#F8FAFC",
    marginBottom: 4,
  },

  authorText: {
    color: "#94A3B8",
    fontStyle: "italic",
    fontSize: 13,
  },

  matchBadge: {
    backgroundColor: "#FCD34D",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 78,
  },

  matchPercentText: {
    color: "#080F1E",
    fontWeight: "900",
    fontSize: 13,
    lineHeight: 16,
  },

  matchLabelText: {
    color: "#080F1E",
    fontWeight: "900",
    fontSize: 10,
    letterSpacing: 0.5,
    lineHeight: 13,
  },

  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
    marginBottom: 20,
    gap: 16,
  },

  paginationArrowBtn: {
    padding: 8,
  },

  paginationArrowDisabled: {
    opacity: 0.3,
  },

  pageNumberBox: {
    backgroundColor: "#111A2E",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1E293B",
    minWidth: 48,
    alignItems: "center",
    justifyContent: "center",
  },

  pageNumberText: {
    color: "#F8FAFC",
    fontWeight: "800",
    fontSize: 18,
  },

  emptyBox: {
    marginTop: 60,
    alignItems: "center",
    paddingHorizontal: 40,
  },

  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "800",
    color: "#F8FAFC",
  },

  emptyText: {
    marginTop: 8,
    textAlign: "center",
    color: "#94A3B8",
    lineHeight: 20,
  },

  notificationButtonRelative: {
    position: "relative",
    padding: 4,
  },
  badgeContainerRelative: {
    position: "absolute",
    right: -2,
    top: -2,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "bold",
  },
  aiAnalysisCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
});