import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import AnimatedScreen from "../components/AnimatedScreen";
import { useThemeColors } from "../hooks/useThemeColors";
import { getCachedAllBooks, setCachedAllBooks, getPersonalizedRecommendedBooks, saveBookToViewHistory } from "../data/store";
import { API_URL, getAuthHeaders } from "../data/authService";
import localBooks from "../data/books";
import axios from "axios";

const { width } = Dimensions.get("window");
const GRID_CARD_WIDTH = (width - 44) / 2;

function DepartmentBookCover({
  uri,
  title,
  style,
  iconSize = 22,
}: {
  uri?: string | null;
  title: string;
  style: any;
  iconSize?: number;
}) {
  const [imageError, setImageError] = useState(false);
  const { isDarkMode, theme } = useThemeColors();

  if (uri && !imageError) {
    return (
      <View style={[style, styles.coverWrapper]}>
        <Image
          source={{ uri }}
          style={styles.fullImage}
          resizeMode="cover"
          onError={() => setImageError(true)}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        style,
        styles.coverWrapper,
        {
          backgroundColor: theme.bookCoverBg,
          borderColor: theme.bookCoverBorder,
          borderWidth: 1,
        },
      ]}
    >
      {/* Decorative top-right gold bookmark ribbon (Matches Home screen) */}
      <View
        style={{
          position: "absolute",
          top: 0,
          right: 8,
          width: 7,
          height: 13,
          backgroundColor: isDarkMode ? theme.accentGold : "#FCD400",
          borderBottomLeftRadius: 3,
          borderBottomRightRadius: 3,
          zIndex: 2,
        }}
      />

      {/* Warm Yellow Highlight Container for Book Icon (Matches Home screen) */}
      <View
        style={{
          width: Math.max(32, iconSize + 12),
          height: Math.max(32, iconSize + 12),
          borderRadius: Math.round((iconSize + 12) / 2),
          backgroundColor: isDarkMode ? "rgba(255, 215, 0, 0.18)" : "#FEF08A",
          borderColor: isDarkMode ? "rgba(255, 215, 0, 0.45)" : "#FDE047",
          borderWidth: 1.5,
          justifyContent: "center",
          alignItems: "center",
          shadowColor: "#FCD400",
          shadowOffset: { width: 0, height: 1.5 },
          shadowOpacity: isDarkMode ? 0.3 : 0.25,
          shadowRadius: 2.5,
          elevation: 2,
        }}
      >
        <MaterialCommunityIcons
          name="book-open-page-variant"
          size={iconSize}
          color={isDarkMode ? theme.accentGold : "#0274BB"}
        />
      </View>
    </View>
  );
}

