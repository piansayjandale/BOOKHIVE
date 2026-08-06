import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
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
import * as DocumentPicker from "expo-document-picker";
import { API_URL, getAuthHeaders } from "../../data/authService";
import localBooks from "../../data/books";

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
  "find", "me", "book", "books", "show", "search", "get", "read", "want", "please", "library", "recommend"
]);

export const extractFileKeywords = async (file: { name: string; uri?: string; mimeType?: string }): Promise<string[]> => {
  if (!file || !file.name) return [];

  const nameKeywords = file.name
    .replace(/\.[^/.]+$/, "")
    .split(/[\s_.\-\/\(\)\[\]]+/)
    .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 1 && !STOP_WORDS_SET.has(w));

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

  return Array.from(new Set([...nameKeywords, ...textContentKeywords]));
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

  React.useEffect(() => {
    setAnnouncements(getAnnouncements());
    setActiveReservations(getUpcomingReservations());
    setBorrowHistory(getReservationHistory());
    setNotifications(getNotifications());
    setLibraryPoints(getLibraryPoints());

    const unsubscribe = subscribe(() => {
      setAnnouncements(getAnnouncements());
      setActiveReservations(getUpcomingReservations());
      setBorrowHistory(getReservationHistory());
      setNotifications(getNotifications());
      setLibraryPoints(getLibraryPoints());
    });

    // Poll notifications every 10 seconds to sync new books and transaction status updates in real-time
    const interval = setInterval(() => {
      getNotifications();
    }, 10000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const [allBooks, setAllBooks] = React.useState<any[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = React.useState<boolean>(true);
  const [activeCarouselIndex, setActiveCarouselIndex] = React.useState<number>(0);

  const [trendingBooks, setTrendingBooks] = React.useState<any[]>([
    {
      id: "eb22ebf0-75f5-42af-bc5e-49d068cbf164",
      title: "The Novice",
      author: "Taran Matharu",
      rating: "4.8",
      category: "Fantasy",
      isbn: "B00OFKKDLW",
      shelf: "CIR-104",
      available: "true",
      year: "2015",
      pages: "392",
      language: "EN",
      description: "When blacksmith apprentice Fletcher discovers that he has the ability to summon demons from another world, he travels to Adept Military Academy. There the gifted are trained in the art of summoning.",
    },
    {
      id: "be143695-9ec8-4cd4-a334-ff9022219ac4",
      title: "Saturday",
      author: "Ian McEwan",
      rating: "4.5",
      category: "Fiction",
      isbn: "9781400076192",
      shelf: "PER-368",
      available: "true",
      year: "2005",
      pages: "289",
      language: "EN",
      description: "Saturday is a masterful novel set within a single day in February 2003. Henry Perowne is a contented man — a successful neurosurgeon, happily married to a newspaper lawyer, and enjoying good relations with his children.",
    },
    {
      id: "6c7dc6e3-87bb-4950-a5bc-87fc7d653339",
      title: "Quintana of Charyn",
      author: "Melina Marchetta",
      rating: "4.6",
      category: "Fantasy",
      isbn: "9780670076246",
      shelf: "CIR-881",
      available: "true",
      year: "2012",
      pages: "448",
      language: "EN",
      description: "Separated from the girl he loves and has sworn to protect, Froi must travel through Charyn to search for Quintana, the mother of Charyn's unborn king, and protect her against those who will do anything to gain power.",
    },
    {
      id: "65be1b8c-5722-4809-9fb0-f1db42835db9",
      title: "Ilustrado",
      author: "Miguel Syjuco",
      rating: "4.4",
      category: "Fiction",
      isbn: "9780374175290",
      shelf: "CIR-192",
      available: "true",
      year: "2010",
      pages: "320",
      language: "EN",
      description: "A sweeping, dark-comic debut novel that starts with a body floating in Boston's Charles River, Ilustrado traces a young Filipino writer's search for the truth about his mentor.",
    },
  ]);

  const fetchBooksPayload = React.useCallback(async () => {
    setIsLoadingBooks(true);
    try {
      const headers = await getAuthHeaders();
      const response = await axios.get(`${API_URL}/api/admin/books?limit=50`, headers);
      const booksArray = response.data?.books || response.data?.records;

      let mappedBooks: any[] = [];
      if (response.status === 200 && Array.isArray(booksArray) && booksArray.length > 0) {
        mappedBooks = booksArray.map((book: any, idx: number) => {
          const charSum = book.title ? book.title.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) : 0;
          const pseudoRating = (4.2 + (charSum % 8) / 10).toFixed(1);
          return {
            id: book.id || `book-${idx}`,
            title: book.title || "Untitled Book",
            author: book.author || "Unknown Author",
            rating: (book.rating && Number(book.rating) > 0) ? String(book.rating) : String(pseudoRating),
            category: book.category || book.department || book.genres || "General",
            department: book.department || book.category || "General",
            isbn: book.isbn || "",
            shelf: book.shelfLocation || book.shelf || "General Shelf",
            available: String(book.availability === "Available" || book.availability === "true" || book.status === "Available"),
            year: book.publicationDate ? book.publicationDate.substring(0, 4) : "2024",
            pages: String(book.pages && book.pages > 0 ? book.pages : "320"),
            language: book.language || "EN",
            description: book.summary || book.description || "",
            coverImage: book.coverImage || book.cover || book.imageUrl || book.image || null,
          };
        });
      }

      // Fallback/enrich with local books catalog
      if (mappedBooks.length === 0 && Array.isArray(localBooks)) {
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
      if (mappedBooks.length > 0) {
        setTrendingBooks(mappedBooks.slice(0, 5));
      }
    } catch (error) {
      console.log("Error fetching books payload, using catalog fallback:", error);
      if (Array.isArray(localBooks)) {
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
        setTrendingBooks(fallback.slice(0, 5));
      }
    } finally {
      setIsLoadingBooks(false);
    }
  }, []);

  const getCategoryBooks = React.useCallback((categoryName: string) => {
    if (!allBooks || allBooks.length === 0) return [];
    const nameLower = categoryName.toLowerCase();

    if (nameLower === "recommended books") {
      return allBooks.slice(0, 6);
    }

    if (nameLower === "circulation") {
      const filtered = allBooks.filter((b) => {
        const cat = (b.category || b.department || "").toLowerCase();
        return cat.includes("computer") || cat.includes("science") || cat.includes("engineering") || cat.includes("business") || cat.includes("circulation");
      });
      return filtered.length > 0 ? filtered : allBooks.slice(0, 4);
    }

    if (nameLower === "general references") {
      const filtered = allBooks.filter((b) => {
        const cat = (b.category || b.department || "").toLowerCase();
        return cat.includes("general") || cat.includes("reference") || cat.includes("arts");
      });
      return filtered.length > 0 ? filtered : allBooks.slice(2, 6);
    }

    if (nameLower === "filipiniana") {
      return allBooks.filter((b) => {
        const cat = (b.category || b.department || "").toLowerCase();
        const title = (b.title || "").toLowerCase();
        return cat.includes("filipiniana") || cat.includes("philippine") || title.includes("philippine") || title.includes("ilustrado");
      });
    }

    if (nameLower === "periodicals") {
      return allBooks.filter((b) => {
        const cat = (b.category || b.department || "").toLowerCase();
        const title = (b.title || "").toLowerCase();
        return cat.includes("periodical") || cat.includes("journal") || cat.includes("magazine") || title.includes("saturday");
      });
    }

    if (nameLower === "special collections") {
      return allBooks.filter((b) => {
        const cat = (b.category || b.department || "").toLowerCase();
        return cat.includes("special") || cat.includes("pedagogy") || cat.includes("education");
      });
    }

    return [];
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
      // Force sync announcements from backend when tab comes into focus
      syncAnnouncementsWithBackend(true);
      fetchBooksPayload();
    }, [fetchBooksPayload])
  );

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
              color={theme.accentGold}
            />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
            BookHive Monitor
          </Text>
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
              color={theme.accentGold}
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
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
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
                color={theme.accentGold}
                style={styles.searchIcon}
              />
            </TouchableOpacity>
            <TextInput
              style={[styles.searchInput, { color: theme.textPrimary }]}
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
              <TouchableOpacity style={{ padding: 4 }} onPress={handlePickDocument} activeOpacity={0.7}>
                <Feather name="paperclip" size={18} color={theme.accentGold} />
              </TouchableOpacity>
            )}
          </View>

          {/* SELECTED FILE PREVIEW BADGE */}
          {selectedFile && (
            <View style={[styles.fileBadgeChip, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <Ionicons name="document-text-outline" size={16} color={theme.accentGold} />
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
                  style={[styles.suggestionChip, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                  onPress={() => handleSelectSuggestion(suggestion)}
                >
                  <Ionicons name="sparkles" size={10} color={theme.accentGold} style={{ marginRight: 4 }} />
                  <Text style={[styles.suggestionChipText, { color: theme.textSecondary }]}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* STATS (Reordered directly underneath search bar) */}
        <View style={styles.newStatsRow}>
          <View style={[styles.newStatCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={styles.newStatHeader}>
              <Ionicons name="book-outline" size={15} color={theme.accentGold} />
              <Text style={styles.newStatLabel}>BOOKS BORROWED</Text>
            </View>
            <Text style={[styles.newStatNumber, { color: theme.accentGold }]}>
              {borrowHistory.filter((item) => item.status === "Approved").length || 1}
            </Text>
          </View>

          <View style={[styles.newStatCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={styles.newStatHeader}>
              <MaterialCommunityIcons name="qrcode-scan" size={15} color={theme.accentGold} />
              <Text style={styles.newStatLabel}>BOOKS RESERVED</Text>
            </View>
            <Text style={[styles.newStatNumber, { color: theme.accentGold }]}>
              {activeReservations.length || 2}
            </Text>
          </View>
        </View>

        {/* ANNOUNCEMENTS */}
        {announcements.length > 0 && (
          <View style={styles.announcementsContainer}>
            <Text style={[styles.announcementsTitle, { color: theme.accentGold }]}>System Announcements</Text>
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
                    <Text style={[styles.announcementTitleText, { color: theme.textPrimary }]}>{item.title}</Text>
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
          <Text style={[styles.sectionTitleMonospace, { color: theme.textPrimary }]}>
            Trending Books
          </Text>
        </View>

        <View style={[styles.featuredPlaceholderCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          {isLoadingBooks ? (
            <View style={styles.categoryLoadingBox}>
              <ActivityIndicator size="small" color={theme.accentGold} />
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
                          pages: book.pages,
                          language: book.language,
                          category: book.category,
                          rating: book.rating,
                          shelf: book.shelf,
                          available: book.available,
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
                      <View style={[styles.carouselCategoryBadge, { backgroundColor: theme.badgeCategoryBg }]}>
                        <Text style={[styles.carouselCategoryText, { color: theme.badgeCategoryText }]}>
                          {(book.category || "TRENDING").toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[styles.carouselTitleText, { color: theme.textPrimary }]} numberOfLines={2}>
                        {book.title}
                      </Text>
                      <Text style={[styles.carouselAuthorText, { color: theme.textSecondary }]} numberOfLines={1}>
                        by {book.author}
                      </Text>
                      <View style={styles.carouselRatingRow}>
                        <Ionicons name="star" size={12} color={theme.accentGold} />
                        <Text style={[styles.carouselRatingText, { color: theme.accentGold }]}>{book.rating}</Text>
                      </View>
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
                        ? [styles.paginationDotActive, { backgroundColor: theme.accentGold }]
                        : [styles.paginationDotInactive, { backgroundColor: theme.badgeCategoryBorder }],
                    ]}
                  />
                ))}
              </View>
            </>
          )}
        </View>

        {/* NEW CATEGORY SECTIONS */}
        {[
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
              <Text style={[styles.sectionTitleMonospace, { color: theme.textPrimary }]}>
                {categoryTitle}
              </Text>
              {isLoadingBooks ? (
                <View style={styles.categoryLoadingBox}>
                  <ActivityIndicator size="small" color={theme.accentGold} />
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
                            pages: book.pages,
                            language: book.language,
                            category: book.category,
                            rating: book.rating,
                            shelf: book.shelf,
                            available: book.available,
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
          <MaterialCommunityIcons
            name="qrcode-scan"
            size={24}
            color="#080F1E"
          />
        </TouchableOpacity>
      </Animated.View>

      {/* ANNOUNCEMENT DETAIL MODAL */}
      <Modal
        visible={selectedAnnouncement !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedAnnouncement(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSelectedAnnouncement(null)}
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
              <TouchableOpacity onPress={() => setSelectedAnnouncement(null)}>
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
              onPress={() => setSelectedAnnouncement(null)}
            >
              <Text style={[styles.modalAnnCloseButtonText, { color: theme.accentGold }]}>Close</Text>
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