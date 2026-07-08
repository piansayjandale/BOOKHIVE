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
import { API_URL, getAuthHeaders } from "../../data/authService";
import localBooks from "../../data/books";

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

  const [searchText, setSearchText] = React.useState("");
  const { isDarkMode, toggleTheme, theme } = useThemeColors();
  const [wordSuggestions, setWordSuggestions] = React.useState<string[]>([]);
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [searching, setSearching] = React.useState(false);

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

  // Suggestions per-word logic
  const handleSearchTextChange = (text: string) => {
    setSearchText(text);

    if (!text.trim()) {
      setWordSuggestions([]);
      setSearchResults([]);
      return;
    }

    const words = text.split(/\s+/);
    const lastWord = words[words.length - 1];

    if (lastWord.length > 0) {
      const matches = vocabulary.filter(vocabWord => 
        vocabWord.toLowerCase().startsWith(lastWord.toLowerCase()) &&
        vocabWord.toLowerCase() !== lastWord.toLowerCase()
      ).slice(0, 8);
      
      setWordSuggestions(matches);
    } else {
      setWordSuggestions([]);
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    const words = searchText.split(/\s+/);
    if (words.length > 0) {
      words[words.length - 1] = suggestion;
      const newText = words.join(" ") + " ";
      setSearchText(newText);
      setWordSuggestions([]);
      performSearch(newText);
    }
  };

  const getMatchPercentage = React.useCallback((
    title: string,
    description: string,
    category: string = ""
  ) => {
    const query = searchText.toLowerCase().trim();
    if (!query) return 0;

    const titleText = title.toLowerCase();
    const descText = (description || "").toLowerCase();
    const catText = category.toLowerCase();

    // Exact match check
    const cleanTitle = titleText.replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, " ");
    const cleanQuery = query.replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, " ");
    if (cleanTitle === cleanQuery) {
      return 100;
    }

    const rawWords = query.replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(word => word.length > 0);
    let queryWords = rawWords.filter(word => !STOP_WORDS.has(word));
    
    if (queryWords.length === 0) {
      queryWords = rawWords;
    }
    
    if (queryWords.length === 0) return 0;

    let matchedTitleWords = 0;
    queryWords.forEach(word => {
      const wordLower = word.toLowerCase();
      if (titleText.includes(wordLower) || (wordLower.endsWith('s') && titleText.includes(wordLower.slice(0, -1)))) {
        matchedTitleWords++;
      }
    });

    if (matchedTitleWords === 0) {
      let fallbackMatched = false;
      queryWords.forEach(word => {
        const wordLower = word.toLowerCase();
        if (descText.includes(wordLower) || catText.includes(wordLower)) {
          fallbackMatched = true;
        }
      });
      return fallbackMatched ? 10 : 0;
    }

    const percentage = 20 + (matchedTitleWords - 1) * 10;
    return Math.min(100, percentage);
  }, [searchText]);

  const filterLocalBooks = React.useCallback((query: string) => {
    if (!Array.isArray(localBooks)) return;
    const lowerQuery = query.toLowerCase();
    const filtered = localBooks.filter(book => 
      (book.title && book.title.toLowerCase().includes(lowerQuery)) ||
      (book.author && book.author.toLowerCase().includes(lowerQuery)) ||
      (book.department && book.department.toLowerCase().includes(lowerQuery))
    ).map((book, idx) => {
      const charSum = book.title ? book.title.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) : 0;
      const pseudoRating = (4.2 + (charSum % 8) / 10).toFixed(1);
      const category = book.department || "General";
      const matchPercent = getMatchPercentage(book.title || "", book.description || "", category);
      return {
        id: `local-find-${idx}`,
        title: book.title,
        author: book.author,
        description: book.description || "",
        year: String(book.year || "2024"),
        pages: String(book.pages || "320"),
        language: "EN",
        category: category,
        rating: String(pseudoRating),
        shelf: "General Shelf",
        available: String(book.available !== false),
        matchPercent: matchPercent,
      };
    }).sort((a, b) => b.matchPercent - a.matchPercent);
    setSearchResults(filtered);
  }, [getMatchPercentage]);

  const performSearch = React.useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length <= 1) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const headers = await getAuthHeaders();
      const response = await axios.get(
        `${API_URL}/api/student/books/search?q=${encodeURIComponent(trimmed)}`,
        headers
      );

      if (response.status === 200 && response.data?.books) {
        const mapped = response.data.books.map((book: any) => {
          const charSum = book.title ? book.title.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) : 0;
          const pseudoRating = (4.2 + (charSum % 8) / 10).toFixed(1);
          const category = book.category || book.department || "General";
          const matchPercent = getMatchPercentage(book.title || "", book.description || book.summary || "", category);
          return {
            id: book.id,
            title: book.title,
            author: book.author,
            description: book.description || book.summary || "",
            year: book.publicationDate ? book.publicationDate.substring(0, 4) : "2024",
            pages: String(book.pages || 320),
            language: book.language || "EN",
            category: category,
            rating: (book.rating && Number(book.rating) > 0) ? String(book.rating) : String(pseudoRating),
            shelf: book.shelfLocation || "General Shelf",
            available: String(book.status === "Available" || book.status === "true" || book.availability === "Available" || book.availability === "true"),
            matchPercent: matchPercent,
          };
        }).sort((a: any, b: any) => b.matchPercent - a.matchPercent);
        setSearchResults(mapped);
      } else {
        filterLocalBooks(trimmed);
      }
    } catch (error) {
      console.log("Dashboard Search API Error, falling back to local filter:", error);
      filterLocalBooks(trimmed);
    } finally {
      setSearching(false);
    }
  }, [filterLocalBooks, getMatchPercentage]);

  React.useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchText.trim().length > 1) {
        performSearch(searchText);
        saveSearchQuery(searchText);
      } else {
        setSearchResults([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchText, performSearch]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useFocusEffect(
    React.useCallback(() => {
      // Force sync announcements from backend when tab comes into focus
      syncAnnouncementsWithBackend(true);

      let active = true;
      const fetchTrending = async () => {
        try {
          const headers = await getAuthHeaders();
          const response = await axios.get(`${API_URL}/api/admin/books?limit=4`, headers);
          const booksArray = response.data?.books || response.data?.records;
          if (response.status === 200 && Array.isArray(booksArray)) {
            const mapped = booksArray.map((book: any) => {
              // Generate a stable rating between 4.2 and 4.9 based on title if rating is 0 or undefined
              const charSum = book.title ? book.title.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) : 0;
              const pseudoRating = (4.2 + (charSum % 8) / 10).toFixed(1);
              const finalRating = (book.rating && Number(book.rating) > 0) ? String(book.rating) : String(pseudoRating);
              
              return {
                id: book.id,
                title: book.title,
                author: book.author,
                rating: finalRating,
                category: book.category || book.department || "General",
                isbn: book.isbn || "",
                shelf: book.shelfLocation || "General Shelf",
                available: String(book.availability === "Available" || book.availability === "true"),
                year: book.publicationDate ? book.publicationDate.substring(0, 4) : "2024",
                pages: String(book.pages && book.pages > 0 ? book.pages : "320"),
                language: book.language || "EN",
                description: book.summary || "",
              };
            });
            if (active && mapped.length > 0) {
              setTrendingBooks(mapped);
            }
          }
        } catch (error: any) {
          console.error("Error fetching real-time trending books:", error.message || error);
        }
      };
      fetchTrending();
      return () => {
        active = false;
      };
    }, [])
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
      <View style={[styles.header, { paddingTop: insets.top, height: 70 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          BookHive Monitor
        </Text>

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
          <Text style={[styles.helloText, { color: theme.accentGold }]}>
            Hello, {displayName}!
          </Text>

          <Text style={[styles.subText, { color: theme.textSecondary }]}>
            Ready to discover something new today?
          </Text>
        </View>

        {/* SEARCH FILTER */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBarWrapper, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <Feather
              name="search"
              size={18}
              color={theme.accentGold}
              style={styles.searchIcon}
            />
            <TextInput
              style={[styles.searchInput, { color: theme.textPrimary }]}
              placeholder="Search books & suggestions..."
              placeholderTextColor={isDarkMode ? "#64748B" : "#94A3B8"}
              value={searchText}
              onChangeText={handleSearchTextChange}
              returnKeyType="search"
              onSubmitEditing={() => performSearch(searchText)}
            />
            {searchText.length > 0 && (
              <TouchableOpacity
                onPress={() => handleSearchTextChange("")}
                style={styles.clearIcon}
              >
                <Ionicons name="close-circle" size={20} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>
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

        {searchText.trim().length > 0 ? (
          <View style={styles.searchResultsContainer}>
            <View style={styles.searchResultsHeader}>
              <Text style={[styles.searchResultsTitle, { color: theme.accentGold }]}>
                {searching ? "Searching Books..." : `Search Results (${searchResults.length})`}
              </Text>
              {searching && <ActivityIndicator size="small" color={theme.accentGold} style={{ marginLeft: 8 }} />}
            </View>

            {searchResults.length === 0 ? (
              <View style={[styles.noResultsCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                <Ionicons name="search-outline" size={32} color="#64748B" style={{ marginBottom: 8 }} />
                <Text style={[styles.noResultsText, { color: theme.textPrimary }]}>
                  {searching ? "Finding matching records..." : "No books match your query."}
                </Text>
                <Text style={[styles.noResultsSub, { color: theme.textSecondary }]}>
                  Try typing different keywords or selecting the autocomplete suggestions.
                </Text>
              </View>
            ) : (
              <View style={styles.resultsGrid}>
                {searchResults.map((book, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.resultBookCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                    activeOpacity={0.8}
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
                          matchPercent: book.matchPercent,
                        },
                      })
                    }
                  >
                    <View style={styles.resultBookHeader}>
                      <Text style={styles.resultBookCategory} numberOfLines={1}>
                        {book.category.toUpperCase()}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        {book.matchPercent !== undefined && book.matchPercent > 0 && (
                          <View style={styles.matchBadge}>
                            <Text style={styles.matchText}>
                              {book.matchPercent}% MATCH
                            </Text>
                          </View>
                        )}
                        <View style={[
                          styles.statusBadge,
                          book.available === "true" ? styles.statusAvail : styles.statusUnavail
                        ]}>
                          <Text style={[styles.statusText, { color: book.available === "true" ? "#22C55E" : "#EF4444" }]}>
                            {book.available === "true" ? "AVAILABLE" : "RESERVED"}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Text style={[styles.resultBookTitle, { color: theme.textPrimary }]} numberOfLines={2}>
                      {book.title}
                    </Text>

                    <Text style={[styles.resultBookAuthor, { color: theme.textSecondary }]} numberOfLines={1}>
                      by {book.author}
                    </Text>

                    <View style={[styles.resultBookFooter, { borderTopColor: theme.cardBorder }]}>
                      <View style={styles.resultRatingRow}>
                        <Ionicons name="star" size={12} color="#FFD700" />
                        <Text style={[styles.resultRatingText, { color: theme.textSecondary }]}>
                          {book.rating}
                        </Text>
                      </View>
                      <Text style={[styles.resultBookShelf, { color: theme.textSecondary }]} numberOfLines={1}>
                        Shelf: {book.shelf}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ) : (
          <>

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

        {/* TRENDING BOOKS */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.accentGold }]}>
            Trending Books
          </Text>

          <TouchableOpacity
            onPress={() => {
              setBooksTabOverride("Trending");
              router.push("/(tabs)/books");
            }}
          >
            <Text style={styles.seeAll}>
              See All
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.booksRow
          }
        >
          {trendingBooks.map(
            (book, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.bookCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
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
                <Text style={[styles.bookTitle, { color: theme.textPrimary }]} numberOfLines={2}>
                  {book.title}
                </Text>

                <Text
                  style={[styles.bookAuthor, { color: theme.textSecondary }]}
                  numberOfLines={1}
                >
                  {book.author}
                </Text>

                <View
                  style={styles.ratingRow}
                >
                  <Ionicons
                    name="star"
                    size={12}
                    color="#FFD700"
                  />

                  <Text
                    style={[styles.ratingText, { color: theme.textSecondary }]}
                  >
                    {book.rating} | 158 Reviews
                  </Text>
                </View>
              </TouchableOpacity>
            )
          )}
        </ScrollView>

        {/* RESERVATIONS */}
        <Text
          style={[styles.reservationTitle, { color: theme.accentGold }]}
        >
          Your Reservations
        </Text>

        {activeReservations.filter((book) => book.status === 'Pending' || book.status === 'Upcoming').length === 0 ? (
          <View style={[styles.noReservationsCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <Ionicons name="bookmark-outline" size={24} color="#64748B" />
            <Text style={[styles.noReservationsText, { color: theme.textSecondary }]}>No active reservations at this time.</Text>
          </View>
        ) : (
          activeReservations
            .filter((book) => book.status === 'Pending' || book.status === 'Upcoming')
            .map((book) => {
            if (book.status === 'Approved') {
              return (
                <TouchableOpacity
                  key={book.id}
                  style={[styles.reservationCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                  activeOpacity={0.8}
                  onPress={() =>
                    router.push({
                      pathname: "/reservation-details",
                      params: {
                        id: book.id,
                        title: book.title,
                        author: book.author,
                        status: "Ready for Pickup",
                        pickupDate: book.date || "",
                      },
                    })
                  }
                >
                  <View style={styles.circleShape} />

                  <View style={styles.pickupRow}>
                    <View style={styles.bookIcon}>
                      <Ionicons
                        name="book-outline"
                        size={18}
                        color={theme.accentGold}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={styles.nextPickup}
                      >
                        READY FOR PICKUP
                      </Text>

                      <Text
                        style={[
                          styles.reservationBook,
                          { color: theme.textPrimary }
                        ]}
                        numberOfLines={2}
                      >
                        {book.title.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={
                      styles.bottomReservation
                    }
                  >
                    <View style={styles.dateRow}>
                      <Feather
                        name="calendar"
                        size={14}
                        color="#64748B"
                      />

                      <Text
                        style={[styles.dateText, { color: theme.textSecondary }]}
                      >
                        Pickup: {book.date}
                      </Text>
                    </View>

                    <View
                      style={styles.readyButton}
                    >
                      <Text
                        style={styles.readyText}
                      >
                        Ready
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            } else {
              return (
                <TouchableOpacity
                  key={book.id}
                  style={[styles.queueCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                  activeOpacity={0.8}
                  onPress={() =>
                    router.push({
                      pathname: "/queue-details",
                      params: {
                        id: book.id,
                        title: book.title,
                        author: book.author,
                        description: book.description || "",
                        year: String(book.year || ""),
                        pages: String(book.pages || ""),
                        language: book.language || "",
                        category: book.category || "",
                        available: book.available || "false",
                        queuePosition: book.queuePosition || "1",
                        estimatedWait: book.estimatedWait || "Pending approval",
                        shelf: book.shelf || "General Shelf",
                      },
                    })
                  }
                >
                  <View style={styles.queueLeft}>
                    <View style={styles.queueIcon}>
                      <FontAwesome5
                        name="hourglass-half"
                        size={14}
                        color={theme.accentGold}
                      />
                    </View>

                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={[styles.queueTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                        {book.title}
                      </Text>

                      <Text style={styles.queueSub}>
                        Pending approval {book.queuePosition ? `(Queue #${book.queuePosition})` : ''}
                      </Text>
                    </View>
                  </View>

                  <Feather
                    name="chevron-right"
                    size={18}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              );
            }
          })
        )}

        {/* STATS */}
        <View style={styles.statsRow}>
          <View
            style={[styles.borrowedCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
          >
            <Ionicons
              name="library-outline"
              size={18}
              color={theme.textPrimary}
            />

            <Text
              style={[
                styles.borrowedNumber,
                { color: theme.accentGold }
              ]}
            >
              {borrowHistory.filter((item) => item.status === "Approved").length}
            </Text>

            <Text
              style={styles.borrowedText}
            >
              BOOKS BORROWED
            </Text>
          </View>

          <View style={[styles.pointsCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={styles.pointsIcon}>
              <MaterialCommunityIcons
                name="qrcode-scan"
                size={16}
                color={theme.accentGold}
              />
            </View>

            <Text
              style={[styles.pointsNumber, { color: theme.accentGold }]}
            >
              {libraryPoints}
            </Text>

            <Text
              style={styles.pointsText}
            >
              LIBRARY POINTS
            </Text>
          </View>
        </View>
          </>
        )}

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
    height: 70,
    backgroundColor: "#080F1E",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#111A2E",
  },

  headerTitle: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1.2,
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
    marginTop: 18,
  },

  helloText: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FCD34D",
  },

  subText: {
    marginTop: 4,
    color: "#94A3B8",
    fontSize: 14,
  },

  searchContainer: {
    paddingHorizontal: 20,
    marginTop: 18,
  },

  askBox: {
    height: 58,
    backgroundColor: "#111A2E",
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
  },

  askText: {
    flex: 1,
    color: "#94A3B8",
    marginLeft: 12,
    fontSize: 14,
  },

  sectionHeader: {
    marginTop: 28,
    marginHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FCD34D",
  },

  seeAll: {
    color: "#38BDF8",
    fontWeight: "600",
  },

  booksRow: {
    paddingLeft: 20,
    paddingTop: 14,
  },

  bookCard: {
    width: 150,
    backgroundColor: "#111A2E",
    borderRadius: 18,
    padding: 14,
    marginRight: 14,
    borderWidth: 1,
    borderColor: "#1E293B",
  },

  bookTitle: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "700",
  },

  bookAuthor: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 4,
  },

  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },

  ratingText: {
    color: "#CBD5E1",
    fontSize: 10,
    marginLeft: 6,
  },

  reservationTitle: {
    marginTop: 28,
    marginHorizontal: 20,
    fontSize: 20,
    fontWeight: "800",
    color: "#FCD34D",
  },

  reservationCard: {
    marginTop: 16,
    marginHorizontal: 20,
    backgroundColor: "#111A2E",
    borderRadius: 22,
    padding: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1E293B",
  },

  circleShape: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.02)",
    top: -40,
    right: -35,
  },

  pickupRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  bookIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#080F1E",
    borderWidth: 1,
    borderColor: "#1E293B",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  nextPickup: {
    fontSize: 10,
    fontWeight: "800",
    color: "#38BDF8",
    letterSpacing: 1,
  },

  reservationBook: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: "800",
    color: "#F8FAFC",
  },

  bottomReservation: {
    marginTop: 18,
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
    color: "#94A3B8",
    fontSize: 13,
  },

  readyButton: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 12,
  },

  readyText: {
    color: "#080F1E",
    fontWeight: "700",
  },

  queueCard: {
    marginTop: 18,
    marginHorizontal: 20,
    backgroundColor: "#111A2E",
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1E293B",
  },

  queueLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  queueIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#080F1E",
    borderWidth: 1,
    borderColor: "#1E293B",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  queueTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F8FAFC",
  },

  queueSub: {
    marginTop: 4,
    fontSize: 12,
    color: "#94A3B8",
  },

  statsRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 20,
    justifyContent: "space-between",
  },

  borrowedCard: {
    width: "48%",
    backgroundColor: "#111A2E",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1E293B",
  },

  borrowedNumber: {
    marginTop: 12,
    fontSize: 34,
    fontWeight: "800",
    color: "#FCD34D",
  },

  borrowedText: {
    marginTop: 4,
    color: "#94A3B8",
    fontSize: 11,
  },

  pointsCard: {
    width: "48%",
    backgroundColor: "#111A2E",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1E293B",
  },

  pointsIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#080F1E",
    borderWidth: 1,
    borderColor: "#1E293B",
    justifyContent: "center",
    alignItems: "center",
  },

  pointsNumber: {
    marginTop: 12,
    fontSize: 34,
    fontWeight: "800",
    color: "#FCD34D",
  },

  pointsText: {
    marginTop: 4,
    fontSize: 11,
    color: "#94A3B8",
  },

  floatingButton: {
    position: "absolute",
    right: 24,
    bottom: 95,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FCD34D",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
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
});