export default function DepartmentBooksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();
  const params = useLocalSearchParams<{ department?: string }>();

  const departmentName = params.department || "Circulation";

  const [allBooks, setAllBooks] = useState<any[]>(() => getCachedAllBooks());
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "available">("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const fetchBooks = useCallback(async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      let booksArray: any[] = [];

      try {
        const response = await axios.get(`${API_URL}/api/books`, headers);
        if (response.status === 200 && Array.isArray(response.data?.books)) {
          booksArray = response.data.books;
        }
      } catch {
        try {
          const studentRes = await axios.get(`${API_URL}/api/student/books?limit=200`, headers);
          if (studentRes.status === 200 && Array.isArray(studentRes.data?.books)) {
            booksArray = studentRes.data.books;
          }
        } catch {
          try {
            const adminRes = await axios.get(`${API_URL}/api/admin/books?limit=200`, headers);
            if (adminRes.status === 200 && Array.isArray(adminRes.data?.books)) {
              booksArray = adminRes.data.books;
            }
          } catch {}
        }
      }

      let mappedBooks: any[] = [];
      if (Array.isArray(booksArray) && booksArray.length > 0) {
        mappedBooks = booksArray.map((book: any, idx: number) => {
          const charSum = book.title
            ? book.title.split("").reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0)
            : 0;
          const pseudoRating = (4.2 + (charSum % 8) / 10).toFixed(1);
          return {
            id: String(book.id || `dept-book-${idx}`),
            title: book.title || "Untitled Book",
            author: book.author || "Unknown Author",
            rating: book.rating && Number(book.rating) > 0 ? String(book.rating) : String(pseudoRating),
            category: book.genres || book.category || book.department || "Circulation",
            department: book.department || "Circulation",
            isbn: book.isbn || "",
            shelf: book.shelfLocation || book.shelf || "CIR-01A.1",
            available: String(
              book.availableCopies !== undefined
                ? book.availableCopies > 0
                : book.availability === "Available" || book.availability === "true" || book.status === "Available"
            ),
            year: book.publicationDate ? String(book.publicationDate).substring(0, 4) : book.year ? String(book.year) : "2026",
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

      if (mappedBooks.length === 0 && Array.isArray(localBooks) && localBooks.length > 0) {
        mappedBooks = localBooks.map((book: any, idx: number) => {
          const charSum = book.title
            ? book.title.split("").reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0)
            : 0;
          const pseudoRating = (4.2 + (charSum % 8) / 10).toFixed(1);
          const dept = book.department || "General";
          return {
            id: `local-dept-book-${idx}`,
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
      setCachedAllBooks(mappedBooks);
    } catch (err) {
      console.warn("Error fetching department books:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!allBooks || allBooks.length === 0) {
      fetchBooks();
    }
  }, [allBooks, fetchBooks]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBooks();
  }, [fetchBooks]);

  // Filter all books specifically for this department
  const departmentRecords = useMemo(() => {
    if (!allBooks || allBooks.length === 0) return [];
    const nameLower = departmentName.toLowerCase().trim();

    let list: any[] = [];

    if (nameLower === "new arrivals" || nameLower === "new arrival") {
      list = allBooks;
    } else if (nameLower === "recommended books" || nameLower === "recommended") {
      list = getPersonalizedRecommendedBooks(allBooks, 60);
    } else if (nameLower === "circulation") {
      list = allBooks.filter((b) => {
        const dept = (b.department || "").toLowerCase();
        const cat = (b.category || "").toLowerCase();
        return (
          dept.includes("circulation") ||
          cat.includes("fiction") ||
          cat.includes("computer") ||
          cat.includes("science") ||
          cat.includes("engineering") ||
          cat.includes("business")
        );
      });
      if (list.length === 0) {
        list = allBooks.filter((b) => (b.department || "").toLowerCase().includes("circulation"));
      }
    } else if (nameLower === "general references" || nameLower === "general reference") {
      list = allBooks.filter((b) => {
        const dept = (b.department || "").toLowerCase();
        const cat = (b.category || "").toLowerCase();
        return (
          dept.includes("general") ||
          dept.includes("reference") ||
          cat.includes("reference") ||
          cat.includes("nonfiction") ||
          cat.includes("history") ||
          cat.includes("arts")
        );
      });
    } else if (nameLower === "filipiniana") {
      list = allBooks.filter((b) => {
        const dept = (b.department || "").toLowerCase();
        const cat = (b.category || "").toLowerCase();
        const title = (b.title || "").toLowerCase();
        return (
          dept.includes("filipiniana") ||
          cat.includes("filipiniana") ||
          cat.includes("philippine") ||
          title.includes("philippine") ||
          title.includes("ilustrado") ||
          title.includes("rizal") ||
          title.includes("ibong") ||
          title.includes("florante")
        );
      });
    } else if (nameLower === "periodicals" || nameLower === "periodical") {
      list = allBooks.filter((b) => {
        const dept = (b.department || "").toLowerCase();
        const cat = (b.category || "").toLowerCase();
        const title = (b.title || "").toLowerCase();
        return (
          dept.includes("periodical") ||
          cat.includes("periodical") ||
          cat.includes("journal") ||
          cat.includes("magazine") ||
          title.includes("journal") ||
          title.includes("review")
        );
      });
    } else if (nameLower === "special collections" || nameLower === "special collection") {
      list = allBooks.filter((b) => {
        const dept = (b.department || "").toLowerCase();
        const cat = (b.category || "").toLowerCase();
        return (
          dept.includes("special") ||
          dept.includes("reserve") ||
          cat.includes("special") ||
          cat.includes("pedagogy") ||
          cat.includes("education") ||
          cat.includes("rare") ||
          cat.includes("classic")
        );
      });
    } else {
      list = allBooks.filter((b) => {
        const dept = (b.department || "").toLowerCase();
        const cat = (b.category || "").toLowerCase();
        return dept.includes(nameLower) || cat.includes(nameLower);
      });
    }

    if (list.length === 0) {
      list = allBooks;
    }

    // Apply quick filters
    if (filterMode === "available") {
      list = list.filter((b) => b.available === "true" || b.available === true);
    }

    // Apply text search
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (b) =>
          (b.title || "").toLowerCase().includes(q) ||
          (b.author || "").toLowerCase().includes(q) ||
          (b.isbn || "").toLowerCase().includes(q) ||
          (b.category || "").toLowerCase().includes(q) ||
          (b.shelf || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [allBooks, departmentName, filterMode, searchQuery]);

  const handleBookPress = (book: any) => {
    saveBookToViewHistory(book);
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
        department: book.department || departmentName,
        fromDepartment: departmentName,
        from: "department",
        rating: book.rating,
        shelf: book.shelf,
        available: book.available,
        isbn: book.isbn,
        copies: book.copies,
        volume: book.volume,
        edition: book.edition,
        accessionNumber: book.accessionNumber,
      },
    });
  };

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: theme.headerBg,
            borderBottomColor: theme.headerBorder,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack?.()) {
              router.back();
            } else {
              router.push("/(tabs)");
            }
          }}
          activeOpacity={0.7}
          style={[
            styles.backButton,
            {
              backgroundColor: isDarkMode ? "rgba(255, 215, 0, 0.12)" : "#EFF6FF",
              borderColor: isDarkMode ? "rgba(255, 215, 0, 0.3)" : "rgba(2, 116, 187, 0.2)",
              borderWidth: 1,
            },
          ]}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={isDarkMode ? theme.accentGold : "#0274BB"}
          />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: isDarkMode ? theme.accentGold : "#0274BB" }]} numberOfLines={1}>
            {departmentName.toUpperCase()}
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Department Catalog Records
          </Text>
        </View>

        {/* Total Records Badge */}
        <View
          style={[
            styles.recordCountBadge,
            {
              backgroundColor: theme.badgeYellowBg,
              borderColor: theme.badgeYellowBorder,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[styles.recordCountText, { color: theme.badgeYellowText, fontWeight: "800" }]}>
            {departmentRecords.length}
          </Text>
        </View>
      </View>

      {/* SEARCH AND FILTER SECTION */}
      <View style={[styles.filterSection, { backgroundColor: theme.cardBg, borderBottomColor: theme.cardBorder }]}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: isDarkMode ? "#111827" : "#F8FAFC",
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <Ionicons
            name="search"
            size={18}
            color={isDarkMode ? theme.accentGold : "#0274BB"}
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            placeholder={`Search within ${departmentName}...`}
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips and View Mode Toggle */}
        <View style={styles.filterRowWithToggle}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setFilterMode("all")}
              style={[
                styles.filterChip,
                filterMode === "all"
                  ? {
                      backgroundColor: isDarkMode ? "rgba(255, 215, 0, 0.15)" : "#E0F2FE",
                      borderColor: isDarkMode ? theme.accentGold : "#0274BB",
                    }
                  : {
                      backgroundColor: isDarkMode ? "#1F2937" : "#F8FAFC",
                      borderColor: isDarkMode ? "#374151" : "rgba(2, 116, 187, 0.16)",
                    },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color: filterMode === "all" ? (isDarkMode ? theme.accentGold : "#0274BB") : theme.textSecondary,
                    fontWeight: filterMode === "all" ? "800" : "600",
                  },
                ]}
              >
                All Records ({departmentRecords.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setFilterMode("available")}
              style={[
                styles.filterChip,
                filterMode === "available"
                  ? {
                      backgroundColor: isDarkMode ? "rgba(16, 185, 129, 0.18)" : "#ECFDF5",
                      borderColor: isDarkMode ? "#10B981" : "#059669",
                    }
                  : {
                      backgroundColor: isDarkMode ? "#1F2937" : "#F8FAFC",
                      borderColor: isDarkMode ? "#374151" : "rgba(2, 116, 187, 0.16)",
                    },
              ]}
            >
              <View style={[styles.filterDot, { backgroundColor: theme.statusSuccess }]} />
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color: filterMode === "available" ? (isDarkMode ? "#10B981" : "#059669") : theme.textSecondary,
                    fontWeight: filterMode === "available" ? "800" : "600",
                  },
                ]}
              >
                Available Only
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* View Mode Toggle: List vs Grid */}
          <View style={[styles.viewToggleWrap, { backgroundColor: isDarkMode ? "#1F2937" : "#F8FAFC", borderColor: theme.cardBorder }]}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setViewMode("list")}
              style={[
                styles.viewToggleBtn,
                viewMode === "list" && {
                  backgroundColor: isDarkMode ? "rgba(255, 215, 0, 0.15)" : "#E0F2FE",
                  borderColor: isDarkMode ? theme.accentGold : "#0274BB",
                  borderWidth: 1,
                },
              ]}
            >
              <Ionicons
                name="list"
                size={16}
                color={viewMode === "list" ? (isDarkMode ? theme.accentGold : "#0274BB") : theme.textMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setViewMode("grid")}
              style={[
                styles.viewToggleBtn,
                viewMode === "grid" && {
                  backgroundColor: isDarkMode ? "rgba(255, 215, 0, 0.15)" : "#E0F2FE",
                  borderColor: isDarkMode ? theme.accentGold : "#0274BB",
                  borderWidth: 1,
                },
              ]}
            >
              <Ionicons
                name="grid"
                size={16}
                color={viewMode === "grid" ? (isDarkMode ? theme.accentGold : "#0274BB") : theme.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* BOOKS LIST */}
      {loading && departmentRecords.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accentBlue} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading {departmentName} records...
          </Text>
        </View>
      ) : departmentRecords.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View
            style={[
              styles.emptyIconCircle,
              {
                backgroundColor: theme.badgeYellowBg,
                borderColor: theme.badgeYellowBorder,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="book-open-page-variant"
              size={40}
              color={isDarkMode ? theme.accentGold : "#0274BB"}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
            No Book Records Found
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            {searchQuery.length > 0
              ? `No records match "${searchQuery}" in ${departmentName}. Try a different keyword.`
              : `There are currently no records listed under the ${departmentName} department.`}
          </Text>
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={[
                styles.resetSearchBtn,
                { backgroundColor: theme.buttonPrimaryBg, borderColor: theme.buttonPrimaryBorder },
              ]}
            >
              <Text style={[styles.resetSearchText, { color: theme.buttonPrimaryText }]}>
                Clear Search Filter
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={viewMode === "grid" ? styles.gridScrollContent : styles.listScrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.brandBlue]}
              tintColor={theme.brandBlue}
            />
          }
        >
          {viewMode === "list" ? (
            /* =================== LIST VIEW =================== */
            departmentRecords.map((book, index) => {
              const isAvailable = book.available === "true" || book.available === true;

              return (
                <TouchableOpacity
                  key={`dept-list-book-${book.id || index}-${index}`}
                  activeOpacity={0.88}
                  style={[
                    styles.listBookCard,
                    {
                      backgroundColor: theme.cardBg,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                  onPress={() => handleBookPress(book)}
                >
                  {/* Fixed-Size Cover Thumbnail with Blue Highlight */}
                  <DepartmentBookCover
                    uri={book.coverImage}
                    title={book.title}
                    style={styles.listCoverThumb}
                    iconSize={20}
                  />

                  {/* Complete Book Details */}
                  <View style={styles.listDetailsCol}>
                    <View>
                      <Text
                        style={[styles.listBookTitle, { color: theme.textPrimary }]}
                        numberOfLines={2}
                      >
                        {book.title}
                      </Text>
                      <Text
                        style={[styles.listBookAuthor, { color: theme.textSecondary }]}
                        numberOfLines={1}
                      >
                        by {book.author}
                      </Text>
                    </View>

                    {/* Shelf and Availability Badges */}
                    <View style={styles.listMetaRow}>
                      <View
                        style={[
                          styles.shelfBadge,
                          {
                            backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "#F1F5F9",
                            borderColor: theme.cardBorder,
                          },
                        ]}
                      >
                        <Ionicons
                          name="location-outline"
                          size={11}
                          color={isDarkMode ? theme.accentGold : theme.accentBlue}
                          style={{ marginRight: 3 }}
                        />
                        <Text
                          style={[styles.shelfBadgeText, { color: theme.textSecondary }]}
                          numberOfLines={1}
                        >
                          {book.shelf || "General Shelf"}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.availPill,
                          {
                            backgroundColor: isAvailable
                              ? theme.statusSuccessBg
                              : theme.badgeYellowBg,
                            borderColor: isAvailable
                              ? "rgba(5, 150, 105, 0.25)"
                              : theme.badgeYellowBorder,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            {
                              backgroundColor: isAvailable
                                ? theme.statusSuccess
                                : theme.badgeYellowText,
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.availPillText,
                            {
                              color: isAvailable
                                ? theme.statusSuccess
                                : theme.badgeYellowText,
                            },
                          ]}
                        >
                          {isAvailable ? "Available" : "Waitlist"}
                        </Text>
                      </View>
                    </View>

                    {/* Footer Row: Category Badge (Matches Picture 2) & Action Button */}
                    <View style={styles.listFooterRow}>
                      <View
                        style={[
                          styles.cardCategoryBadge,
                          {
                            backgroundColor: theme.badgeCategoryBg,
                            borderColor: isDarkMode ? "transparent" : theme.badgeCategoryBorder,
                            borderWidth: isDarkMode ? 0 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.cardCategoryText,
                            { color: theme.badgeCategoryText, fontWeight: "800", letterSpacing: 0.5 },
                          ]}
                          numberOfLines={1}
                        >
                          {(book.category || departmentName).toUpperCase()}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => handleBookPress(book)}
                        activeOpacity={0.8}
                        style={[
                          styles.actionBtn,
                          {
                            backgroundColor: isAvailable
                              ? theme.buttonPrimaryBg
                              : theme.tabBarActivePill,
                            borderColor: isAvailable
                              ? theme.buttonPrimaryBorder
                              : theme.badgeYellowBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.actionBtnText,
                            {
                              color: isAvailable
                                ? theme.buttonPrimaryText
                                : isDarkMode ? "#FFD700" : "#0274BB",
                            },
                          ]}
                        >
                          {isAvailable ? "Borrow" : "View Details"}
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={12}
                          color={
                            isAvailable
                              ? theme.buttonPrimaryText
                              : isDarkMode ? "#FFD700" : "#0274BB"
                          }
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            /* =================== GRID VIEW =================== */
            <View style={styles.gridContainer}>
              {departmentRecords.map((book, index) => {
                const isAvailable = book.available === "true" || book.available === true;

                return (
                  <TouchableOpacity
                    key={`dept-grid-book-${book.id || index}-${index}`}
                    activeOpacity={0.88}
                    style={[
                      styles.gridBookCard,
                      {
                        backgroundColor: theme.cardBg,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                    onPress={() => handleBookPress(book)}
                  >
                    {/* Grid Cover */}
                    <View style={styles.gridCoverWrap}>
                      <DepartmentBookCover
                        uri={book.coverImage}
                        title={book.title}
                        style={styles.gridCoverImage}
                        iconSize={22}
                      />

                      {/* Overlaid Availability Pill */}
                      <View
                        style={[
                          styles.gridAvailBadge,
                          {
                            backgroundColor: isAvailable
                              ? theme.statusSuccessBg
                              : theme.badgeYellowBg,
                            borderColor: isAvailable
                              ? "rgba(5, 150, 105, 0.3)"
                              : theme.badgeYellowBorder,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            {
                              backgroundColor: isAvailable
                                ? theme.statusSuccess
                                : theme.badgeYellowText,
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.gridAvailText,
                            {
                              color: isAvailable
                                ? theme.statusSuccess
                                : theme.badgeYellowText,
                            },
                          ]}
                        >
                          {isAvailable ? "Available" : "Waitlist"}
                        </Text>
                      </View>
                    </View>

                    {/* Grid Book Information */}
                    <View style={styles.gridContentWrap}>
                      <Text
                        style={[styles.gridBookTitle, { color: theme.textPrimary }]}
                        numberOfLines={2}
                      >
                        {book.title}
                      </Text>
                      <Text
                        style={[styles.gridBookAuthor, { color: theme.textSecondary }]}
                        numberOfLines={1}
                      >
                        by {book.author}
                      </Text>

                      <View style={styles.gridShelfRow}>
                        <Ionicons
                          name="location-outline"
                          size={10}
                          color={isDarkMode ? theme.accentGold : theme.accentBlue}
                        />
                        <Text
                          style={[styles.gridShelfText, { color: theme.textSecondary }]}
                          numberOfLines={1}
                        >
                          {book.shelf || "General Shelf"}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => handleBookPress(book)}
                        activeOpacity={0.8}
                        style={[
                          styles.gridActionBtn,
                          {
                            backgroundColor: isAvailable
                              ? theme.buttonPrimaryBg
                              : theme.tabBarActivePill,
                            borderColor: theme.badgeYellowBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.gridActionBtnText,
                            {
                              color: isAvailable
                                ? theme.buttonPrimaryText
                                : isDarkMode ? "#FFD700" : "#0274BB",
                            },
                          ]}
                        >
                          {isAvailable ? "Borrow" : "View"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 6,
    marginRight: 6,
    borderRadius: 8,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  recordCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  recordCountText: {
    fontSize: 12,
    fontWeight: "800",
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  filterRowWithToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 8,
  },
  filterChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 6,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11,
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  viewToggleWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    padding: 2,
    gap: 2,
  },
  viewToggleBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
  },
  resetSearchBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  resetSearchText: {
    fontSize: 13,
    fontWeight: "800",
  },

  // Cover Component Styles
  coverWrapper: {
    borderRadius: 10,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },

  // List View Styles
  listScrollContent: {
    padding: 16,
    gap: 12,
  },
  listBookCard: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  listCoverThumb: {
    width: 78,
    height: 108,
    borderRadius: 10,
    flexShrink: 0,
  },
  listDetailsCol: {
    flex: 1,
    marginLeft: 14,
    justifyContent: "space-between",
  },
  listBookTitle: {
    fontSize: 14.5,
    fontWeight: "800",
    lineHeight: 19,
  },
  listBookAuthor: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  listMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginVertical: 6,
    flexWrap: "wrap",
  },
  shelfBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  shelfBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  availPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 4,
  },
  availPillText: {
    fontSize: 9.5,
    fontWeight: "800",
  },
  listFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  cardCategoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    maxWidth: "55%",
  },
  cardCategoryText: {
    fontSize: 10,
    fontWeight: "700",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  // Grid View Styles
  gridScrollContent: {
    padding: 16,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
  },
  gridBookCard: {
    width: GRID_CARD_WIDTH,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  gridCoverWrap: {
    width: "100%",
    height: 120,
    position: "relative",
  },
  gridCoverImage: {
    width: "100%",
    height: "100%",
  },
  gridAvailBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  gridAvailText: {
    fontSize: 9,
    fontWeight: "800",
  },
  gridContentWrap: {
    padding: 10,
  },
  gridBookTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    lineHeight: 16,
    marginBottom: 2,
  },
  gridBookAuthor: {
    fontSize: 11,
    fontWeight: "500",
    marginBottom: 4,
  },
  gridShelfRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 8,
  },
  gridShelfText: {
    fontSize: 9.5,
  },
  gridActionBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  gridActionBtnText: {
    fontSize: 11,
    fontWeight: "800",
  },
});
