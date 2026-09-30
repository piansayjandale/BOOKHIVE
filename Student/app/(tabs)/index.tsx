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
  PanResponder,
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
  NotificationItem,
  setBooksTabOverride,
  getLibraryPoints,
  saveSearchQuery,
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

function BookCoverImage({
  uri,
  title,
  author,
  style,
  iconSize = 22,
  showText = false,
}: {
  uri?: string | null;
  title: string;
  author: string;
  style: any;
  iconSize?: number;
  showText?: boolean;
}) {
  const [imageError, setImageError] = React.useState(false);

  if (uri && !imageError) {
    return (
      <Image
        source={{ uri }}
        style={style}
        resizeMode="cover"
        onError={() => setImageError(true)}
      />
    );
  }

  const { theme } = useThemeColors();

  return (
    <View
      style={[
        style,
        styles.fallbackCoverContainer,
        { backgroundColor: theme.bookCoverBg, borderColor: theme.bookCoverBorder },
      ]}
    >
      <MaterialCommunityIcons
        name="book-open-page-variant"
        size={iconSize}
        color={theme.bookCoverIcon}
      />
      {showText && (
        <Text style={[styles.fallbackCoverTitle, { color: theme.textPrimary }]} numberOfLines={2}>
          {title}
        </Text>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const displayName = user?.fullName || "Student";

  // Draggable floating QR button position using Animated.ValueXY
  const pan = React.useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const panOffset = React.useRef({ x: 0, y: 0 });

  const scanPulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scanPulseAnim, {
          toValue: 1.12,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(scanPulseAnim, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  React.useEffect(() => {
    const id = pan.addListener((value) => {
      panOffset.current = value;
    });
    return () => {
      pan.removeListener(id);
    };
  }, []);

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only trigger responder if the user actually dragged, not just tapped
        return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: panOffset.current.x,
          y: panOffset.current.y,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (e, gestureState) => {
        pan.flattenOffset();
      },
      onPanResponderTerminate: (e, gestureState) => {
        pan.flattenOffset();
      },
    })
  ).current;

  const [announcements, setAnnouncements] = React.useState<AnnouncementItem[]>(
    getAnnouncements()
  );
  const [selectedAnnouncement, setSelectedAnnouncement] = React.useState<AnnouncementItem | null>(null);

  const [activeReservations, setActiveReservations] = React.useState<ReservationBook[]>(
    getUpcomingReservations()
  );
  const [borrowHistory, setBorrowHistory] = React.useState<ReservationBook[]>(
    getReservationHistory()
  );
  const [notifications, setNotifications] = React.useState<NotificationItem[]>(
    getNotifications()
  );
  const [libraryPoints, setLibraryPoints] = React.useState<number>(getLibraryPoints());

  const dismissAnnouncementModal = React.useCallback(() => {
    if (selectedAnnouncement?.id) {
      AsyncStorage.setItem(`@seen_ann_popup_${selectedAnnouncement.id}`, "true").catch(() => {});
    }
    setSelectedAnnouncement(null);
  }, [selectedAnnouncement]);

  React.useEffect(() => {
    setAnnouncements(getAnnouncements());
    setActiveReservations(getUpcomingReservations());
    setBorrowHistory(getReservationHistory());
    setNotifications(getNotifications());
    setLibraryPoints(getLibraryPoints());
    void syncAnnouncementsWithBackend(true);

    const unsubscribe = subscribe(() => {
      setAnnouncements(getAnnouncements());
      setActiveReservations(getUpcomingReservations());
      setBorrowHistory(getReservationHistory());
      setNotifications(getNotifications());
      setLibraryPoints(getLibraryPoints());
    });

    // Poll notifications & announcements every 10 seconds to sync in real-time
    const interval = setInterval(() => {
      getNotifications();
      void syncAnnouncementsWithBackend(true);
    }, 10000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Automatically pop up fresh unread announcement when student opens screen or announcements update
  React.useEffect(() => {
    if (announcements.length > 0) {
      const latest = announcements[0];
      AsyncStorage.getItem(`@seen_ann_popup_${latest.id}`)
        .then((seen) => {
          if (!seen) {
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

  const [allBooks, setAllBooks] = React.useState<any[]>([]);
  const [newArrivals, setNewArrivals] = React.useState<any[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = React.useState<boolean>(true);
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
      coverImage: null,
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
      coverImage: null,
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
      coverImage: null,
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
      coverImage: null,
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
      coverImage: null,
      borrowCount: 1,
    },
  ]);

  const fetchBooksPayload = React.useCallback(async () => {
    setIsLoadingBooks(true);
    try {
      const headers = await getAuthHeaders();
      let booksArray: any[] = [];
      let trendingArray: any[] = [];

      // 1. Fetch Trending Books (synchronized with Web System topBooks)
      try {
        const trendingRes = await axios.get(`${API_URL}/api/trending-books`, headers);
        if (trendingRes.status === 200 && Array.isArray(trendingRes.data?.books)) {
          trendingArray = trendingRes.data.books;
        } else if (trendingRes.status === 200 && Array.isArray(trendingRes.data?.topBooks)) {
          trendingArray = trendingRes.data.topBooks;
        }
      } catch {
        try {
          const dashRes = await axios.get(`${API_URL}/api/dashboard`, headers);
          if (dashRes.status === 200 && Array.isArray(dashRes.data?.topBooks)) {
            trendingArray = dashRes.data.topBooks;
          }
        } catch {
          try {
            const adminDashRes = await axios.get(`${API_URL}/api/admin/dashboard`, headers);
            if (adminDashRes.status === 200 && Array.isArray(adminDashRes.data?.topBooks)) {
              trendingArray = adminDashRes.data.topBooks;
            }
          } catch {}
        }
      }

      // 2. Fetch Catalog Books (ordered by created_at DESC for New Arrivals)
      try {
        const response = await axios.get(`${API_URL}/api/books?limit=100`, headers);
        if (response.status === 200 && Array.isArray(response.data?.books)) {
          booksArray = response.data.books;
        }
      } catch {
        try {
          const studentRes = await axios.get(`${API_URL}/api/student/books?limit=100`, headers);
          if (studentRes.status === 200 && Array.isArray(studentRes.data?.books)) {
            booksArray = studentRes.data.books;
          }
        } catch {
          try {
            const adminRes = await axios.get(`${API_URL}/api/admin/books?limit=100`, headers);
            if (adminRes.status === 200 && Array.isArray(adminRes.data?.books)) {
              booksArray = adminRes.data.books;
            }
          } catch {}
        }
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
            coverImage: book.coverUrl || book.coverImage || book.cover || book.imageUrl || book.image || null,
            copies: String(book.copies !== undefined && book.copies !== null ? book.copies : 1),
            volume: book.volume || "Single Volume / None",
            edition: book.edition || "Single Edition / None",
            accessionNumber: book.accessionNumber || "",
          };
        });
      }

      // Fallback/enrich with local books catalog
      if (mappedBooks.length === 0 && Array.isArray(localBooks) && localBooks.length > 0) {
        mappedBooks = localBooks.map((book: any, idx: number) => {
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
      }

      setAllBooks(mappedBooks);
      // New arrivals tab includes all newly added books into the system
      setNewArrivals(mappedBooks);

      // Process Trending Books (synced with Web System topBooks)
      if (Array.isArray(trendingArray) && trendingArray.length > 0) {
        const mappedTrending = trendingArray.map((book: any, idx: number) => {
          const charSum = book.title ? book.title.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) : 0;
          const pseudoRating = (4.5 + (charSum % 5) / 10).toFixed(1);
          return {
            id: String(book.id || `trending-${idx}`),
            title: book.title || "Untitled Book",
            author: book.author || "STI Library",
            rating: (book.rating && Number(book.rating) > 0) ? String(book.rating) : String(pseudoRating),
            category: book.genres || book.category || book.department || "Trending",
            department: book.department || "Circulation",
            isbn: book.isbn || "",
            shelf: book.shelfLocation || book.shelf || "CIR-01A.1",
            available: String(book.availability ? book.availability.toLowerCase() === "available" : true),
            year: book.publicationDate ? String(book.publicationDate).substring(0, 4) : "2026",
            publicationDate: book.publicationDate || "2026-09-01",
            pages: String(book.pages && book.pages > 0 ? book.pages : "320"),
            language: book.language || "English",
            description: book.summary || book.description || "",
            coverImage: book.coverImg || book.coverUrl || book.coverImage || null,
            copies: String(book.copies !== undefined && book.copies !== null ? book.copies : 1),
            volume: book.volume || "Single Volume / None",
            edition: book.edition || "Single Edition / None",
            accessionNumber: book.accessionNumber || "",
            borrowCount: Number(book.borrowCount || book.borrows || 0),
          };
        });
        setTrendingBooks(mappedTrending.slice(0, 5));
      } else if (mappedBooks.length > 0) {
        setTrendingBooks(mappedBooks.slice(0, 5));
      }
    } catch (error) {
      console.log("Error fetching books payload, using catalog fallback:", error);
      if (Array.isArray(localBooks) && localBooks.length > 0) {
        const fallback = localBooks.map((book: any, idx: number) => {
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
        setNewArrivals(fallback);
        setTrendingBooks(fallback.slice(0, 5));
      }
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

    if (nameLower === "recommended books") {
      const highRated = allBooks.filter((b) => Number(b.rating) >= 4.5);
      return highRated.length > 0 ? highRated.slice(0, 8) : allBooks.slice(0, 8);
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
    
    // Add words from local catalog
    if (Array.isArray(localBooks)) {
      localBooks.forEach(book => {
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

  useFocusEffect(
    React.useCallback(() => {
      // Force sync state and backend when tab comes into focus
      setActiveReservations(getUpcomingReservations());
      setBorrowHistory(getReservationHistory());
      setNotifications(getNotifications());
      setLibraryPoints(getLibraryPoints());
      syncAnnouncementsWithBackend(true);
      fetchBooksPayload();
    }, [fetchBooksPayload])
  );

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

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top, height: 60 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
        <View style={styles.headerLeftContainer}>
          <TouchableOpacity
            style={styles.hamburgerBtn}
            onPress={() => router.push("/settings")}
          >
            <Ionicons
              name="menu-outline"
              size={24}
              color={isDarkMode ? theme.accentGold : theme.accentBlue}
            />
          </TouchableOpacity>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Ionicons
              name="bookmark"
              size={17}
              color={isDarkMode ? theme.accentGold : "#FFF300"}
            />
            <Text style={[styles.headerTitle, { color: theme.headerTitle }]}>
              BookHive Monitor
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.themeToggleBtn}
            onPress={() => {
              toggleTheme();
            }}
          >
            <Ionicons
              name={isDarkMode ? "sunny-outline" : "moon-outline"}
              size={22}
              color={isDarkMode ? theme.accentGold : theme.accentBlue}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.notificationButtonRelative}
            onPress={() =>
              router.push("/notifications")
            }
          >
            <Ionicons
              name="notifications-outline"
              size={24}
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
              } finally {
                setIsRefreshing(false);
              }
            }}
            tintColor={theme.accentGold}
            colors={[theme.accentGold]}
          />
        }
      >
        {/* GREETING */}
        <View style={styles.greetingContainer}>
          <Text style={[styles.helloText, { color: theme.greetingAccent }]}>
            Hello, {displayName}!
          </Text>

          <Text style={[styles.subText, { color: theme.textSecondary }]}>
            Ready to discover something new today?
          </Text>
        </View>

        {/* SEARCH FILTER */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBarWrapper, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <TouchableOpacity onPress={() => handleHomeSearchSubmit()}>
              <Feather
                name="search"
                size={18}
                color={isDarkMode ? theme.accentGold : theme.accentBlue}
                style={styles.searchIcon}
              />
            </TouchableOpacity>
            <TextInput
              style={[styles.searchInput, { color: isDarkMode ? theme.textPrimary : "#0F172A" }]}
              placeholder="Search books & suggestions..."
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
                <TouchableOpacity style={{ padding: 4 }} onPress={handlePickDocument} activeOpacity={0.7}>
                  <Feather name="paperclip" size={18} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleHomeSearchSubmit()}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: isDarkMode ? theme.accentGold : "#FFF300",
                    paddingHorizontal: 9,
                    paddingVertical: 4.5,
                    borderRadius: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <Text style={{
                    color: isDarkMode ? "#090D16" : "#0274BB",
                    fontSize: 10.5,
                    fontWeight: "800",
                    letterSpacing: 0.3,
                  }}>
                    SEARCH
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* SELECTED FILE PREVIEW BADGE */}
          {selectedFile && (
            <View style={[styles.fileBadgeChip, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <Ionicons name="document-text-outline" size={16} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
              <Text style={[styles.fileBadgeName, { color: theme.textPrimary }]} numberOfLines={1}>
                {selectedFile.name}
              </Text>
              <TouchableOpacity onPress={() => setSelectedFile(null)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="close-circle" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* WORD SUGGESTIONS */}
        {wordSuggestions.length > 0 && (
          <View style={styles.suggestionsWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.suggestionsScrollContent}
            >
              {wordSuggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.suggestionChip, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                  <Ionicons name="sparkles" size={10} color={isDarkMode ? theme.accentGold : theme.accentBlue} style={{ marginRight: 4 }} />
                  <Text style={[styles.suggestionChipText, { color: theme.textSecondary }]}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* STATS (Reordered directly underneath search bar) */}
        <View style={styles.newStatsRow}>
          <View style={[
            styles.newStatCard,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.cardBorder,
              borderTopColor: isDarkMode ? theme.cardBorder : theme.accentBlue,
              borderTopWidth: isDarkMode ? 1 : 2.5,
            }
          ]}>
            <View style={styles.newStatHeader}>
              <View style={[
                styles.statIconBadge,
                { backgroundColor: isDarkMode ? "rgba(255, 215, 0, 0.15)" : "rgba(2, 116, 187, 0.10)" }
              ]}>
                <Ionicons name="book-outline" size={14} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
              </View>
              <Text style={[styles.newStatLabel, { color: theme.textSecondary }]}>BOOKS BORROWED</Text>
            </View>
            <Text style={[styles.newStatNumber, { color: isDarkMode ? theme.accentGold : theme.accentBlue }]}>
              {activeReservations.filter((book) => book.status === "Approved").length}
            </Text>
          </View>

          <View style={[
            styles.newStatCard,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.cardBorder,
              borderTopColor: isDarkMode ? theme.cardBorder : "#FFF300",
              borderTopWidth: isDarkMode ? 1 : 2.5,
            }
          ]}>
            <View style={styles.newStatHeader}>
              <View style={[
                styles.statIconBadge,
                { backgroundColor: isDarkMode ? "rgba(255, 215, 0, 0.15)" : "#FFF300" }
              ]}>
                <MaterialCommunityIcons name="qrcode-scan" size={14} color={isDarkMode ? theme.accentGold : "#0274BB"} />
              </View>
              <Text style={[styles.newStatLabel, { color: theme.textSecondary }]}>BOOKS RESERVED</Text>
            </View>
            <Text style={[styles.newStatNumber, { color: isDarkMode ? theme.accentGold : theme.accentBlue }]}>
              {activeReservations.filter((book) => book.status === "Pending" || book.status === "Upcoming" || book.status === "Reserved").length}
            </Text>
          </View>
        </View>

        {/* ANNOUNCEMENTS */}
        {announcements.length > 0 && (
          <View style={styles.announcementsContainer}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, marginBottom: 10 }}>
              <View style={{
                width: 24,
                height: 24,
                borderRadius: 7,
                backgroundColor: isDarkMode ? "rgba(255, 215, 0, 0.15)" : "#FFF300",
                justifyContent: "center",
                alignItems: "center"
              }}>
                <Ionicons name="megaphone" size={13} color={isDarkMode ? theme.accentGold : "#0274BB"} />
              </View>
              <Text style={[styles.announcementsTitle, { color: theme.sectionTitle, marginTop: 0 }]}>System Announcements</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.announcementsRow}
            >
              {announcements.map((item) => {
                const priorityStyle = getAnnouncementPriorityStyle(item.priority);
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.85}
                    onPress={() => setSelectedAnnouncement(item)}
                    style={[
                      styles.announcementCard,
                      priorityStyle,
                      !isDarkMode && {
                        backgroundColor: theme.cardBg,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <View style={styles.announcementHeader}>
                      <Ionicons 
                        name={item.priority === 'Urgent' ? "alert-circle" : (item.priority === 'Important' ? "warning" : "information-circle")} 
                        size={16} 
                        color={item.priority === 'Urgent' ? "#EF4444" : (item.priority === 'Important' ? "#F59E0B" : "#3B82F6")} 
                      />
                      <Text style={[
                        styles.announcementPriority,
                        item.priority === 'Urgent' && { color: '#EF4444' },
                        item.priority === 'Important' && { color: '#F59E0B' },
                      ]}>
                        {item.priority}
                      </Text>
                    </View>
                    <Text style={[styles.announcementTitleText, { color: isDarkMode ? theme.textPrimary : theme.accentBlue }]}>{item.title}</Text>
                    <Text style={[styles.announcementBody, { color: theme.textSecondary }]} numberOfLines={3}>{item.content}</Text>
                    <View style={[styles.announcementFooter, { borderTopColor: theme.cardBorder }]}>
                      <Text style={[styles.announcementAuthor, { color: theme.textSecondary }]}>By {item.author}</Text>
                      <Text style={[styles.announcementDate, { color: theme.textSecondary }]}>
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* TRENDING BOOKS SECTION */}
        <View style={styles.sectionHeaderMonospace}>
          <Text style={[styles.sectionTitle, { color: theme.sectionTitle }]}>
            Trending Books
          </Text>
        </View>

        <View style={[styles.featuredPlaceholderCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          {isLoadingBooks ? (
            <View style={styles.categoryLoadingBox}>
              <ActivityIndicator size="small" color={isDarkMode ? theme.accentGold : theme.accentBlue} />
              <Text style={styles.loadingText}>Loading Trending Books...</Text>
            </View>
          ) : (
            <>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(e) => {
                  const contentOffsetX = e.nativeEvent.contentOffset.x;
                  const carouselWidth = Dimensions.get("window").width - 40;
                  const idx = Math.min(
                    4,
                    Math.max(0, Math.round(contentOffsetX / carouselWidth))
                  );
                  setActiveCarouselIndex(idx);
                }}
                scrollEventThrottle={16}
                style={{ width: Dimensions.get("window").width - 40 }}
              >
                {trendingBooks.slice(0, 5).map((book, idx) => (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.85}
                    style={[styles.carouselSlide, { width: Dimensions.get("window").width - 40 }]}
                    onPress={() =>
                      router.push({
                        pathname: "/book-details",
                        params: {
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
                          available: book.available,
                          isbn: book.isbn,
                          copies: book.copies,
                          volume: book.volume,
                          edition: book.edition,
                          accessionNumber: book.accessionNumber,
                        },
                      })
                    }
                  >
                    <BookCoverImage
                      uri={book.coverImage}
                      title={book.title}
                      author={book.author}
                      style={styles.carouselCoverImage}
                      iconSize={32}
                      showText={true}
                    />
                    <View style={styles.carouselContentRight}>
                      <View style={[
                        styles.carouselCategoryBadge,
                        {
                          backgroundColor: isDarkMode ? theme.badgeCategoryBg : "#FFF300",
                          borderColor: isDarkMode ? "transparent" : "#FFF300",
                          borderWidth: isDarkMode ? 0 : 1,
                        }
                      ]}>
                        <Text style={[
                          styles.carouselCategoryText,
                          {
                            color: isDarkMode ? theme.badgeCategoryText : "#0274BB",
                            fontWeight: "800",
                          }
                        ]}>
                          {(book.category || "TRENDING").toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[styles.carouselTitleText, { color: theme.textPrimary }]} numberOfLines={2}>
                        {book.title}
                      </Text>
                      <Text style={[styles.carouselAuthorText, { color: theme.textSecondary }]} numberOfLines={1}>
                        by {book.author}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.paginationDotsContainer}>
                {trendingBooks.slice(0, 5).map((_, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.paginationDot,
                      idx === activeCarouselIndex
                        ? [
                            styles.paginationDotActive,
                            {
                              backgroundColor: isDarkMode ? theme.accentGold : "#FFF300",
                              borderColor: isDarkMode ? "transparent" : "#0274BB",
                              borderWidth: isDarkMode ? 0 : 1.5,
                              width: 18,
                            }
                          ]
                        : [
                            styles.paginationDotInactive,
                            { backgroundColor: isDarkMode ? "rgba(255, 215, 0, 0.3)" : "rgba(2, 116, 187, 0.20)" }
                          ],
                    ]}
                  />
                ))}
              </View>
            </>
          )}
        </View>

        {/* CATEGORY SECTIONS */}
        {[
          "New Arrivals",
          "Recommended Books",
          "Circulation",
          "General References",
          "Filipiniana",
          "Periodicals",
          "Special Collections",
        ].map((categoryTitle, cIndex) => {
          const categoryBooks = getCategoryBooks(categoryTitle);

          return (
            <View key={cIndex} style={styles.categorySection}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingRight: 20, marginBottom: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={[styles.sectionTitle, { color: theme.sectionTitle, fontSize: 16 }]}>
                    {categoryTitle}
                  </Text>
                  {categoryTitle === "New Arrivals" && (
                    <View
                      style={{
                        backgroundColor: isDarkMode ? "rgba(252, 212, 0, 0.15)" : "#FFF300",
                        borderColor: isDarkMode ? "rgba(252, 212, 0, 0.4)" : "#FFF300",
                        borderWidth: 1,
                        borderRadius: 6,
                        paddingHorizontal: 6,
                        paddingVertical: 1.5,
                      }}
                    >
                      <Text
                        style={{
                          color: isDarkMode ? theme.accentGold : "#0274BB",
                          fontSize: 9,
                          fontWeight: "800",
                          fontFamily: "monospace",
                          letterSpacing: 0.5,
                        }}
                      >
                        NEW
                      </Text>
                    </View>
                  )}
                  {categoryTitle === "Recommended Books" && (
                    <View
                      style={{
                        backgroundColor: isDarkMode ? "rgba(252, 212, 0, 0.15)" : "#FFF300",
                        borderColor: isDarkMode ? "rgba(252, 212, 0, 0.4)" : "#FFF300",
                        borderWidth: 1,
                        borderRadius: 6,
                        paddingHorizontal: 6,
                        paddingVertical: 1.5,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <Ionicons name="star" size={8} color={isDarkMode ? theme.accentGold : "#0274BB"} />
                      <Text
                        style={{
                          color: isDarkMode ? theme.accentGold : "#0274BB",
                          fontSize: 9,
                          fontWeight: "800",
                          fontFamily: "monospace",
                          letterSpacing: 0.5,
                        }}
                      >
                        TOP PICK
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              {isLoadingBooks ? (
                <View style={styles.categoryLoadingBox}>
                  <ActivityIndicator size="small" color={isDarkMode ? theme.accentGold : theme.accentBlue} />
                </View>
              ) : categoryBooks.length === 0 ? (
                <View style={[styles.emptyCategoryCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                  <Ionicons name="folder-open-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
                  <Text style={styles.emptyCategoryText}>No books available in this category</Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryCardsRow}
                >
                  {categoryBooks.map((book, cardIdx) => (
                    <TouchableOpacity
                      key={cardIdx}
                      activeOpacity={0.85}
                      style={[
                        styles.categoryCard,
                        { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
                      ]}
                      onPress={() =>
                        router.push({
                          pathname: "/book-details",
                          params: {
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
                            available: book.available,
                            isbn: book.isbn,
                            copies: book.copies,
                            volume: book.volume,
                            edition: book.edition,
                            accessionNumber: book.accessionNumber,
                          },
                        })
                      }
                    >
                      <BookCoverImage
                        uri={book.coverImage}
                        title={book.title}
                        author={book.author}
                        style={styles.categoryCardImage}
                        iconSize={18}
                        showText={false}
                      />
                      <View style={styles.categoryCardTextOverlay}>
                        <Text style={[styles.categoryCardTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                          {book.title}
                        </Text>
                        <Text style={[styles.categoryCardAuthor, { color: theme.textSecondary }]} numberOfLines={1}>
                          {book.author}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          );
        })}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* FLOATING DRAGGABLE QR BUTTON */}
      <Animated.View
        style={[
          styles.floatingButton,
          {
            backgroundColor: isDarkMode ? theme.accentGold : "#FFF300",
            shadowColor: isDarkMode ? theme.accentGold : "#0274BB",
            borderWidth: isDarkMode ? 0 : 1.5,
            borderColor: isDarkMode ? "transparent" : "rgba(2, 116, 187, 0.25)",
            transform: pan.getTranslateTransform(),
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push("/scanner")}
          style={styles.floatingButtonTouchable}
        >
          <Animated.View style={{ transform: [{ scale: scanPulseAnim }] }}>
            <MaterialCommunityIcons
              name="qrcode-scan"
              size={24}
              color={isDarkMode ? "#080F1E" : "#0274BB"}
            />
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>

      {/* ANNOUNCEMENT DETAIL MODAL */}
      <Modal
        visible={selectedAnnouncement !== null}
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
              <Text style={[styles.modalAnnAuthor, { color: theme.textSecondary }]}>By {selectedAnnouncement?.author}</Text>
              <Text style={[styles.modalAnnDate, { color: theme.textSecondary }]}>
                {selectedAnnouncement ? new Date(selectedAnnouncement.updatedAt).toLocaleDateString() : ""}
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
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080F1E",
  },

  header: {
    height: 60,
    backgroundColor: "#080F1E",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#111A2E",
  },

  headerLeftContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  hamburgerBtn: {
    padding: 2,
  },

  headerTitle: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingBottom: 2,
  },

  themeToggleBtn: {
    padding: 4,
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

  notificationButton: {
    position: "absolute",
    right: 20,
    top: 22,
  },

  badgeContainer: {
    position: "absolute",
    right: -4,
    top: -4,
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

  greetingContainer: {
    paddingHorizontal: 20,
    marginTop: 14,
  },

  helloText: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
    lineHeight: 30,
  },

  subText: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "500",
  },

  searchContainer: {
    paddingHorizontal: 20,
    marginTop: 14,
  },

  newStatsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginTop: 16,
    gap: 12,
  },

  newStatCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  statIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
  },

  newStatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },

  newStatLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#8E9DAE",
    fontFamily: "monospace",
    letterSpacing: 0.3,
  },

  newStatNumber: {
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
  },

  sectionHeaderMonospace: {
    marginTop: 22,
    marginHorizontal: 20,
  },

  sectionTitleMonospace: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "monospace",
    color: "#8E9DAE",
  },

  featuredPlaceholderCard: {
    marginHorizontal: 20,
    marginTop: 12,
    height: 170,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 12,
  },

  paginationDotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  categorySection: {
    marginTop: 22,
    paddingLeft: 20,
  },

  categoryCardsRow: {
    paddingRight: 20,
    paddingTop: 10,
    gap: 12,
    flexDirection: "row",
  },

  categoryPlaceholderCard: {
    width: 125,
    height: 75,
    borderRadius: 14,
    borderWidth: 1,
  },

  askBox: {
    height: 50,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
  },

  askText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
  },

  sectionHeader: {
    marginTop: 22,
    marginHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },

  seeAll: {
    color: "#38BDF8",
    fontWeight: "700",
    fontSize: 13,
  },

  booksRow: {
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 12,
  },

  bookCard: {
    width: 165,
    borderRadius: 16,
    padding: 14,
    marginRight: 12,
    borderWidth: 1,
    elevation: 3,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },

  bookTitle: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },

  bookAuthor: {
    fontSize: 12,
    marginTop: 4,
  },

  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },

  ratingText: {
    fontSize: 11,
    marginLeft: 6,
    fontWeight: "600",
  },

  reservationTitle: {
    marginTop: 22,
    marginHorizontal: 20,
    fontSize: 18,
    fontWeight: "800",
  },

  reservationCard: {
    marginTop: 12,
    marginHorizontal: 20,
    borderRadius: 18,
    padding: 16,
    overflow: "hidden",
    borderWidth: 1,
  },

  circleShape: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(245, 158, 11, 0.04)",
    top: -30,
    right: -25,
  },

  pickupRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  bookIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  nextPickup: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  reservationBook: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: "800",
  },

  bottomReservation: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  dateText: {
    marginLeft: 6,
    fontSize: 12,
  },

  readyButton: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 10,
  },

  readyText: {
    color: "#080F1E",
    fontWeight: "800",
    fontSize: 12,
  },

  queueCard: {
    marginTop: 12,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
  },

  queueLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  queueIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  queueTitle: {
    fontSize: 14,
    fontWeight: "700",
  },

  queueSub: {
    marginTop: 2,
    fontSize: 12,
  },

  statsRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 16,
    justifyContent: "space-between",
  },

  borrowedCard: {
    width: "48%",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    elevation: 3,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },

  borrowedNumber: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: "800",
  },

  borrowedText: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  pointsCard: {
    width: "48%",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    elevation: 3,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },

  pointsIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  pointsNumber: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: "800",
  },

  pointsText: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  floatingButton: {
    position: "absolute",
    right: 20,
    bottom: 15,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
    elevation: 10,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 99,
  },

  announcementsContainer: {
    marginTop: 20,
  },

  announcementsTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FCD34D",
    paddingHorizontal: 20,
    marginBottom: 10,
  },

  announcementsRow: {
    paddingLeft: 20,
    paddingRight: 6,
    paddingBottom: 8,
  },

  announcementCard: {
    width: 280,
    backgroundColor: "#111A2E",
    borderRadius: 16,
    padding: 16,
    marginRight: 14,
    borderWidth: 1,
    borderColor: "#1E293B",
    borderLeftWidth: 4,
    borderLeftColor: "#38BDF8",
  },

  announcementUrgent: {
    borderLeftColor: "#EF4444",
    backgroundColor: "#1F1315",
    borderColor: "#3F1B1F",
  },

  announcementImportant: {
    borderLeftColor: "#F59E0B",
    backgroundColor: "#1C1810",
    borderColor: "#3D2C12",
  },

  announcementHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 4,
  },

  announcementPriority: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    color: "#38BDF8",
  },

  announcementTitleText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 6,
  },

  announcementBody: {
    fontSize: 13,
    color: "#CBD5E1",
    lineHeight: 18,
    marginBottom: 12,
  },

  announcementFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
    paddingTop: 8,
  },

  announcementAuthor: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
  },

  announcementDate: {
    fontSize: 11,
    color: "#64748B",
  },

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
    backgroundColor: "#111A2E",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#1E293B",
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
    fontSize: 20,
    fontWeight: "800",
    color: "#F8FAFC",
    marginBottom: 14,
  },

  modalAnnBodyScroll: {
    maxHeight: 200,
    marginBottom: 16,
  },

  modalAnnBodyText: {
    fontSize: 14,
    color: "#CBD5E1",
    lineHeight: 22,
  },

  modalAnnFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
    paddingTop: 12,
    marginBottom: 20,
  },

  modalAnnAuthor: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
  },

  modalAnnDate: {
    fontSize: 12,
    color: "#64748B",
  },

  modalAnnCloseButton: {
    backgroundColor: "#080F1E",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1E293B",
  },

  modalAnnCloseButtonText: {
    color: "#FCD34D",
    fontWeight: "800",
    fontSize: 14,
  },

  noReservationsCard: {
    backgroundColor: "#111A2E",
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1E293B",
    gap: 8,
  },

  noReservationsText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "600",
  },
  floatingButtonTouchable: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  searchBarWrapper: {
    height: 58,
    backgroundColor: "#111A2E",
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: "#F8FAFC",
    fontSize: 14,
    height: "100%",
  },
  clearIcon: {
    padding: 4,
  },
  suggestionsWrapper: {
    marginTop: 10,
    paddingHorizontal: 20,
  },
  suggestionsScrollContent: {
    paddingRight: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  suggestionChip: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#334155",
    marginRight: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  suggestionChipText: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "600",
  },
  searchResultsContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  searchResultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  searchResultsTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FCD34D",
  },
  noResultsCard: {
    backgroundColor: "#111A2E",
    borderRadius: 18,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  noResultsText: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 8,
    textAlign: "center",
  },
  noResultsSub: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
  resultsGrid: {
    gap: 14,
  },
  resultBookCard: {
    backgroundColor: "#111A2E",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
    marginBottom: 12,
  },
  resultBookHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  resultBookCategory: {
    fontSize: 9,
    fontWeight: "800",
    color: "#38BDF8",
    letterSpacing: 0.5,
    flex: 1,
    marginRight: 8,
  },
  matchBadge: {
    backgroundColor: "rgba(252,211,77,0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(252,211,77,0.3)",
  },
  matchText: {
    color: "#FCD34D",
    fontWeight: "800",
    fontSize: 8,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusAvail: {
    backgroundColor: "rgba(34,197,94,0.1)",
  },
  statusUnavail: {
    backgroundColor: "rgba(239,68,68,0.1)",
  },
  statusText: {
    fontSize: 8,
    fontWeight: "800",
  },
  resultBookTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#F8FAFC",
    marginBottom: 4,
  },
  resultBookAuthor: {
    fontSize: 12,
    color: "#94A3B8",
    marginBottom: 12,
  },
  resultBookFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
    paddingTop: 10,
  },
  resultRatingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  resultRatingText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#CBD5E1",
    marginLeft: 4,
  },
  resultBookShelf: {
    fontSize: 11,
    color: "#64748B",
    maxWidth: "70%",
  },
  carouselSlide: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    paddingBottom: 24,
    height: 170,
  },
  carouselCoverImage: {
    width: 90,
    height: 125,
    borderRadius: 10,
    overflow: "hidden",
  },
  carouselContentRight: {
    flex: 1,
    marginLeft: 14,
    justifyContent: "center",
  },
  carouselCategoryBadge: {
    backgroundColor: "rgba(255, 215, 0, 0.15)",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  carouselCategoryText: {
    color: "#FFD700",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  carouselTitleText: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 20,
    marginBottom: 4,
  },
  carouselAuthorText: {
    fontSize: 12,
    marginBottom: 8,
  },
  carouselRatingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  carouselRatingText: {
    color: "#FFD700",
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 4,
  },
  paginationDotActive: {
    width: 16,
    backgroundColor: "#FFD700",
  },
  paginationDotInactive: {
    width: 6,
    backgroundColor: "rgba(255, 215, 0, 0.3)",
  },
  categoryCard: {
    width: 130,
    height: 115,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  categoryCardImage: {
    width: "100%",
    height: 72,
  },
  categoryCardTextOverlay: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: "center",
  },
  categoryCardTitle: {
    fontSize: 11,
    fontWeight: "700",
  },
  categoryCardAuthor: {
    fontSize: 9,
  },
  fallbackCoverContainer: {
    backgroundColor: "#0B162C",
    justifyContent: "center",
    alignItems: "center",
    padding: 6,
  },
  fallbackCoverTitle: {
    color: "#8E9DAE",
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
  },
  emptyCategoryCard: {
    marginRight: 20,
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
    fontFamily: "monospace",
  },
  categoryLoadingBox: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    color: "#8E9DAE",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "monospace",
  },
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
});