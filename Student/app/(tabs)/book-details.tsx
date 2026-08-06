import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimatedScreen from "../../components/AnimatedScreen";
import * as Clipboard from "expo-clipboard";

import {
  Feather,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";

import {
  useRouter,
  useLocalSearchParams,
} from "expo-router";

import {
  getReservations,
  removeReservation,
  ReservationBook,
  subscribe,
  saveBookToViewHistory,
  isBookFavorite,
  toggleFavoriteBook,
  addReservation,
  getStudentProfile,
} from "../../data/store";
import { useThemeColors } from "../../hooks/useThemeColors";

export default function BookDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();

  const hasBookDetails =
    typeof params.title === "string" &&
    params.title.trim().length > 0;

  const id =
    (params.id as string) ||
    Date.now().toString();

  const title =
    (params.title as string) ||
    "Unknown Book";

  const author =
    (params.author as string) ||
    "Unknown Author";

  const description =
    (params.description as string) ||
    "No description available.";

  const year =
    (params.year as string) || "2024";

  const pages =
    (params.pages as string) || "320";

  const languageRaw = (params.language as string) || "EN";
  const language = languageRaw.replace(/[\[\]'"\\]/g, "").trim();

  const categoryRaw = (params.category as string) || "CS";
  const category = categoryRaw.replace(/[\[\]'"\\]/g, "").trim();

  const departmentParam =
    (params.department as string) || category;

  const rating =
    (params.rating as string) || "4.8";

  const reviews =
    (params.reviews as string) || "218";

  const shelf =
    (params.shelf as string) ||
    "Shelf A-102, 2nd Floor";

  const available =
    (params.available as string) === "true";

  const [reservations, setReservations] =
    useState<ReservationBook[]>(
      getReservations()
    );

  const [isFav, setIsFav] = useState(isBookFavorite(id));
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!hasBookDetails) {
      router.replace("/");
      return;
    }

    setReservations(getReservations());
    setIsFav(isBookFavorite(id));

    // Save viewed book to local history
    const currentBookObj = {
      id,
      title,
      author,
      description,
      year,
      pages,
      language,
      category,
      shelf,
      available: String(available),
      rating,
      reviews,
    };
    saveBookToViewHistory(currentBookObj);

    const unsubscribe = subscribe(() => {
      setReservations(getReservations());
      setIsFav(isBookFavorite(id));
    });

    return unsubscribe;
  }, [hasBookDetails, router, id]);

  const toggleFav = () => {
    const currentBookObj = {
      id,
      title,
      author,
      description,
      year,
      pages,
      language,
      category,
      shelf,
      available: String(available),
      rating,
      reviews,
    };
    toggleFavoriteBook(currentBookObj);
    setIsFav(!isFav);
  };

  if (!hasBookDetails) {
    return null;
  }

  const getDepartmentLocation = (
    category: string
  ) => {
    const normalized = category
      .toLowerCase()
      .trim();

    if (
      normalized.includes("engineering") ||
      normalized.includes("maritime")
    ) {
      return "Engineering & Maritime Section";
    }

    if (
      normalized.includes("filipiniana") ||
      normalized.includes("negrosiana")
    ) {
      return "Filipiniana & Negrosiana Section";
    }

    if (
      normalized.includes("reference") ||
      normalized.includes("dictionary") ||
      normalized.includes("encyclopedia")
    ) {
      return "General Reference Section";
    }

    if (normalized.includes("periodical")) {
      return "Periodical Section";
    }

    if (
      normalized.includes("archive") ||
      normalized.includes("history")
    ) {
      return "Archive Section";
    }

    if (
      normalized.includes("e-library") ||
      normalized.includes("internet") ||
      normalized.includes("digital")
    ) {
      return "E-Library / Internet Service Center";
    }

    if (
      normalized.includes("law") ||
      normalized.includes("graduate")
    ) {
      return "Law & Graduate Studies Library";
    }

    if (normalized.includes("reserve")) {
      return "Reserve Section";
    }

    if (normalized.includes("technical")) {
      return "Technical Section";
    }

    return "Circulation Section";
  };

  const departmentLocation =
    getDepartmentLocation(departmentParam);

  const from =
    (params.from as string) || "search";

  const activeRequest = reservations.find((book) => book.id === id);
  const isReserved = !!activeRequest;
  const requestStatus = activeRequest?.status; // 'Approved', 'Pending', 'Upcoming', etc.

  const citationFormats = [
    { key: "APA_7", label: "APA 7th Citation", format: () => `${author} (${year}). ${title}. BookHive Academic Library.` },
    { key: "APA_6", label: "APA (Sixth Edition)", format: () => `${author}. (${year}). ${title}. BookHive Academic Library.` },
    { key: "Chicago_17", label: "Chicago 17th Citation", format: () => `${author}, ${title} (BookHive Academic Library, ${year}).` },
    { key: "Chicago_16", label: "Chicago (Sixteenth Edition)", format: () => `${author}. ${title}. BookHive Academic Library, ${year}.` },
    { key: "GB7714", label: "GB7714 (2005)", format: () => `${author}. ${title}. BookHive Academic Library, ${year}.` },
    { key: "GOST_Name", label: "GOST - Name Sort (2003)", format: () => `${author} ${title}. — BookHive Academic Library, ${year}.` },
    { key: "GOST_Title", label: "GOST - Title Sort (2003)", format: () => `${title} / ${author}. — BookHive Academic Library, ${year}.` },
    { key: "Harvard_Anglia", label: "Harvard - Anglia (2008)", format: () => `${author} (${year}) ${title}. BookHive Academic Library.` },
    { key: "Harvard_Standard", label: "Harvard Citation", format: () => `${author}, ${year}. ${title}. BookHive Academic Library.` },
    { key: "IEEE", label: "IEEE (2006)", format: () => `[1] ${author}, "${title}," BookHive Academic Library, ${year}.` },
    { key: "ISO_690_Date", label: "ISO 690 - First Element and Date (1987)", format: () => `${author.toUpperCase()}. ${title}. BookHive Academic Library, ${year}.` },
    { key: "ISO_690_Num", label: "ISO 690 - Numerical Reference (1987)", format: () => `[1] ${author.toUpperCase()}, ${title}. BookHive Academic Library, ${year}.` },
    { key: "MLA_9", label: "MLA 9th Citation", format: () => `${author}. ${title}. BookHive Academic Library, ${year}.` },
    { key: "MLA_7", label: "MLA (Seventh Edition)", format: () => `${author}. ${title}. BookHive Academic Library, ${year}. Print.` },
    { key: "SIST02", label: "SIST02 (2003)", format: () => `${author}. ${title}. BookHive Academic Library, ${year}.` },
    { key: "Turabian", label: "Turabian (Sixth Edition)", format: () => `${author}. ${title}. BookHive Academic Library, ${year}.` },
    { key: "Vancouver", label: "Vancouver Citation", format: () => `${author}. ${title}. BookHive Academic Library; ${year}.` },
  ];

  const [selectedFormat, setSelectedFormat] = useState(citationFormats[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleBack = () => {
    router.replace("/(tabs)");
  };

  const handleCopyCitation = async () => {
    const citationText = selectedFormat.format();
    try {
      await Clipboard.setStringAsync(citationText);
    } catch (err) {
      console.warn("Failed to copy citation: ", err);
    }
    Alert.alert(
      "Citation Copied",
      citationText
    );
  };

  const handleReservation = async () => {
    if (isReserved) {
      if (requestStatus === 'Approved') {
        Alert.alert(
          "Active Loan",
          `You currently have an active loan for "${title}". Please return the book to the library when finished.`
        );
        return;
      }

      Alert.alert(
        "Cancel Request",
        `Are you sure you want to cancel your request for "${title}"?`,
        [
          { text: "No", style: "cancel" },
          {
            text: "Yes",
            style: "destructive",
            onPress: async () => {
              await removeReservation(id);
              setReservations(getReservations());
              Alert.alert(
                "Request Cancelled",
                `Your request for "${title}" has been cancelled.`
              );
            }
          }
        ]
      );
      return;
    }

    if (available) {
      router.push({
        pathname: '/borrow',
        params: {
          title,
          author,
          isbn: (params.isbn as string) || '',
          department: departmentParam,
          action: 'Borrow',
        },
      });
    } else {
      try {
        const reservationDate = new Date();
        const returnDate = new Date();
        returnDate.setDate(returnDate.getDate() + 7);
        
        const formattedResDate = reservationDate.toISOString().replace('T', ' ').substring(0, 16);
        const formattedReturnDate = returnDate.toISOString().split('T')[0];

        const profile = getStudentProfile();

        await addReservation({
          id: id,
          title: title,
          author: author,
          isbn: (params.isbn as string) || '',
          category: category,
          date: formattedReturnDate,
          pickupDate: formattedResDate,
          returnDate: formattedReturnDate,
          status: 'Pending',
          action: 'Reserve',
          studentName: profile?.name || 'Bernadette Ramos',
          studentId: profile?.studentId || '2025-0001',
          department: departmentLocation || 'Circulation Section',
        });

        Alert.alert(
          "Book Reserved Successfully",
          `You have reserved "${title}". You will be notified when it becomes available.`
        );
        setReservations(getReservations());
      } catch (error) {
        console.error("Direct reservation failed:", error);
      }
    }
  };

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top, height: 70 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
        <TouchableOpacity
          onPress={handleBack}
        >
          <Feather
            name="arrow-left"
            size={22}
            color={theme.textPrimary}
          />
        </TouchableOpacity>

        <Text style={[styles.logo, { color: theme.textPrimary }]}>
          BOOKHIVE
        </Text>

        <TouchableOpacity onPress={toggleFav}>
          <Ionicons
            name={isFav ? "bookmark" : "bookmark-outline"}
            size={22}
            color="#FFD700"
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={{
          paddingBottom: 50,
        }}
      >
        {/* BOOK CARD */}
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.bookTitle, { color: theme.textPrimary }]}
              >
                {title.toUpperCase()}
              </Text>

              <Text style={[styles.author, { color: theme.textSecondary }]}>
                {author}
              </Text>
            </View>

            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <View
                style={
                  styles.availableBadge
                }
              >
                <View
                  style={styles.greenDot}
                />

                <Text
                  style={
                    styles.availableText
                  }
                >
                  {available ? 'Available' : 'Currently Unavailable'}
                </Text>
              </View>

              {params.matchPercent !== undefined && Number(params.matchPercent) > 0 && (
                <View style={styles.matchBadge}>
                  <Text style={styles.matchText}>
                    {params.matchPercent}% MATCH
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* RATING */}
          <View style={styles.ratingRow}>
            <Ionicons
              name="star"
              size={18}
              color="#FACC15"
            />

            <Text
              style={[styles.ratingText, { color: theme.textPrimary }]}
            >
              {rating}
            </Text>

            <Text
              style={[styles.reviewText, { color: theme.textSecondary }]}
            >
              ({reviews} reviews)
            </Text>
          </View>

          {/* INFO GRID */}
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text
                style={[styles.infoLabel, { color: theme.textSecondary }]}
              >
                GENRE
              </Text>

              <Text
                style={[styles.infoValue, { color: theme.textPrimary }]}
              >
                {category}
              </Text>
            </View>

            <View style={styles.infoItem}>
              <Text
                style={[styles.infoLabel, { color: theme.textSecondary }]}
              >
                YEAR
              </Text>

              <Text
                style={[styles.infoValue, { color: theme.textPrimary }]}
              >
                {year}
              </Text>
            </View>

            <View style={styles.infoItem}>
              <Text
                style={[styles.infoLabel, { color: theme.textSecondary }]}
              >
                PAGES
              </Text>

              <Text
                style={[styles.infoValue, { color: theme.textPrimary }]}
              >
                {pages}
              </Text>
            </View>

            <View style={styles.infoItem}>
              <Text
                style={[styles.infoLabel, { color: theme.textSecondary }]}
              >
                LANG
              </Text>

              <Text
                style={[styles.infoValue, { color: theme.textPrimary }]}
              >
                {language}
              </Text>
            </View>
          </View>

          {/* LOCATION */}
          <View style={[styles.locationBox, { backgroundColor: theme.background, borderColor: theme.cardBorder }]}>
            <View
              style={styles.locationRow}
            >
              <Feather
                name="map-pin"
                size={16}
                color="#64748B"
              />

              <Text
                style={[
                  styles.locationLabel,
                  { color: theme.textSecondary }
                ]}
              >
                SHELF LOCATION
              </Text>
            </View>

            <Text
              style={[styles.locationText, { color: theme.textPrimary }]}
            >
              {shelf}
            </Text>

            <View style={styles.departmentLocationRow}>
              <Text
                style={[styles.locationDetailTitle, { color: theme.textSecondary }]}
              >
                Department Location:
              </Text>
              <Text
                style={[styles.locationDetailText, { color: theme.textPrimary }]}
              >
                {departmentLocation}
              </Text>
            </View>
          </View>

          {/* RESERVE BUTTON */}
          <TouchableOpacity
            style={[
              styles.reserveButton,
              isReserved &&
                (requestStatus === 'Approved' ? styles.approvedButton : styles.pendingButton),
            ]}
            onPress={
              handleReservation
            }
          >
            <Ionicons
              name={
                isReserved
                  ? (requestStatus === 'Approved' ? "checkmark-circle-outline" : "time-outline")
                  : available
                  ? "cart-outline"
                  : "bookmark-outline"
              }
              size={18}
              color={
                isReserved
                  ? (requestStatus === 'Approved' ? "#10B981" : "#F59E0B")
                  : "#FFFFFF"
              }
            />

            <Text
              style={[
                styles.reserveText,
                isReserved && {
                  color: requestStatus === 'Approved' ? "#10B981" : "#F59E0B"
                }
              ]}
            >
              {isReserved
                ? (requestStatus === 'Approved' ? "Active Loan" : "Pending Approval")
                : available
                ? "Borrow Book"
                : "Reserve Book"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ABOUT */}
        <View
          style={styles.aboutContainer}
        >
          <Text
            style={[styles.aboutTitle, { color: theme.textPrimary }]}
          >
            About this book
          </Text>

          <Text
            style={[styles.aboutText, { color: theme.textSecondary }]}
          >
            {isExpanded ? description : (description.length > 250 ? `${description.substring(0, 250)}...` : description)}
          </Text>

          {description.length > 250 && (
            <TouchableOpacity 
              onPress={() => setIsExpanded(!isExpanded)}
              style={styles.readMoreButton}
            >
              <Text style={styles.readMoreText}>
                {isExpanded ? "Read Less" : "Read More"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* CITATION */}
        <View
          style={[styles.citationCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
        >
          <View
            style={
              styles.citationHeader
            }
          >
            <TouchableOpacity
              style={
                styles.citationLeftButton
              }
              onPress={() => setDropdownOpen(true)}
            >
              <MaterialCommunityIcons
                name="format-quote-open"
                size={16}
                color="#FFD700"
              />

              <Text
                style={[
                  styles.citationTitle,
                  { color: theme.textPrimary }
                ]}
              >
                {selectedFormat.label}
              </Text>

              <Ionicons
                name="chevron-down"
                size={14}
                color="#FFD700"
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.copyBtn}
              onPress={
                handleCopyCitation
              }
            >
              <Ionicons
                name="copy-outline"
                size={14}
                color="#FFFFFF"
              />

              <Text
                style={styles.copyText}
              >
                Copy Citation
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={[styles.citationBox, { backgroundColor: theme.background, borderColor: theme.cardBorder }]}
          >
            <Text
              style={[
                styles.citationContent,
                { color: theme.textSecondary }
              ]}
            >
              {selectedFormat.format()}
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={dropdownOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDropdownOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setDropdownOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, maxHeight: "80%" }]}>
                <View style={[styles.modalHeader, { borderBottomColor: theme.cardBorder }]}>
                  <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Select Citation Format</Text>
                  <TouchableOpacity onPress={() => setDropdownOpen(false)}>
                    <Ionicons name="close" size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={true}>
                  {citationFormats.map((item) => {
                    const isSelected = selectedFormat.key === item.key;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        style={[
                          styles.modalOption,
                          isSelected && styles.modalOptionSelected,
                        ]}
                        onPress={() => {
                          setSelectedFormat(item);
                          setDropdownOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.modalOptionText,
                            isSelected ? styles.modalOptionTextSelected : { color: theme.textSecondary },
                          ]}
                        >
                          {item.label}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark" size={18} color="#FFD700" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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
    alignItems: "center",
    justifyContent:
      "space-between",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#111A2E",
  },

  logo: {
    color: "#FCD34D",
    fontWeight: "800",
    fontSize: 18,
    letterSpacing: 1.5,
  },

  card: {
    backgroundColor: "#111A2E",
    margin: 20,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1E293B",
  },

  titleRow: {
    flexDirection: "row",
    justifyContent:
      "space-between",
  },

  bookTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FCD34D",
    flexShrink: 1,
  },

  author: {
    marginTop: 8,
    color: "#94A3B8",
    fontSize: 14,
  },

  availableBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(6, 78, 59, 0.4)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 12,
    borderWidth: 1,
    borderColor: "#059669",
    alignSelf: "flex-start",
  },

  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 10,
    backgroundColor: "#34D399",
    marginRight: 6,
  },

  availableText: {
    color: "#34D399",
    fontWeight: "700",
    fontSize: 12,
  },

  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
  },

  ratingText: {
    marginLeft: 6,
    fontWeight: "700",
    color: "#F8FAFC",
  },

  reviewText: {
    marginLeft: 6,
    color: "#94A3B8",
    fontSize: 13,
  },

  infoGrid: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    marginTop: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#1E293B",
  },

  infoItem: {
    alignItems: "center",
    flex: 1,
  },

  infoLabel: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "700",
  },

  infoValue: {
    color: "#FCD34D",
    fontWeight: "700",
    marginTop: 6,
  },

  locationBox: {
    marginTop: 18,
    backgroundColor: "#080F1E",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1E293B",
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  locationLabel: {
    marginLeft: 6,
    color: "#94A3B8",
    fontWeight: "700",
  },

  locationText: {
    marginTop: 6,
    color: "#38BDF8",
    fontWeight: "700",
  },

  departmentLocationRow: {
    marginTop: 12,
  },

  departmentLocationBlock: {
    marginTop: 14,
  },

  locationDetailTitle: {
    color: "#FCD34D",
    fontWeight: "700",
    marginTop: 12,
    fontSize: 13,
  },

  locationDetailText: {
    marginTop: 6,
    color: "#CBD5E1",
    fontSize: 13,
    lineHeight: 20,
  },

  reserveButton: {
    marginTop: 22,
    backgroundColor: "#D97706",
    height: 54,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F59E0B",
  },

  cancelReserveButton: {
    backgroundColor: "#EF4444",
    borderColor: "#DC2626",
  },

  pendingButton: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "#F59E0B",
  },

  approvedButton: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "#10B981",
  },

  reserveText: {
    color: "#FFFFFF",
    fontWeight: "700",
    marginLeft: 8,
    fontSize: 15,
  },

  aboutContainer: {
    marginHorizontal: 20,
  },

  aboutTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 12,
    color: "#FCD34D",
  },

  aboutText: {
    color: "#CBD5E1",
    lineHeight: 28,
    fontSize: 15,
  },

  readMoreButton: {
    marginTop: 8,
    alignSelf: "flex-start",
  },

  readMoreText: {
    color: "#38BDF8",
    fontWeight: "700",
    fontSize: 13,
  },

  citationCard: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: "#111A2E",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1E293B",
  },

  citationHeader: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "center",
  },

  citationLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  citationTitle: {
    color: "#F8FAFC",
    fontWeight: "700",
    marginLeft: 8,
  },

  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor:
      "rgba(255,255,255,0.05)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1E293B",
  },

  copyText: {
    color: "#FCD34D",
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "600",
  },

  citationBox: {
    marginTop: 16,
    backgroundColor: "#080F1E",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
  },

  citationContent: {
    color: "#CBD5E1",
    lineHeight: 24,
    fontSize: 14,
  },
  matchBadge: {
    backgroundColor: "rgba(252,211,77,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(252,211,77,0.3)",
    alignSelf: "flex-end",
  },
  matchText: {
    color: "#FCD34D",
    fontWeight: "800",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  citationLeftButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "90%",
    backgroundColor: "#111A2E",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
    paddingBottom: 12,
  },
  modalTitle: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "700",
  },
  modalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 4,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
  },
  modalOptionSelected: {
    backgroundColor: "rgba(252, 211, 77, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(252, 211, 77, 0.3)",
  },
  modalOptionText: {
    color: "#CBD5E1",
    fontSize: 14,
    fontWeight: "500",
  },
  modalOptionTextSelected: {
    color: "#FCD34D",
    fontWeight: "600",
  },
});