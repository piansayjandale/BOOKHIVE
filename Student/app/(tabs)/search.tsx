import React, { useCallback, useEffect, useState } from "react";
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
import { useRouter } from "expo-router";
import { useThemeColors } from "../../hooks/useThemeColors";
import {
  Feather,
  Ionicons,
  MaterialCommunityIcons,
  Entypo,
} from "@expo/vector-icons";
import { API_URL, getAuthHeaders } from "../../data/authService";
import { saveSearchQuery, getNotifications, subscribe, NotificationItem } from "../../data/store";
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

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();
  const [searchText, setSearchText] = useState("");
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
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
        setSelectedFile({
          uri: file.uri,
          name: file.name,
          size: file.size,
          mimeType: file.mimeType,
        });

        Alert.alert(
          "File Selected",
          `File '${file.name}' uploaded successfully.`
        );
      }
    } catch (error) {
      console.log("Document picking error:", error);
    }
  };

  // FETCH BOOKS
  const fetchBooks = useCallback(async (query: string) => {
    try {
      setLoading(true);

      // 1. Fetch from local backend
      let localItems: any[] = [];
      try {
        const headers = await getAuthHeaders();
        const localRes = await axios.get(
          `${API_URL}/api/student/books/search?q=${encodeURIComponent(query)}`,
          headers
        );
        if (localRes.status === 200 && localRes.data?.books) {
          localItems = localRes.data.books.map((book: any) => ({
            volumeInfo: {
              title: book.title,
              authors: [book.author],
              description: book.description || book.summary || "",
              categories: [book.category || book.department || "Circulation"],
              publishedDate: book.publicationDate || book.year || "2024",
              pageCount: book.pages || 320,
              language: book.language || "en",
              imageLinks: {
                thumbnail: book.coverUrl || book.coverImg || "https://via.placeholder.com/100",
              },
            },
            id: book.id,
            isbn: book.isbn,
            local: true,
            status: book.status || book.availability || "Available",
            shelfLocation: book.shelfLocation || "",
          }));
        }
      } catch (err) {
        console.log("Local search error:", err);
      }

      // 2. Local Kaggle dataset items only (Google Books fetch removed)
      const combinedItems = localItems;
      setBooks(combinedItems);

      // REAL BOOK TITLES
      const realSuggestions = combinedItems
        .slice(0, 5)
        .map((book: any) => book.volumeInfo.title);

      // AI + REAL SUGGESTIONS
      const combined = [
        ...new Set([
          ...realSuggestions,
          ...aiSuggestions.filter((item) =>
            item
              .toLowerCase()
              .includes(query.toLowerCase())
          ),
        ]),
      ];

      setSuggestions(combined);
    } catch (error) {
      console.log("BOOK API ERROR:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // SEARCH EFFECT
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchText.trim().length > 1) {
        fetchBooks(searchText);
        saveSearchQuery(searchText);
      } else {
        setBooks([]);
        setSuggestions([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchText, fetchBooks]);

  // MATCH %
  const getMatchPercentage = (
    title: string,
    description: string,
    categories: string[] = []
  ) => {
    const query = searchText
      .toLowerCase()
      .trim();

    if (!query) return 0;

    const titleText = title.toLowerCase();
    const descText = (description || "").toLowerCase();
    const catText = categories.join(" ").toLowerCase();

    // Clean and split query into words, filtering out stop words
    const rawWords = query.replace(/[^a-z0-9\s]/g, "").split(/\s+/);
    let queryWords = rawWords.filter(word => word.length > 1 && !STOP_WORDS.has(word));
    
    if (queryWords.length === 0) {
      queryWords = rawWords.filter(word => word.length > 1);
    }
    if (queryWords.length === 0) {
      queryWords = rawWords.filter(word => word.length > 0);
    }
    
    if (queryWords.length === 0) return 0;

    let matchedWordsCount = 0;

    // Check how many query words are found in the book's metadata fields
    queryWords.forEach(word => {
      const escapedWord = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(escapedWord, 'i');
      
      if (
        regex.test(titleText) || 
        regex.test(descText) || 
        regex.test(catText)
      ) {
        matchedWordsCount++;
      }
    });

    if (matchedWordsCount === 0) {
      return 0;
    }

    const totalWordsCount = queryWords.length;
    const percentage = Math.round((matchedWordsCount / totalWordsCount) * 100);

    return Math.min(100, Math.max(0, percentage));
  };

  // DEPARTMENT CLICK
  const handleDepartmentPress = (
    department: string
  ) => {
    setActiveDepartment(department);
    setSearchText(department);
    fetchBooks(department);
  };

  const activeDepartmentDetails =
    departments.find(
      (department) =>
          department.name === activeDepartment
      );
  
    const visibleBooks = books;
  
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
        {/* HERO */}
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

          <Text style={[styles.heroTitle, { color: theme.textPrimary }]}>
            Search our entire digital ecosystem
            with AI intelligence.
          </Text>

          {/* SEARCH BAR */}
          <View style={[styles.searchBar, { backgroundColor: theme.background, borderColor: theme.cardBorder }]}>
            <Feather
              name="search"
              size={18}
              color={theme.accentGold}
            />

            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search books, AI, Data Science..."
              placeholderTextColor={isDarkMode ? "#64748B" : "#94A3B8"}
              style={[styles.input, { height: Math.max(40, inputHeight), color: theme.textPrimary }]}
              multiline={true}
              onContentSizeChange={(e) => {
                setInputHeight(e.nativeEvent.contentSize.height);
              }}
              blurOnSubmit={true}
              onSubmitEditing={() => fetchBooks(searchText)}
              returnKeyType="search"
            />

            {/* ATTACHMENT BUTTON */}
            {searchText.length === 0 && (
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
            )}

            {/* ANALYZE */}
            <TouchableOpacity
              style={[styles.analyzeBtn, { backgroundColor: theme.accentGold }]}
              onPress={() =>
                fetchBooks(searchText)
              }
            >
              <Text style={[styles.analyzeText, { color: isDarkMode ? "#080F1E" : "#FFFFFF" }]}>
                ANALYZE
              </Text>
            </TouchableOpacity>
          </View>

          {/* SELECTED FILE */}
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

          {/* LIVE SUGGESTIONS */}
          {searchText.length > 0 &&
            suggestions.length > 0 && (
              <View
                style={styles.suggestionContainer}
              >
                {suggestions.map(
                  (item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.suggestionItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                      onPress={() => {
                        setSearchText(item);
                        fetchBooks(item);
                      }}
                    >
                      <Feather
                        name="search"
                        size={16}
                        color={theme.accentGold}
                      />

                      <Text
                        style={[
                          styles.suggestionText,
                          { color: theme.textPrimary }
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            )}
        </View>

        {/* DEPARTMENTS */}
        <View style={styles.departmentContainer}>
          <Text style={[styles.departmentTitle, { color: theme.textSecondary }]}>
            DEPARTMENTS
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
          >
            {departments.map((department) => {
              const isActive =
                activeDepartment ===
                department.name;

              return (
                <TouchableOpacity
                  key={department.name}
                  style={
                    isActive
                      ? [styles.activeChip, { backgroundColor: theme.accentGold }]
                      : [styles.chip, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]
                  }
                  onPress={() =>
                    handleDepartmentPress(
                      department.name
                    )
                  }
                >
                  <Text
                    style={
                      isActive
                        ? [styles.activeChipText, { color: isDarkMode ? "#080F1E" : "#FFFFFF" }]
                        : [styles.chipText, { color: theme.textSecondary }]
                    }
                  >
                    {department.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* LOADING */}
        {loading && (
          <ActivityIndicator
            size="large"
            color={theme.accentGold}
            style={{ marginTop: 30 }}
          />
        )}

        {/* RESULTS */}
        {searchText.length > 0 &&
          visibleBooks.length > 0 && (
            <>
              <View style={styles.resultHeader}>
                <Text style={[styles.resultTitle, { color: theme.textSecondary }]}>
                  QUERY RESULTS
                </Text>

                <Text style={[styles.resultSort, { color: theme.textSecondary }]}>
                  SORT: RELEVANCE
                </Text>
              </View>

              {visibleBooks
                .map((item) => {
                  const info = item.volumeInfo;
                  const match = getMatchPercentage(
                    info.title || "",
                    info.description || "",
                    info.categories || []
                  );
                  return { item, match };
                })
                .sort((a, b) => {
                  // Primary sort: match percentage (highest first)
                  if (b.match !== a.match) {
                    return b.match - a.match;
                  }
                  // Secondary sort: title alphabetical (for consistent ordering)
                  return (a.item.volumeInfo.title || "").localeCompare(b.item.volumeInfo.title || "");
                })
                .map(({ item, match }, index) => {
                  const info = item.volumeInfo;

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
                    key={index}
                    style={[styles.bookCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                    onPress={() =>
                      router.push({
                        pathname: '/book-details',
                        params: {
                          from: 'search',
                          id: item.id || '',
                          title: info.title || '',
                          author: info.authors?.[0] || 'Unknown Author',
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
                    <Image
                      source={{
                        uri:
                          info.imageLinks
                            ?.thumbnail ||
                          "https://via.placeholder.com/100",
                      }}
                      style={[styles.bookImage, { backgroundColor: theme.background }]}
                    />

                    <View style={{ flex: 1 }}>
                      <View style={styles.bookTop}>
                        <Text
                          style={[styles.bookTitle, { color: theme.textPrimary }]}
                        >
                          {info.title}
                        </Text>

                        <View
                          style={[styles.matchBadge, { backgroundColor: theme.accentGold }]}
                        >
                          <Text
                            style={[styles.matchText, { color: isDarkMode ? "#080F1E" : "#FFFFFF" }]}
                          >
                            {match}% MATCH
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={[styles.authorText, { color: theme.textSecondary }]}
                      >
                        {info.authors?.join(
                          ", "
                        ) || "Unknown Author"}
                      </Text>

                      <Text
                        numberOfLines={3}
                        style={[styles.description, { color: theme.textSecondary }]}
                      >
                        {info.description ||
                          "No description available."}
                      </Text>

                      <View
                        style={[
                          styles.progressBackground,
                          { backgroundColor: theme.background, borderColor: theme.cardBorder }
                        ]}
                      >
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${match}%`,
                            },
                          ]}
                        />
                      </View>

                      <View
                        style={styles.bookBottom}
                      >
                        <View style={styles.categoryContainer}>
                          <Text
                            style={[
                              styles.categoryText,
                              { color: theme.textSecondary }
                            ]}
                          >
                            {item.local ? "BookHive Library" : "Google Books API"}
                          </Text>
                          <View style={[styles.departmentTag, { backgroundColor: theme.background, borderColor: theme.cardBorder }]}>
                            <Ionicons
                              name="library-outline"
                              size={12}
                              color={theme.accentGold}
                            />
                            <Text
                              style={[styles.departmentTagText, { color: theme.accentGold }]}
                              numberOfLines={1}
                            >
                              {classifiedDepartment}
                            </Text>
                          </View>
                        </View>

                        <View
                          style={styles.iconRow}
                        >
                          <TouchableOpacity>
                            <Feather
                              name="bookmark"
                              size={18}
                              color={theme.textSecondary}
                            />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={{
                              marginLeft: 14,
                            }}
                          >
                            <Feather
                              name="share-2"
                              size={18}
                              color={theme.textSecondary}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

        {/* EMPTY */}
        {searchText.length > 1 &&
          !loading &&
          visibleBooks.length === 0 && (
            <View style={styles.emptyBox}>
              <MaterialCommunityIcons
                name="book-search-outline"
                size={60}
                color={theme.textSecondary}
              />

              <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                No books found
              </Text>

              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Try another title, keyword,
                author, or category.
              </Text>
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

  resultHeader: {
    marginTop: 26,
    marginHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  resultTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: "#64748B",
  },

  resultSort: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
  },

  bookCard: {
    backgroundColor: "#111A2E",
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1E293B",
    flexDirection: "row",
  },

  bookImage: {
    width: 90,
    height: 130,
    borderRadius: 14,
    marginRight: 16,
    backgroundColor: "#080F1E",
  },

  bookTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  bookTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: "#F8FAFC",
    paddingRight: 8,
  },

  matchBadge: {
    backgroundColor: "#FCD34D",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },

  matchText: {
    color: "#080F1E",
    fontWeight: "800",
    fontSize: 10,
  },

  authorText: {
    marginTop: 6,
    color: "#94A3B8",
    fontStyle: "italic",
    fontSize: 13,
  },

  description: {
    marginTop: 10,
    color: "#CBD5E1",
    fontSize: 13,
    lineHeight: 20,
  },

  progressBackground: {
    marginTop: 14,
    height: 6,
    backgroundColor: "#080F1E",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1E293B",
  },

  progressFill: {
    height: "100%",
    backgroundColor: "#38BDF8",
  },

  bookBottom: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  categoryContainer: {
    flex: 1,
    flexDirection: "column",
    gap: 8,
  },

  categoryText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
  },

  departmentTag: {
    backgroundColor: "#080F1E",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 200,
    borderWidth: 1,
    borderColor: "#1E293B",
  },

  departmentTagText: {
    color: "#FCD34D",
    fontSize: 11,
    fontWeight: "600",
  },

  iconRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  emptyBox: {
    marginTop: 80,
    alignItems: "center",
    paddingHorizontal: 40,
  },

  emptyTitle: {
    marginTop: 20,
    fontSize: 20,
    fontWeight: "800",
    color: "#F8FAFC",
  },

  emptyText: {
    marginTop: 10,
    textAlign: "center",
    color: "#94A3B8",
    lineHeight: 22,
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