import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  ActivityIndicator,
  BackHandler,
  Animated,
  Easing,
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
  fetchBookDetailsWithLedger,
} from "../../data/store";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useAuth } from "../../data/AuthContext";

export default function BookDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();
  const { user } = useAuth();

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

  const isbn =
    (params.isbn as string) || "";

  const description =
    (params.description as string) ||
    "No description available.";


  const pubDateRaw =
    (params.publicationDate as string) ||
    (params.publishedDate as string) ||
    (params.year as string) ||
    "2026-09-01";

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return "Sep 1, 2026";
    if (dateStr.includes("-")) {
      const parts = dateStr.split("-");
      if (parts.length >= 3) {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const y = parts[0];
        if (!isNaN(m) && m >= 0 && m < 12) {
          return `${monthNames[m]} ${d}, ${y}`;
        }
      }
    }
    return dateStr;
  };

  const pubDateFormatted = formatDateDisplay(pubDateRaw);
  const year = pubDateRaw.includes("-") ? pubDateRaw.split("-")[0] : String(params.year || "2026");

  const pages =
    (params.pages as string) || "320";

  const languageRaw = (params.language as string) || "EN";
  const language = languageRaw.replace(/[\[\]'"\\]/g, "").trim();

  const categoryRaw = (params.category as string) || "General";
  const category = categoryRaw.replace(/[\[\]'"\\]/g, "").trim();

  const departmentParam =
    (params.department as string) && (params.department as string).toLowerCase() !== "null"
      ? (params.department as string)
      : (params.category as string) || "Circulation";

  const rating =
    (params.rating as string) || "4.8";

  const reviews =
    (params.reviews as string) || "218";

  const shelf =
    (params.shelf as string) ||
    (params.shelfLocation as string) ||
    (params.callNumber as string) ||
    "CIR 101.4 .A01 2026";

  const [reservations, setReservations] =
    useState<ReservationBook[]>(
      getReservations()
    );

  const [isFav, setIsFav] = useState(isBookFavorite(id));
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [liveBookData, setLiveBookData] = useState<any | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadLiveBook() {
      try {
        const live = await fetchBookDetailsWithLedger(id, title, (params.isbn as string) || isbn);
        if (isMounted && live) {
          setLiveBookData(live);
        }
      } catch (err) {
        console.warn("Error loading live book details:", err);
      }
    }
    loadLiveBook();
    return () => {
      isMounted = false;
    };
  }, [id, title, isbn, params.isbn]);

  const activeRequest = reservations.find(
    (book) =>
      book.id === id ||
      (isbn && book.isbn === isbn) ||
      (params.isbn && book.isbn === params.isbn) ||
      (book.title && title && book.title.toLowerCase() === title.toLowerCase())
  );
  const isReserved = !!activeRequest;
  const requestStatus = activeRequest?.status; // 'Approved', 'Pending', 'Upcoming', etc.
  const isReservationWaitlist = isReserved && (activeRequest?.action === 'Reserve' || (activeRequest as any)?.type === 'Reservation') && requestStatus !== 'Completed' && requestStatus !== 'Cancelled';
  
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getHoldCountdown = () => {
    if (!activeRequest?.expiresAt) {
      return { text: "24h 00m remaining", isUrgent: false, isExpired: false };
    }
    const diff = new Date(activeRequest.expiresAt).getTime() - now;
    if (diff <= 0) {
      return { text: "Expired (Voided)", isUrgent: true, isExpired: true };
    }
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    const text = `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
    return { text, isUrgent: diff < 2 * 60 * 60 * 1000, isExpired: false };
  };
  
  // Check if current user is borrower either via local reservations or via backend live active loan
  const isMyActiveLoan =
    (isReserved && !isReservationWaitlist && requestStatus === 'Approved') ||
    (liveBookData?.activeLoan && (
      (user?.studentId && liveBookData.activeLoan.studentId === user.studentId) ||
      (user?.id && liveBookData.activeLoan.userId === user.id) ||
      (user?.fullName && liveBookData.activeLoan.borrowerName?.toLowerCase() === user.fullName.toLowerCase())
    ));

  const isApprovedLoan = isMyActiveLoan;
  const isPendingBorrowApproval = isReserved && !isReservationWaitlist && requestStatus !== 'Approved' && requestStatus !== 'Completed';

  const isBorrowedByOther =
    !isMyActiveLoan &&
    ((liveBookData?.borrowedCount !== undefined ? liveBookData.borrowedCount > 0 : false) || !!liveBookData?.activeLoan);

  const rawStatus = (params.status as string) || "";
  const rawAvailable = (params.available as string) || "";

  const volume = (params.volume as string) || "Single Volume / None";
  const edition = (params.edition as string) || "Single Edition / None";
  const rawCopies =
    liveBookData?.copies !== undefined && liveBookData.copies !== null
      ? Number(liveBookData.copies)
      : (params.copies !== undefined && params.copies !== null && params.copies !== "" ? Number(params.copies) : undefined);
  const copies = rawCopies !== undefined && !isNaN(rawCopies) ? rawCopies : 1;
  const totalCopies = Math.max(1, copies);
  const accessionNumber =
    liveBookData?.accessionNumber ||
    (params.accessionNumber as string) ||
    (params.accession as string) ||
    `ACC-${year}-${String(Math.abs((title.length * 37 + (author.length || 5) * 19 + totalCopies * 13) % 89000) + 10000).padStart(5, "0")}`;

  // Copies distribution aligned with backend and web system
  const unavailableCopies = liveBookData?.borrowedCount !== undefined
    ? Math.min(totalCopies, Math.max(Number(liveBookData.borrowedCount), isApprovedLoan ? 1 : 0))
    : (isApprovedLoan ? 1 : ((rawStatus.toLowerCase() === "unavailable" || rawAvailable === "false" || rawAvailable.toLowerCase() === "unavailable") ? totalCopies : 0));

  const reservedCopies = liveBookData?.reservedCount !== undefined
    ? Math.min(totalCopies - unavailableCopies, Math.max(Number(liveBookData.reservedCount), (isPendingBorrowApproval || isReservationWaitlist) ? 1 : 0))
    : ((isPendingBorrowApproval || isReservationWaitlist || rawStatus.toLowerCase() === "reserved" || rawAvailable.toLowerCase() === "reserved") ? Math.min(1, Math.max(0, totalCopies - unavailableCopies)) : 0);

  const availableCopies = liveBookData?.availableCopies !== undefined
    ? Math.min(totalCopies, Math.max(0, Number(liveBookData.availableCopies)))
    : Math.max(0, totalCopies - unavailableCopies - reservedCopies);

  // Book is available as long as physical copies are available for checkout
  const isAvailable = availableCopies > 0;

  const hasAvailableCopyForReserved = isReservationWaitlist && availableCopies > 0;

  const percentAvailable = Math.round((availableCopies / totalCopies) * 100);
  const percentReserved = Math.round((reservedCopies / totalCopies) * 100);
  const percentUnavailable = Math.round((unavailableCopies / totalCopies) * 100);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const badgeScaleAnim = useRef(new Animated.Value(0.85)).current;
  const badgeOpacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 700,
        delay: 150,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.spring(badgeScaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 120,
        delay: 100,
        useNativeDriver: true,
      }),
      Animated.timing(badgeOpacityAnim, {
        toValue: 1,
        duration: 250,
        delay: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const animatedAvailWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", `${percentAvailable}%`],
  });
  const animatedResWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", `${percentReserved}%`],
  });
  const animatedUnavailWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", `${percentUnavailable}%`],
  });

  const getStatusBadgeStyle = () => {
    if (availableCopies > 0) {
      return {
        label: "Available",
        dot: "#22C55E",
        border: "#22C55E",
        bg: "rgba(34, 197, 94, 0.15)",
        text: "#22C55E",
      };
    }
    if (reservedCopies > 0) {
      return {
        label: "Reserved",
        dot: "#F97316",
        border: "#F97316",
        bg: "rgba(249, 115, 22, 0.15)",
        text: "#F97316",
      };
    }
    return {
      label: "Currently Unavailable",
      dot: "#EF4444",
      border: "#EF4444",
      bg: "rgba(239, 68, 68, 0.15)",
      text: "#EF4444",
    };
  };

  const badgeStyle = getStatusBadgeStyle();


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
      available: String(isAvailable),
      rating,
      reviews,
    };
    saveBookToViewHistory(currentBookObj);

    const unsubscribe = subscribe(() => {
      setReservations(getReservations());
      setIsFav(isBookFavorite(id));
    });

    return unsubscribe;
  }, [hasBookDetails, router, id, isAvailable]);

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
      available: String(isAvailable),
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

  const handleBack = useCallback(() => {
    if (params.from === "search") {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)/search");
      }
      return;
    }

    if (params.from === "books") {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)/books");
      }
      return;
    }

    if (params.from === "reservations") {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)/reservations");
      }
      return;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  }, [params.from, router]);

  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };

    const backSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );

    return () => backSubscription.remove();
  }, [handleBack]);

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
    if (isSubmitting) return;

    const profile = getStudentProfile();
    const studentDept = user?.course || user?.department || profile?.course || profile?.department || 'BS in Information Technology';

    if (isAvailable) {
      router.push({
        pathname: '/borrow',
        params: {
          title,
          author,
          isbn: (params.isbn as string) || '',
          department: studentDept,
          action: 'Borrow',
        },
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const reservationDate = new Date();
      const formattedResDate = reservationDate.toISOString().replace('T', ' ').substring(0, 16);

      const profile = getStudentProfile();

      await addReservation({
        id: id,
        title: title,
        author: author,
        isbn: (params.isbn as string) || '',
        category: category,
        pickupDate: formattedResDate,
        status: 'Pending',
        action: 'Reserve',
        studentName: user?.fullName || profile?.name || 'Student',
        studentId: user?.studentId || profile?.studentId || '653705',
        department: studentDept,
      });

      Alert.alert(
        "Book Reserved (Waitlisted)",
        `You have joined the waitlist for "${title}". As soon as a copy becomes available, the system will automatically notify you so you can borrow it.`
      );
      setReservations(getReservations());
    } catch (error) {
      console.error("Direct reservation failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const detailBoxBg = isDarkMode ? "rgba(255, 214, 0, 0.12)" : "#FFF300";
  const detailBoxBorder = isDarkMode ? "rgba(255, 214, 0, 0.2)" : "#FFF300";
  const detailBoxIconColor = isDarkMode ? "#FFD700" : "#0274BB";

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top, height: 70 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Feather
            name="arrow-left"
            size={22}
            color={isDarkMode ? theme.accentGold : theme.accentBlue}
          />
        </TouchableOpacity>

        <Text style={[styles.logo, { color: isDarkMode ? theme.accentGold : theme.accentBlue }]}>
          BOOKHIVE
        </Text>

        <TouchableOpacity onPress={toggleFav} activeOpacity={0.7}>
          <View style={!isDarkMode ? { backgroundColor: "#FFF300", borderRadius: 8, padding: 5 } : undefined}>
            <Ionicons
              name={isFav ? "bookmark" : "bookmark-outline"}
              size={20}
              color={isDarkMode ? "#FFD700" : "#0274BB"}
            />
          </View>
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
              <Animated.View
                style={[
                  styles.availableBadge,
                  {
                    backgroundColor: badgeStyle.bg,
                    borderColor: badgeStyle.border,
                    opacity: badgeOpacityAnim,
                    transform: [{ scale: badgeScaleAnim }],
                  },
                ]}
              >
                <View
                  style={[styles.statusDot, { backgroundColor: badgeStyle.dot }]}
                />

                <Text
                  style={[
                    styles.availableText,
                    { color: badgeStyle.text },
                  ]}
                >
                  {badgeStyle.label}
                </Text>
              </Animated.View>

              {/* Active Loan status badge moved below Currently Unavailable */}
              {isApprovedLoan && (
                <View style={styles.topActiveLoanBadge}>
                  <Ionicons name="checkmark-circle-outline" size={13} color="#10B981" style={{ marginRight: 4 }} />
                  <Text style={styles.topActiveLoanText}>Active Loan</Text>
                </View>
              )}

              {/* Pending Borrow Approval Badge */}
              {isPendingBorrowApproval && (
                <View style={styles.topPendingApprovalBadge}>
                  <Ionicons name="time-outline" size={13} color="#F59E0B" style={{ marginRight: 4 }} />
                  <Text style={styles.topPendingApprovalText}>Pending Borrow Approval</Text>
                </View>
              )}

              {/* Reservation Waitlist Badge */}
              {isReservationWaitlist && !hasAvailableCopyForReserved && (
                <View style={[styles.topPendingApprovalBadge, { borderColor: "#A855F7", backgroundColor: "rgba(168, 85, 247, 0.15)" }]}>
                  <Ionicons name="bookmark-outline" size={13} color="#A855F7" style={{ marginRight: 4 }} />
                  <Text style={[styles.topPendingApprovalText, { color: "#C084FC" }]}>Waitlisted (Queue #{activeRequest?.queuePosition || 1})</Text>
                </View>
              )}

              {/* Reservation Ready Badge */}
              {isReservationWaitlist && hasAvailableCopyForReserved && (
                <View style={[styles.topActiveLoanBadge, { borderColor: "#10B981", backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                  <Ionicons name="checkmark-circle-outline" size={13} color="#10B981" style={{ marginRight: 4 }} />
                  <Text style={[styles.topActiveLoanText, { color: "#34D399" }]}>1 Copy Available to Borrow!</Text>
                </View>
              )}

              {params.matchPercent !== undefined && Number(params.matchPercent) > 0 && (
                <View style={styles.matchBadge}>
                  <Text style={styles.matchText}>
                    {params.matchPercent}% MATCH
                  </Text>
                </View>
              )}
            </View>

          </View>


          {/* COPY INVENTORY & AVAILABILITY */}
          <View style={[styles.inventoryBox, { backgroundColor: isDarkMode ? "#0A1322" : "#F8FAFC", borderColor: isDarkMode ? "rgba(255, 214, 0, 0.2)" : theme.cardBorder }]}>
            <View style={styles.inventoryHeader}>
              <View style={styles.inventoryHeaderLeft}>
                <View style={[styles.inventoryHeaderIcon, !isDarkMode && { backgroundColor: "#FFF300", borderColor: "#FFF300" }]}>
                  <Ionicons name="book" size={13} color={isDarkMode ? "#FFD700" : "#0274BB"} />
                </View>
                <Text style={[styles.inventoryHeaderText, { color: isDarkMode ? "#FFD700" : theme.accentBlue }]}>COPY INVENTORY & AVAILABILITY</Text>
              </View>
              <View style={[styles.inventoryHeaderBadge, { backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.06)" : "#FFF300", borderColor: isDarkMode ? theme.cardBorder : "#FFF300" }]}>
                <Text style={[styles.inventoryHeaderRightText, { color: isDarkMode ? "rgba(255, 255, 255, 0.9)" : "#0274BB", fontWeight: "800" }]}>
                  {availableCopies} of {totalCopies} Available
                </Text>
              </View>
            </View>

            {/* 4-metric cards */}
            <View style={styles.inventoryCardsRow}>
              <View style={[styles.inventoryCardPhysical, { backgroundColor: isDarkMode ? "rgba(0, 0, 0, 0.3)" : "#FFFFFF", borderColor: theme.cardBorder }]}>
                <Text style={styles.invCardLabelSlate}>TOTAL PHYSICAL</Text>
                <Text style={[styles.invCardValueWhite, { color: theme.textPrimary }]}>{totalCopies}</Text>
                <Text style={styles.invCardSubSlate}>In System</Text>
              </View>

              <View style={styles.inventoryCardAvail}>
                <Text style={styles.invCardLabelEmerald}>AVAILABLE</Text>
                <Text style={styles.invCardValueEmerald}>{availableCopies}</Text>
                <Text style={styles.invCardSubEmerald}>For Checkout</Text>
              </View>

              <View style={styles.inventoryCardRes}>
                <Text style={styles.invCardLabelAmber}>RESERVED</Text>
                <Text style={styles.invCardValueAmber}>{reservedCopies}</Text>
                <Text style={styles.invCardSubAmber}>Pending Holds</Text>
              </View>

              <View style={styles.inventoryCardLoan}>
                <Text style={styles.invCardLabelRose}>ON LOAN</Text>
                <Text style={styles.invCardValueRose}>{unavailableCopies}</Text>
                <Text style={styles.invCardSubRose}>Borrowed</Text>
              </View>
            </View>

            {/* Stock Allocation Progress Bar */}
            <View style={styles.allocationRow}>
              <Text style={styles.allocationLabel}>Stock Allocation</Text>
              <Text style={styles.allocationValue}>{percentAvailable}% In Circulation Ready</Text>
            </View>
            <View style={styles.progressBarTrack}>
              {availableCopies > 0 && (
                <Animated.View style={[styles.progressSegmentEmerald, { width: animatedAvailWidth }]} />
              )}
              {reservedCopies > 0 && (
                <Animated.View style={[styles.progressSegmentAmber, { width: animatedResWidth }]} />
              )}
              {unavailableCopies > 0 && (
                <Animated.View style={[styles.progressSegmentRose, { width: animatedUnavailWidth }]} />
              )}
            </View>
          </View>

          {/* 8 Detail Cards (2 per row) */}
          <View style={styles.detailGrid}>
            <View style={styles.detailRow}>
              <View style={[styles.detailCard, { backgroundColor: theme.cardBg || "#111C35", borderColor: theme.cardBorder || "#1E2D4A" }]}>
                <View style={[styles.detailIconBox, { backgroundColor: detailBoxBg, borderColor: detailBoxBorder }]}>
                  <Ionicons name="pricetag-outline" size={14} color={detailBoxIconColor} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary || "#94A3B8" }]}>ISBN</Text>
                  <Text style={[styles.detailValue, { color: theme.textPrimary || "#FFFFFF", fontFamily: "monospace" }]} numberOfLines={2}>
                    {isbn || "978-0132350884"}
                  </Text>
                </View>
              </View>

              <View style={[styles.detailCard, { backgroundColor: theme.cardBg || "#111C35", borderColor: theme.cardBorder || "#1E2D4A" }]}>
                <View style={[styles.detailIconBox, { backgroundColor: detailBoxBg, borderColor: detailBoxBorder }]}>
                  <Ionicons name="information-circle-outline" size={14} color={detailBoxIconColor} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary || "#94A3B8" }]}>DEPARTMENT</Text>
                  <Text style={[styles.detailValue, { color: theme.textPrimary || "#FFFFFF" }]} numberOfLines={2}>
                    {departmentParam || "Circulation"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={[styles.detailCard, { backgroundColor: theme.cardBg || "#111C35", borderColor: theme.cardBorder || "#1E2D4A" }]}>
                <View style={[styles.detailIconBox, { backgroundColor: detailBoxBg, borderColor: detailBoxBorder }]}>
                  <Ionicons name="bookmark-outline" size={14} color={detailBoxIconColor} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary || "#94A3B8" }]}>GENRE</Text>
                  <Text style={[styles.detailValue, { color: theme.textPrimary || "#FFFFFF" }]} numberOfLines={2}>
                    {category || "General Collection"}
                  </Text>
                </View>
              </View>

              <View style={[styles.detailCard, { backgroundColor: theme.cardBg || "#111C35", borderColor: theme.cardBorder || "#1E2D4A" }]}>
                <View style={[styles.detailIconBox, { backgroundColor: detailBoxBg, borderColor: detailBoxBorder }]}>
                  <Ionicons name="time-outline" size={14} color={detailBoxIconColor} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary || "#94A3B8" }]}>CALL NUMBER</Text>
                  <Text style={[styles.detailValue, { color: theme.textPrimary || "#FFFFFF", fontFamily: "monospace" }]} numberOfLines={2}>
                    {shelf || "CIR 101.4 .A01 2026"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={[styles.detailCard, { backgroundColor: theme.cardBg || "#111C35", borderColor: theme.cardBorder || "#1E2D4A" }]}>
                <View style={[styles.detailIconBox, { backgroundColor: detailBoxBg, borderColor: detailBoxBorder }]}>
                  <Ionicons name="calendar-outline" size={14} color={detailBoxIconColor} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary || "#94A3B8" }]}>PUB. DATE</Text>
                  <Text style={[styles.detailValue, { color: theme.textPrimary || "#FFFFFF" }]} numberOfLines={2}>
                    {pubDateFormatted || year || "Sep 1, 2026"}
                  </Text>
                </View>
              </View>

              <View style={[styles.detailCard, { backgroundColor: theme.cardBg || "#111C35", borderColor: theme.cardBorder || "#1E2D4A" }]}>
                <View style={[styles.detailIconBox, { backgroundColor: detailBoxBg, borderColor: detailBoxBorder }]}>
                  <Ionicons name="globe-outline" size={14} color={detailBoxIconColor} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary || "#94A3B8" }]}>LANGUAGE</Text>
                  <Text style={[styles.detailValue, { color: theme.textPrimary || "#FFFFFF" }]} numberOfLines={2}>
                    {language || "English"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={[styles.detailCard, { backgroundColor: theme.cardBg || "#111C35", borderColor: theme.cardBorder || "#1E2D4A" }]}>
                <View style={[styles.detailIconBox, { backgroundColor: detailBoxBg, borderColor: detailBoxBorder }]}>
                  <Ionicons name="layers-outline" size={14} color={detailBoxIconColor} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary || "#94A3B8" }]}>VOLUME</Text>
                  <Text style={[styles.detailValue, { color: theme.textPrimary || "#FFFFFF" }]} numberOfLines={2}>
                    {volume || "Single Volume / None"}
                  </Text>
                </View>
              </View>

              <View style={[styles.detailCard, { backgroundColor: theme.cardBg || "#111C35", borderColor: theme.cardBorder || "#1E2D4A" }]}>
                <View style={[styles.detailIconBox, { backgroundColor: detailBoxBg, borderColor: detailBoxBorder }]}>
                  <Ionicons name="book-outline" size={14} color={detailBoxIconColor} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary || "#94A3B8" }]}>EDITION</Text>
                  <Text style={[styles.detailValue, { color: theme.textPrimary || "#FFFFFF" }]} numberOfLines={2}>
                    {edition || "Single Edition / None"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={[styles.detailCard, { backgroundColor: theme.cardBg || "#111C35", borderColor: theme.cardBorder || "#1E2D4A" }]}>
                <View style={[styles.detailIconBox, { backgroundColor: detailBoxBg, borderColor: detailBoxBorder }]}>
                  <Ionicons name="copy-outline" size={14} color={detailBoxIconColor} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary || "#94A3B8" }]}>COPIES IN SYSTEM</Text>
                  <Text style={[styles.detailValue, { color: theme.textPrimary || "#FFFFFF" }]} numberOfLines={2}>
                    {String(totalCopies)}
                  </Text>
                </View>
              </View>

              <View style={[styles.detailCard, { backgroundColor: theme.cardBg || "#111C35", borderColor: theme.cardBorder || "#1E2D4A" }]}>
                <View style={[styles.detailIconBox, { backgroundColor: detailBoxBg, borderColor: detailBoxBorder }]}>
                  <Ionicons name="sparkles-outline" size={14} color={detailBoxIconColor} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary || "#94A3B8" }]}>ACCESSION NO.</Text>
                  <Text style={[styles.detailValue, { color: theme.textPrimary || "#FFFFFF", fontFamily: "monospace" }]} numberOfLines={2}>
                    {accessionNumber}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* BOOK CARD (Physical Library Checkout Ledger Card) */}
          <View style={[
            styles.bookCardContainer,
            {
              backgroundColor: isDarkMode ? "#0A1322" : "#F8FAFC",
              borderColor: theme.cardBorder,
            },
          ]}>
            {/* Header: BOOK CARD */}
            <View style={[
              styles.bookCardHeader,
              {
                backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.03)" : "rgba(2, 116, 187, 0.04)",
                borderBottomColor: theme.cardBorder,
              },
            ]}>
              <Text style={[styles.bookCardHeaderText, { color: isDarkMode ? "#FFFFFF" : theme.accentBlue }]}>BOOK CARD</Text>
            </View>

            {/* Subheader: Title of Book */}
            <View style={[
              styles.bookCardTitleRow,
              {
                backgroundColor: isDarkMode ? "rgba(0, 0, 0, 0.2)" : "#FFFFFF",
                borderBottomColor: theme.cardBorder,
              },
            ]}>
              <Text style={[styles.bookCardTitleLabel, { color: theme.textSecondary }]}>Title of Book: </Text>
              <Text style={[styles.bookCardTitleValue, { color: theme.textPrimary }]} numberOfLines={1}>
                {title}
              </Text>
            </View>

            {/* Column Headers */}
            <View style={[
              styles.bookCardTableHead,
              {
                backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.04)" : "rgba(2, 116, 187, 0.03)",
                borderBottomColor: theme.cardBorder,
              },
            ]}>
              <View style={[styles.bookCardColDate, { borderRightColor: theme.cardBorder }]}>
                <Text style={[styles.bookCardColHeadText, { color: theme.textSecondary }]}>Borrow Date:</Text>
              </View>
              <View style={styles.bookCardColName}>
                <Text style={[styles.bookCardColHeadText, { color: theme.textSecondary }]}>Borrower’s Name:</Text>
              </View>
            </View>

            {/* 10 Fixed Ledger Rows */}
            <View style={styles.bookCardRowsWrapper}>
              {Array.from({ length: 10 }).map((_, idx) => {
                const ledgerEntry = liveBookData?.ledger ? liveBookData.ledger[idx] : null;
                const hasLedger = liveBookData?.ledger && liveBookData.ledger.length > 0;
                const isFirstActiveRow = idx === 0 && (isReserved || isApprovedLoan || isBorrowedByOther || !!liveBookData?.activeLoan || hasLedger);

                let borrowDate = "";
                let borrowerName = "";

                if (ledgerEntry) {
                  const rawD = ledgerEntry.dueDate || ledgerEntry.borrowDate;
                  borrowDate = rawD ? rawD.split("T")[0] : "";
                  borrowerName = ledgerEntry.borrowerName || "";
                } else if (isFirstActiveRow) {
                  const source = liveBookData?.activeLoan || activeRequest;
                  const rawD = source?.dueDate || source?.date || (source as any)?.borrowDate;
                  borrowDate = rawD ? String(rawD).split("T")[0] : "2026-09-08";
                  borrowerName = source?.borrowerName || source?.studentName || user?.fullName || "Student Borrower";
                }

                return (
                  <View key={`bookcard-row-${idx}`} style={[styles.bookCardRow, { borderBottomColor: theme.cardBorder }]}>
                    <View style={[styles.bookCardCellDate, { borderRightColor: theme.cardBorder }]}>
                      <Text style={[styles.bookCardCellDateText, { color: theme.textSecondary }]} numberOfLines={1}>
                        {borrowDate || " "}
                      </Text>
                    </View>
                    <View style={styles.bookCardCellName}>
                      <Text style={[styles.bookCardCellNameText, { color: theme.textPrimary }]} numberOfLines={1}>
                        {borrowerName || " "}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>


          {/* MAIN ACTION AREA */}
          {isReservationWaitlist ? (
            hasAvailableCopyForReserved ? (
              <View style={{ gap: 10 }}>
                <View style={{
                  padding: 12,
                  borderRadius: 14,
                  backgroundColor: getHoldCountdown().isUrgent ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)",
                  borderWidth: 1.5,
                  borderColor: getHoldCountdown().isUrgent ? "#EF4444" : "#10B981",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}>
                  <Ionicons name="timer-outline" size={24} color={getHoldCountdown().isUrgent ? "#EF4444" : "#10B981"} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: getHoldCountdown().isUrgent ? "#EF4444" : "#10B981" }}>
                      1-Day Claim Timer: {getHoldCountdown().text}
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                      {getHoldCountdown().isExpired
                        ? "The 24-hour pickup window has expired. Reservation is being voided."
                        : "A physical copy is held for you! Claim it before the timer ends or your reservation will be voided."}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.reserveButton,
                    { backgroundColor: getHoldCountdown().isExpired ? "#64748B" : "#10B981" },
                    (isSubmitting || getHoldCountdown().isExpired) && { opacity: 0.6 },
                  ]}
                  disabled={isSubmitting || getHoldCountdown().isExpired}
                  onPress={() => {
                    const profile = getStudentProfile();
                    const studentDept = user?.course || user?.department || profile?.course || profile?.department || 'BS in Information Technology';
                    router.push({
                      pathname: '/borrow',
                      params: {
                        title,
                        author,
                        isbn: (params.isbn as string) || '',
                        department: studentDept,
                        action: 'Borrow',
                      },
                    });
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="cart-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.reserveText}>Borrow Book (Copy Available!)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.cancelReservationSolidBtn,
                    isSubmitting && { opacity: 0.6 },
                  ]}
                  disabled={isSubmitting}
                  onPress={() => setCancelModalVisible(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="close-circle-outline" size={19} color="#FFFFFF" />
                  <Text style={styles.cancelReservationSolidBtnText}>Cancel Reservation</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.cancelReservationSolidBtn,
                  isSubmitting && { opacity: 0.6 },
                ]}
                disabled={isSubmitting}
                onPress={() => setCancelModalVisible(true)}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={19} color="#FFFFFF" />
                    <Text style={styles.cancelReservationSolidBtnText}>
                      Cancel Reservation (In Waitlist)
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )
          ) : isReserved ? (
            <TouchableOpacity
              style={[
                styles.cancelReservationSolidBtn,
                isSubmitting && { opacity: 0.6 },
              ]}
              disabled={isSubmitting}
              onPress={() => setCancelModalVisible(true)}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={19} color="#FFFFFF" />
                  <Text style={styles.cancelReservationSolidBtnText}>
                    {isApprovedLoan ? "Cancel Loan" : "Cancel Borrow Request"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.reserveButton,
                !isDarkMode && {
                  backgroundColor: "#FFF300",
                  borderColor: "rgba(2, 116, 187, 0.25)",
                },
                isSubmitting && { opacity: 0.6 },
              ]}
              disabled={isSubmitting}
              onPress={handleReservation}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={isDarkMode ? "#FFFFFF" : "#0274BB"} />
              ) : (
                <>
                  <Ionicons
                    name={isAvailable ? "cart-outline" : "bookmark-outline"}
                    size={18}
                    color={isDarkMode ? "#FFFFFF" : "#0274BB"}
                  />
                  <Text style={[styles.reserveText, !isDarkMode && { color: "#0274BB", fontWeight: "800" }]}>
                    {isAvailable ? "Borrow Book" : "Reserve Book (Waitlist)"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

        </View>

        {/* ABOUT */}
        <View
          style={styles.aboutContainer}
        >
          <Text
            style={[styles.aboutTitle, { color: theme.sectionTitle }]}
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
              <Text style={[styles.readMoreText, { color: isDarkMode ? "#38BDF8" : theme.accentBlue }]}>
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
                color={isDarkMode ? theme.accentGold : theme.accentBlue}
              />

              <Text
                style={[
                  styles.citationTitle,
                  { color: theme.sectionTitle }
                ]}
              >
                {selectedFormat.label}
              </Text>

              <Ionicons
                name="chevron-down"
                size={14}
                color={isDarkMode ? theme.accentGold : theme.accentBlue}
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.copyBtn,
                {
                  backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : "#FFF300",
                  borderColor: isDarkMode ? "#1E293B" : "#FFF300",
                }
              ]}
              onPress={
                handleCopyCitation
              }
            >
              <Ionicons
                name="copy-outline"
                size={14}
                color={isDarkMode ? "#FFFFFF" : "#0274BB"}
              />

              <Text
                style={[
                  styles.copyText,
                  { color: isDarkMode ? "#FCD34D" : "#0274BB", fontWeight: "800" }
                ]}
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
                          isSelected && (isDarkMode ? styles.modalOptionSelected : {
                            backgroundColor: "rgba(2, 116, 187, 0.08)",
                            borderWidth: 1,
                            borderColor: "rgba(2, 116, 187, 0.3)",
                          }),
                        ]}
                        onPress={() => {
                          setSelectedFormat(item);
                          setDropdownOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.modalOptionText,
                            isSelected
                              ? (isDarkMode ? styles.modalOptionTextSelected : { color: theme.accentBlue, fontWeight: "700" as const })
                              : { color: theme.textSecondary },
                          ]}
                        >
                          {item.label}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark" size={18} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
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

      {/* CANCEL RESERVATION CONFIRMATION MODAL */}
      <Modal
        visible={cancelModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setCancelModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, maxWidth: 360 }]}>
                <View style={styles.cancelModalIconCircle}>
                  <Ionicons name="alert-circle-outline" size={36} color="#DC2626" />
                </View>

                <Text style={[styles.cancelModalTitle, { color: theme.textPrimary }]}>
                  {isApprovedLoan ? "Cancel Active Loan?" : "Cancel Reservation?"}
                </Text>

                <Text style={[styles.cancelModalSubtitle, { color: theme.textSecondary }]}>
                  {isApprovedLoan
                    ? `Are you sure you want to cancel your active loan for "${title}"? Please ensure the book is returned to the circulation desk.`
                    : `Are you sure you want to cancel your reservation for "${title}"? You will lose your current spot in the queue.`}
                </Text>

                <View style={styles.cancelModalButtonRow}>
                  <TouchableOpacity
                    style={[styles.keepReservationBtn, { borderColor: theme.cardBorder, backgroundColor: theme.background }]}
                    onPress={() => setCancelModalVisible(false)}
                    disabled={isSubmitting}
                  >
                    <Text style={[styles.keepReservationBtnText, { color: theme.textPrimary }]}>
                      Keep Request
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.confirmCancelBtn, isSubmitting && { opacity: 0.6 }]}
                    disabled={isSubmitting}
                    onPress={async () => {
                      setIsSubmitting(true);
                      try {
                        await removeReservation(activeRequest?.id || id);
                        setReservations(getReservations());
                        setCancelModalVisible(false);
                        Alert.alert(
                          isApprovedLoan ? "Loan Cancelled" : "Reservation Cancelled",
                          `Your ${isApprovedLoan ? "loan" : "reservation"} for "${title}" has been successfully cancelled.`
                        );
                      } catch (err) {
                        console.warn("Cancel reservation failed:", err);
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.confirmCancelBtnText}>Yes, Cancel</Text>
                    )}
                  </TouchableOpacity>
                </View>
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
    backgroundColor: "#0B1528",
  },

  header: {
    height: 70,
    backgroundColor: "#0B1528",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },

  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  logo: {
    color: "#FCD34D",
    fontWeight: "800",
    fontSize: 18,
    letterSpacing: 1.5,
  },

  card: {
    backgroundColor: "#111C35",
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: "#1E2D4A",
  },

  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  bookTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
    flexShrink: 1,
  },

  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },

  author: {
    marginTop: 8,
    color: "#94A3B8",
    fontSize: 14,
  },

  availableBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 12,
    borderWidth: 1,
    borderColor: "#EF4444",
    alignSelf: "flex-end",
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
    marginRight: 6,
  },

  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 10,
    backgroundColor: "#22C55E",
    marginRight: 6,
  },

  availableText: {
    color: "#EF4444",
    fontWeight: "700",
    fontSize: 12,
  },

  topActiveLoanBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "#10B981",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    alignSelf: "flex-end",
  },

  topActiveLoanText: {
    color: "#10B981",
    fontWeight: "700",
    fontSize: 11,
  },

  topPendingApprovalBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "#F59E0B",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    alignSelf: "flex-end",
  },

  topPendingApprovalText: {
    color: "#F59E0B",
    fontWeight: "700",
    fontSize: 11,
  },

  cancelReservationSolidBtn: {
    marginTop: 22,
    backgroundColor: "#DC2626",
    height: 54,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#B91C1C",
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },

  cancelReservationSolidBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    marginLeft: 8,
    fontSize: 15,
  },

  activeLoanContainer: {
    marginTop: 22,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    height: 54,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#10B981",
  },

  activeLoanText: {
    color: "#10B981",
    fontWeight: "700",
    marginLeft: 8,
    fontSize: 15,
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

  // Copy Inventory Box
  inventoryBox: {
    marginTop: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 214, 0, 0.2)",
    backgroundColor: "#0A1322",
    padding: 16,
  },
  inventoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  inventoryHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  inventoryHeaderIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: "rgba(255, 214, 0, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  inventoryHeaderText: {
    color: "#FFD700",
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  inventoryHeaderBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  inventoryHeaderRightText: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 10.5,
    fontWeight: "700",
  },
  inventoryCardsRow: {
    flexDirection: "row",
    gap: 6,
  },
  inventoryCardPhysical: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    paddingVertical: 8,
    paddingHorizontal: 3,
    alignItems: "center",
  },
  inventoryCardAvail: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    paddingVertical: 8,
    paddingHorizontal: 3,
    alignItems: "center",
  },
  inventoryCardRes: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    paddingVertical: 8,
    paddingHorizontal: 3,
    alignItems: "center",
  },
  inventoryCardLoan: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.25)",
    backgroundColor: "rgba(244, 63, 94, 0.08)",
    paddingVertical: 8,
    paddingHorizontal: 3,
    alignItems: "center",
  },
  invCardLabelSlate: {
    fontSize: 7.5,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  invCardValueWhite: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FFFFFF",
    marginTop: 2,
  },
  invCardSubSlate: {
    fontSize: 7.5,
    color: "#64748B",
    marginTop: 1,
  },
  invCardLabelEmerald: {
    fontSize: 7.5,
    fontWeight: "800",
    color: "#34D399",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  invCardValueEmerald: {
    fontSize: 15,
    fontWeight: "900",
    color: "#6EE7B7",
    marginTop: 2,
  },
  invCardSubEmerald: {
    fontSize: 7.5,
    color: "#34D399",
    marginTop: 1,
  },
  invCardLabelAmber: {
    fontSize: 7.5,
    fontWeight: "800",
    color: "#FBBF24",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  invCardValueAmber: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FCD34D",
    marginTop: 2,
  },
  invCardSubAmber: {
    fontSize: 7.5,
    color: "#FBBF24",
    marginTop: 1,
  },
  invCardLabelRose: {
    fontSize: 7.5,
    fontWeight: "800",
    color: "#FB7185",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  invCardValueRose: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FDA4AF",
    marginTop: 2,
  },
  invCardSubRose: {
    fontSize: 7.5,
    color: "#FB7185",
    marginTop: 1,
  },
  allocationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 4,
  },
  allocationLabel: {
    fontSize: 9,
    color: "#94A3B8",
    fontWeight: "600",
  },
  allocationValue: {
    fontSize: 9,
    color: "#94A3B8",
    fontWeight: "600",
  },
  progressBarTrack: {
    height: 6,
    width: "100%",
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
    flexDirection: "row",
  },
  progressSegmentEmerald: {
    backgroundColor: "#10B981",
    height: "100%",
  },
  progressSegmentAmber: {
    backgroundColor: "#F59E0B",
    height: "100%",
  },
  progressSegmentRose: {
    backgroundColor: "#F43F5E",
    height: "100%",
  },

  // 8 Detail Grid Cards
  detailGrid: {
    marginTop: 16,
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    gap: 8,
  },
  detailCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
    minHeight: 50,
  },
  detailIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255, 214, 0, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 214, 0, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 8,
    fontWeight: "900",
    color: "rgba(255, 255, 255, 0.45)",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 1,
  },

  // BOOK CARD Styles
  bookCardContainer: {
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "#0A1322",
    overflow: "hidden",
  },
  bookCardHeader: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
  },
  bookCardHeaderText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  bookCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  bookCardTitleLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
  },
  bookCardTitleValue: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "800",
    flex: 1,
  },
  bookCardTableHead: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  bookCardColDate: {
    width: 110,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRightWidth: 1,
    borderRightColor: "rgba(255, 255, 255, 0.08)",
  },
  bookCardColName: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  bookCardColHeadText: {
    color: "#CBD5E1",
    fontSize: 10.5,
    fontWeight: "800",
  },
  bookCardRowsWrapper: {},
  bookCardRow: {
    flexDirection: "row",
    minHeight: 24,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  bookCardCellDate: {
    width: 110,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRightWidth: 1,
    borderRightColor: "rgba(255, 255, 255, 0.04)",
  },
  bookCardCellDateText: {
    color: "#94A3B8",
    fontSize: 10,
    fontFamily: "monospace",
  },
  bookCardCellName: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  bookCardCellNameText: {
    color: "#E2E8F0",
    fontSize: 10.5,
    fontWeight: "600",
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
  cancelModalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(220, 38, 38, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    alignSelf: "center",
  },
  cancelModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  cancelModalSubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 22,
  },
  cancelModalButtonRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  keepReservationBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  keepReservationBtnText: {
    fontWeight: "700",
    fontSize: 14,
  },
  confirmCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#DC2626",
  },
  confirmCancelBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
});