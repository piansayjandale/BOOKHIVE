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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimatedScreen from "../../components/AnimatedScreen";
import axios from "axios";
import * as DocumentPicker from "expo-document-picker";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useThemeColors } from "../../hooks/useThemeColors";
import {
  Feather,
  Ionicons,
  MaterialCommunityIcons,
  Entypo,
} from "@expo/vector-icons";
import { API_URL, getAuthHeaders } from "../../data/authService";
import { saveSearchQuery, getNotifications, subscribe, NotificationItem } from "../../data/store";
import localCatalogBooks from "../../data/books";
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
 * Real-Time Prefix Matching Search Algorithm
 * Checks if query matches the prefix of any word in the target text,
 * or if the full text starts with the query (case-insensitive).
 */
export const matchesPrefix = (text: string, query: string): boolean => {
  if (!text || !query) return false;

  const normalizedQuery = query.toLowerCase().trim();
  if (normalizedQuery.length === 0) return false;

  const normalizedText = text.toLowerCase().trim();

  // 1. Direct prefix match of full string
  if (normalizedText.startsWith(normalizedQuery)) {
    return true;
  }

  // 2. Tokenize text into words (removing non-alphanumeric punctuation)
  const words = normalizedText
    .split(/[\s,.:;!?'"()\[\]\/-]+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);

  const queryWords = normalizedQuery
    .split(/[\s,.:;!?'"()\[\]\/-]+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);

  if (queryWords.length === 0) return false;

  // Single word search: check if any word in title/text starts with search prefix
  if (queryWords.length === 1) {
    const q = queryWords[0];
    return words.some((w) => w.startsWith(q));
  }

  // Multi-word search: check sequence of word prefixes
  for (let i = 0; i <= words.length - queryWords.length; i++) {
    let match = true;
    for (let j = 0; j < queryWords.length; j++) {
      if (!words[i + j].startsWith(queryWords[j])) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }

  // Fallback: all query words match prefixes of some words in text
  return queryWords.every((q) => words.some((w) => w.startsWith(q)));
};

/**
 * Dynamic Real-Time Match Percentage Scoring Calculation
 * Formula: Match Percentage = (Length of Query / Length of Target Title or Matching Word) * 100
 * Clamped between 0% and 100%.
 */
export const calculateMatchPercentage = (
  title: string,
  query: string,
  author: string = ""
): number => {
  if (!title || !query) return 0;

  const normalizedQuery = query.toLowerCase().trim();
  if (normalizedQuery.length === 0) return 0;

  const normalizedTitle = title.toLowerCase().trim();

  const titleWords = normalizedTitle
    .split(/[\s,.:;!?'"()\[\]\/-]+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);

  const queryWords = normalizedQuery
    .split(/[\s,.:;!?'"()\[\]\/-]+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);

  if (queryWords.length === 0) return 0;

  let highestScore = 0;

  if (queryWords.length === 1) {
    const q = queryWords[0];

    // Evaluate matching words in title starting with q
    for (const word of titleWords) {
      if (word.startsWith(q)) {
        const ratio = Math.round((q.length / word.length) * 100);
        if (ratio > highestScore) {
          highestScore = ratio;
        }
      }
    }

    // Evaluate clean full title prefix match
    const cleanFullTitle = normalizedTitle.replace(/[^a-z0-9]/g, "");
    if (cleanFullTitle.startsWith(q)) {
      const ratio = Math.round((q.length / cleanFullTitle.length) * 100);
      if (ratio > highestScore) {
        highestScore = ratio;
      }
    }

    // If title has no match but author does
    if (highestScore === 0 && author) {
      const authorWords = author
        .toLowerCase()
        .split(/[\s,.:;!?'"()\[\]\/-]+/)
        .map((w) => w.replace(/[^a-z0-9]/g, ""))
        .filter(Boolean);

      for (const word of authorWords) {
        if (word.startsWith(q)) {
          const ratio = Math.round((q.length / word.length) * 100);
          if (ratio > highestScore) {
            highestScore = ratio;
          }
        }
      }
    }

    return Math.min(100, Math.max(0, highestScore));
  }

  // Multi-word query evaluation
  const cleanFullTitle = normalizedTitle.replace(/[^a-z0-9\s]/g, "");
  if (cleanFullTitle.startsWith(normalizedQuery)) {
    const ratio = Math.round((normalizedQuery.length / cleanFullTitle.length) * 100);
    highestScore = Math.max(highestScore, ratio);
  }

  let matchedQueryLen = 0;
  let matchedTargetLen = 0;

  for (const qWord of queryWords) {
    const matchedWord = titleWords.find((w) => w.startsWith(qWord));
    if (matchedWord) {
      matchedQueryLen += qWord.length;
      matchedTargetLen += matchedWord.length;
    }
  }

  if (matchedTargetLen > 0) {
    const ratio = Math.round((matchedQueryLen / matchedTargetLen) * 100);
    highestScore = Math.max(highestScore, ratio);
  }

  return Math.min(100, Math.max(0, highestScore));
};

export const extractFileKeywords = async (file: { name: string; uri?: string; mimeType?: string }): Promise<string[]> => {
  if (!file || !file.name) return [];

  const nameKeywords = file.name
    .replace(/\.[^/.]+$/, "")
    .split(/[\s_.\-\/\(\)\[\]]+/)
    .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

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

  return Array.from(new Set([...nameKeywords, ...textContentKeywords]));
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
  } | null>(null);

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

  // FILE PICKER
  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const keywords = await extractFileKeywords({
          name: file.name,
          uri: file.uri,
          mimeType: file.mimeType,
        });

        setSelectedFile({
          uri: file.uri,
          name: file.name,
          size: file.size,
          mimeType: file.mimeType,
          keywords,
        });
      }
    } catch (error) {
      console.log("Document picking error:", error);
    }
  };

  const defaultCatalogItems = React.useMemo(() => {
    return (localCatalogBooks || []).map((book: any, index: number) => ({
      id: book.id || book.isbn || `cat-book-${index}`,
      isbn: book.isbn || "",
      local: true,
      status: book.available !== false ? "Available" : "Borrowed",
      shelfLocation: book.shelfLocation || "Shelf A-102",
      volumeInfo: {
        title: book.title || "",
        authors: [book.author || "Unknown Author"],
        description: book.description || book.summary || "",
        categories: [book.department || "Circulation"],
        publishedDate: String(book.year || "2024"),
        pageCount: book.pages || 320,
        language: "en",
        imageLinks: {
          thumbnail: "https://via.placeholder.com/100",
        },
      },
    }));
  }, []);

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

  // FETCH BOOKS FROM BACKEND
  const fetchBooks = useCallback(async (query: string) => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const localRes = await axios.get(
        `${API_URL}/api/student/books/search?q=${encodeURIComponent(query)}`,
        headers
      );
      if (localRes.status === 200 && localRes.data?.books) {
        const fetchedItems = localRes.data.books.map((book: any) => ({
          volumeInfo: {
            title: book.title,
            authors: [book.author],
            description: book.description || book.summary || "",
            categories: [book.category || book.department || "Circulation"],
            publishedDate: String(book.publicationDate || book.year || "2024"),
            pageCount: book.pages || 320,
            language: book.language || "en",
            imageLinks: {
              thumbnail: book.coverUrl || book.coverImg || "https://via.placeholder.com/100",
            },
          },
          id: String(book.id),
          isbn: book.isbn,
          local: true,
          status: book.status || book.availability || "Available",
          shelfLocation: book.shelfLocation || "",
        }));
        mergeBooksPool(fetchedItems);
      }
    } catch (err) {
      console.log("Local search error:", err);
    } finally {
      setLoading(false);
    }
  }, [mergeBooksPool]);

  // HANDLE INCOMING ROUTE PARAMS (FROM HOME SCREEN SEARCH BAR)
  useEffect(() => {
    if (fileName && typeof fileName === "string") {
      const kwList = fileKeywords ? fileKeywords.split(",") : [];
      setSelectedFile({
        name: fileName,
        uri: fileUri || "",
        keywords: kwList,
      });
    }
    if (q && typeof q === "string" && q.trim().length > 0) {
      const incomingQuery = q.trim();
      setSearchText(incomingQuery);
      fetchBooks(incomingQuery);
      saveSearchQuery(incomingQuery);
    }
    if (autoFocus === "true") {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [q, autoFocus, fileName, fileUri, fileKeywords, fetchBooks]);

  // SAVE SEARCH QUERY EFFECT
  useEffect(() => {
    if (searchText.trim().length > 0) {
      saveSearchQuery(searchText);
    }
  }, [searchText]);

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

    const fileKw = selectedFile?.keywords || [];

    return masterBooksPool
      .map((item: any) => {
        const info = item.volumeInfo || {};
        const title = info.title || "";
        const author = (info.authors || []).join(" ") || "";
        const description = info.description || "";
        const category = (info.categories || []).join(" ") || "";
        const bookFullText = `${title} ${author} ${description} ${category}`.toLowerCase();

        // 1. Text Query Match Score
        let textScore = 0;
        if (activeQuery.length > 0) {
          textScore = calculateMatchPercentage(title, activeQuery, author);
          if (textScore === 0) {
            if (matchesPrefix(category, activeQuery) || matchesPrefix(description, activeQuery)) {
              textScore = 40;
            }
          }
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
          // Case C: Hybrid Search (Text + File) - Boost items matching both query AND file context!
          if (textScore > 0 && fileScore > 0) {
            finalScore = Math.min(100, Math.round(textScore * 0.5 + fileScore * 0.5) + 20);
          } else if (textScore > 0) {
            finalScore = Math.round(textScore * 0.7);
          } else if (fileScore > 0) {
            finalScore = Math.round(fileScore * 0.7);
          }
        } else if (activeQuery.length > 0) {
          // Case A: Text Only Search
          finalScore = textScore;
        } else if (selectedFile !== null) {
          // Case B: File Only Search
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
  }, [masterBooksPool, activeQuery, selectedFile, isSearchActive]);

    const itemsPerPage = 5;
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
              color={theme.accentGold}
            />
          </TouchableOpacity>
  
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
            BOOKHIVE SEARCH
          </Text>
  
          <TouchableOpacity
            style={styles.notificationButtonRelative}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons
              name="notifications-outline"
              size={22}
              color={theme.accentGold}
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
            <View style={styles.aiRow}>
              <MaterialCommunityIcons
                name="robot-outline"
                size={18}
                color={theme.accentGold}
              />

              <Text style={[styles.aiText, { color: theme.accentGold }]}>
                ASK BOOKHIVE
              </Text>
            </View>

            {/* UNCOLLAPSED TITLE (EMPTY STATE ONLY) */}
            {!isSearchActive && (
              <Text style={[styles.heroTitle, { color: theme.textPrimary }]}>
                Search our entire digital ecosystem with AI intelligence.
              </Text>
            )}

            {/* SEARCH BAR */}
            <View style={[styles.searchBar, { backgroundColor: theme.background, borderColor: theme.cardBorder, marginTop: isSearchActive ? 12 : 20 }]}>
              <Feather
                name="search"
                size={18}
                color={theme.accentGold}
              />

              <TextInput
                ref={inputRef}
                value={searchText}
                onChangeText={handleSearchTextChange}
                placeholder="Search books..."
                placeholderTextColor={isDarkMode ? "#64748B" : "#94A3B8"}
                style={[styles.input, { color: theme.textPrimary }]}
                blurOnSubmit={true}
                onSubmitEditing={() => fetchBooks(searchText)}
                returnKeyType="search"
              />

              {/* ATTACHMENT BUTTON */}
              <TouchableOpacity
                style={styles.iconButton}
                onPress={pickDocument}
              >
                <Feather
                  name="paperclip"
                  size={18}
                  color={theme.accentGold}
                />
              </TouchableOpacity>
            </View>

            {/* SELECTED FILE PREVIEW */}
            {selectedFile && (
              <View style={[styles.filePreviewCard, { backgroundColor: theme.background, borderColor: theme.cardBorder }]}>
                <Ionicons
                  name="document-outline"
                  size={22}
                  color={theme.accentGold}
                />
                <Text style={[styles.filePreviewName, { color: theme.textPrimary }]} numberOfLines={1}>
                  {selectedFile.name}
                </Text>
                <TouchableOpacity onPress={() => setSelectedFile(null)}>
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
                  QUERY RESULTS
                </Text>

                <Text style={[styles.resultSort, { color: theme.textSecondary }]}>
                  SORT: RELEVANCE
                </Text>
              </View>

              {/* LOADING */}
              {loading && (
                <ActivityIndicator
                  size="large"
                  color={theme.accentGold}
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
                      key={item.id || index}
                      style={[styles.bookCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                      onPress={() =>
                        router.push({
                          pathname: '/book-details',
                          params: {
                            from: 'search',
                            id: item.id || '',
                            title: info.title || '',
                            author: authorNames,
                            description: info.description || 'No description available.',
                            available: item.local ? (item.status === 'Available' ? 'true' : 'false') : 'true',
                            department: classifiedDepartment,
                            category: info.categories?.[0] || classifiedDepartment,
                            isbn: item.isbn || info.industryIdentifiers?.find((i: any) => i.type === 'ISBN_13')?.identifier || info.industryIdentifiers?.find((i: any) => i.type === 'ISBN_10')?.identifier || '',
                            shelf: item.local ? (item.shelfLocation || 'Shelf A, Row 2') : 'Shelf A-102, 2nd Floor',
                            year: info.publishedDate ? info.publishedDate.split('-')[0] : '2024',
                            pages: String(info.pageCount || 320),
                            language: info.language || 'en',
                          },
                        })
                      }
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

                      {/* RIGHT: BRIGHT YELLOW MATCH BADGE */}
                      <View style={[styles.matchBadge, { backgroundColor: theme.accentGold }]}>
                        <Text style={[styles.matchPercentText, { color: isDarkMode ? "#080F1E" : "#080F1E" }]}>
                          {match}%
                        </Text>
                        <Text style={[styles.matchLabelText, { color: isDarkMode ? "#080F1E" : "#080F1E" }]}>
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
                      color={currentPage > 1 ? theme.accentGold : "#475569"}
                    />
                  </TouchableOpacity>

                  <View style={[styles.pageNumberBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                    <Text style={[styles.pageNumberText, { color: theme.textPrimary }]}>
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
                      color={currentPage < totalPages ? theme.accentGold : "#475569"}
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
});