import { getUniqueBookCover } from "../../data/bookCovers";
import { BookCoverImage } from "../../components/BookCoverImage";
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
  Image,
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
  isDueToReturn,
  getActiveBorrowCount,
  getSystemSettings,
  getOverdueBooks,
  syncSystemSettingsWithBackend,
} from "../../data/store";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useAuth } from "../../data/AuthContext";
import { socketService } from "../../services/socketService";

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

    const unsubSocket = socketService.subscribeToTransactionDecided(() => {
      void loadLiveBook();
    });

    return () => {
      isMounted = false;
      unsubSocket();
    };
  }, [id, title, isbn, params.isbn]);

  const matchingRequests = reservations.filter(
    (book) =>
      book.id === id ||
      (isbn && book.isbn === isbn) ||
      (params.isbn && book.isbn === params.isbn) ||
      (book.title && title && book.title.toLowerCase() === title.toLowerCase())
  );

  const activeRequest =
    matchingRequests.find((r) => r.status === 'Approved' || r.status === 'Picked Up' || r.status === 'On Loan') ||
    matchingRequests.find((r) => r.status === 'Pending' || r.status === 'Upcoming' || r.status === 'Waitlisted') ||
    null;

  const isReserved = !!activeRequest;
  const requestStatus = activeRequest?.status; // 'Approved', 'Pending', 'Upcoming', etc.
  const isReservationWaitlist = isReserved && (activeRequest?.action === 'Reserve' || (activeRequest as any)?.type === 'Reservation') && requestStatus !== 'Completed' && requestStatus !== 'Cancelled' && requestStatus !== 'Returned';
  
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
    (isReserved && !isReservationWaitlist && (requestStatus === 'Approved' || requestStatus === 'Picked Up' || requestStatus === 'On Loan')) ||
    Boolean(liveBookData?.activeLoan && (
      (user?.studentId && liveBookData.activeLoan.studentId === user.studentId) ||
      (user?.id && liveBookData.activeLoan.userId === user.id) ||
      (user?.fullName && liveBookData.activeLoan.borrowerName?.toLowerCase() === user.fullName.toLowerCase())
    ));

  const isApprovedLoan = isMyActiveLoan;
  const isPendingBorrowApproval =
    !isApprovedLoan &&
    isReserved &&
    !isReservationWaitlist &&
    (requestStatus === 'Pending' || requestStatus === 'Upcoming');

  const loanDueDate = activeRequest?.dueDate || (liveBookData?.activeLoan as any)?.dueDate;
  const isLoanDue = isApprovedLoan && Boolean(loanDueDate && isDueToReturn(loanDueDate));

  const isBorrowedByOther =
    !isMyActiveLoan &&
    ((liveBookData?.borrowedCount !== undefined ? liveBookData.borrowedCount > 0 : false) || !!liveBookData?.activeLoan);

  const studentIdentifier =
    user?.studentId ||
    user?.qrCode ||
    getStudentProfile()?.studentId ||
    getStudentProfile()?.qrCode ||
    user?.id ||
    "";
  const [systemSettings, setSystemSettings] = useState(() => getSystemSettings());
  const [activeBorrowCount, setActiveBorrowCount] = useState(() => getActiveBorrowCount(studentIdentifier));
  const [overdueBooks, setOverdueBooks] = useState(() => getOverdueBooks(studentIdentifier));

  useEffect(() => {
    void syncSystemSettingsWithBackend();
    const updateBorrowState = () => {
      setSystemSettings(getSystemSettings());
      setActiveBorrowCount(getActiveBorrowCount(studentIdentifier));
      setOverdueBooks(getOverdueBooks(studentIdentifier));
    };
    updateBorrowState();
    const unsub = subscribe(updateBorrowState);
    return unsub;
  }, [studentIdentifier]);

  const borrowLimit = systemSettings.borrowLimit ?? 5;
  const isBorrowLimitReached = activeBorrowCount >= borrowLimit;
  const hasOverdueLoans = overdueBooks.length > 0;

  const rawStatus = (params.status as string) || (params.availability as string) || "";
  const rawAvailable = (params.available as string) || "";

  const volume = (params.volume as string) || "Single Volume / None";
  const edition = (params.edition as string) || "Single Edition / None";
  const rawCopies =
    liveBookData?.totalCopies !== undefined && liveBookData.totalCopies !== null
      ? Number(liveBookData.totalCopies)
      : (liveBookData?.copies !== undefined && liveBookData.copies !== null
          ? Number(liveBookData.copies)
          : (params.copies !== undefined && params.copies !== null && params.copies !== "" ? Number(params.copies) : undefined));
  const copies = rawCopies !== undefined && !isNaN(rawCopies) ? rawCopies : 1;
  const totalCopies = Math.max(1, copies);
  const accessionNumber =
    liveBookData?.accessionNumber ||
    (params.accessionNumber as string) ||
    (params.accession as string) ||
    `ACC-${year}-${String(Math.abs((title.length * 37 + (author.length || 5) * 19 + totalCopies * 13) % 89000) + 10000).padStart(5, "0")}`;

  const publisher =
    liveBookData?.publisher ||
    (params.publisher as string) ||
    "Bloomsbury Publishing";

  const series =
    liveBookData?.series ||
    (params.series as string) ||
    (title.toLowerCase().includes("wayward") ? "Wayward Son Series" : "BookHive Series");

  const rawPrice =
    liveBookData?.price !== undefined && liveBookData?.price !== null
      ? String(liveBookData.price)
      : (params.price as string) || "450.00";

  const displayPrice = String(rawPrice).startsWith("₱")
    ? String(rawPrice)
    : `₱${Number(String(rawPrice).replace(/[^0-9.]/g, "") || "450").toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Copies distribution aligned with backend and web system
  const effectiveBorrowed = Math.max(
    liveBookData?.borrowedCount !== undefined ? Number(liveBookData.borrowedCount) : 0,
    liveBookData?.borrowed_count !== undefined ? Number(liveBookData.borrowed_count) : 0,
    liveBookData?.unavailableCopies !== undefined ? Number(liveBookData.unavailableCopies) : 0,
    params.borrowedCount ? Number(params.borrowedCount) : 0,
    params.borrowed_count ? Number(params.borrowed_count) : 0
  );

  const unavailableCopies = effectiveBorrowed > 0 || liveBookData?.borrowedCount !== undefined || liveBookData?.borrowed_count !== undefined
    ? Math.min(totalCopies, Math.max(effectiveBorrowed, isApprovedLoan ? 1 : 0))
    : (isApprovedLoan ? 1 : ((rawStatus.toLowerCase() === "unavailable" || rawAvailable === "false" || rawAvailable.toLowerCase() === "unavailable") ? totalCopies : 0));

  const reservedCopies = liveBookData?.reservedCount !== undefined
    ? Math.min(totalCopies - unavailableCopies, Math.max(Number(liveBookData.reservedCount), (isPendingBorrowApproval || isReservationWaitlist) ? 1 : 0))
    : ((isPendingBorrowApproval || isReservationWaitlist || rawStatus.toLowerCase() === "reserved" || rawAvailable.toLowerCase() === "reserved") ? Math.min(1, Math.max(0, totalCopies - unavailableCopies)) : (params.reservedCopies ? Number(params.reservedCopies) : (params.reservedCount ? Math.min(totalCopies - unavailableCopies, Number(params.reservedCount)) : 0)));

  const computedAvailableFallback = Math.max(0, totalCopies - unavailableCopies - reservedCopies);

  const availableCopies = liveBookData?.availableCopies !== undefined
    ? Math.min(computedAvailableFallback, Number(liveBookData.availableCopies))
    : (params.availableCopies !== undefined && !isNaN(Number(params.availableCopies)) && Number(params.availableCopies) >= 0
        ? Math.min(computedAvailableFallback, Number(params.availableCopies))
        : (rawStatus.toLowerCase() === "unavailable" || rawAvailable === "false" || rawAvailable.toLowerCase() === "unavailable"
            ? 0
            : computedAvailableFallback));

  // Book is available as long as physical copies are available for checkout
  const isAvailable = availableCopies > 0;

  const nextQuePos = liveBookData?.nextQueuePosition || Math.max(1, Number(liveBookData?.reservedCount || 0) + 1);

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
    if (params.from === "notifications" || String(params.from) === "notifications") {
      router.replace("/notifications");
      return;
    }

    if (params.from === "department" || String(params.from) === "department") {
      const targetDept =
        (params.fromDepartment as string) ||
        (params.department as string) ||
        (params.category as string) ||
        "Circulation";
      router.replace({
        pathname: "/department-books",
        params: { department: targetDept },
      });
      return;
    }

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
  }, [params.from, params.fromDepartment, params.department, params.category, router]);

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
      if (isBorrowLimitReached) {
        Alert.alert(
          'Borrow Limit Reached',
          `You currently have ${activeBorrowCount} books borrowed, reaching the library limit of ${borrowLimit} books. Please return a borrowed book before checking out new titles.`
        );
        return;
      }

      if (hasOverdueLoans) {
        const titles = overdueBooks.map(b => `'${b.title}'`).slice(0, 2).join(', ');
        Alert.alert(
          'Overdue Return Required',
          `You have ${overdueBooks.length} book(s) due or overdue for return (${titles}). Please return overdue books to the library before borrowing new titles.`
        );
        return;
      }

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

    // When all copies are unavailable, the reservation functions as a borrowing form (action: 'Reserve')
    router.push({
      pathname: '/borrow',
      params: {
        title,
        author,
        isbn: (params.isbn as string) || '',
        department: studentDept,
        action: 'Reserve',
      },
    });
  };

  const coverUri =
    (params.coverImage as string) ||
    (params.coverUrl as string) ||
    (params.cover as string) ||
    (params.imageUrl as string) ||
    liveBookData?.coverImage ||
    liveBookData?.coverUrl ||
    liveBookData?.cover ||
    liveBookData?.imageUrl ||
    getUniqueBookCover({ title, author, isbn, id: String(id || "") });

  const palette = getCategoryThemedPalette(category || departmentParam, title, isDarkMode);

  const detailMetadataList = [
    {
      label: "ISBN",
      value: isbn || "9781450755634",
      icon: "barcode-outline",
      isMono: true,
      light: { bg: "#EEF2FF", border: "#C7D2FE", color: "#4F46E5" },
      dark: { bg: "rgba(99, 102, 241, 0.2)", border: "rgba(99, 102, 241, 0.35)", color: "#818CF8" },
    },
    {
      label: "SECTION",
      value: departmentParam || "Circulation",
      icon: "folder-outline",
      isMono: false,
      light: { bg: "#ECFDF5", border: "#A7F3D0", color: "#059669" },
      dark: { bg: "rgba(16, 185, 129, 0.2)", border: "rgba(16, 185, 129, 0.35)", color: "#34D399" },
    },
    {
      label: "CLASSIFICATION",
      value: category || "Fiction",
      icon: "bookmark-outline",
      isMono: false,
      light: { bg: "#F0F9FF", border: "#BAE6FD", color: "#0284C7" },
      dark: { bg: "rgba(2, 132, 199, 0.2)", border: "rgba(2, 132, 199, 0.35)", color: "#38BDF8" },
    },
    {
      label: "CALL NUMBER",
      value: shelf || "CIR-16D.4",
      icon: "compass-outline",
      isMono: true,
      light: { bg: "#FAF5FF", border: "#E9D5FF", color: "#7C3AED" },
      dark: { bg: "rgba(124, 58, 237, 0.2)", border: "rgba(124, 58, 237, 0.35)", color: "#C084FC" },
    },
    {
      label: "PUBLISHER",
      value: publisher || "Bloomsbury Publishing",
      icon: "business-outline",
      isMono: false,
      light: { bg: "#F8FAFC", border: "#CBD5E1", color: "#475569" },
      dark: { bg: "rgba(148, 163, 184, 0.2)", border: "rgba(148, 163, 184, 0.35)", color: "#94A3B8" },
    },
    {
      label: "PUB. DATE",
      value: pubDateFormatted || year || "Jan 1, 2011",
      icon: "calendar-outline",
      isMono: false,
      light: { bg: "#FFF1F2", border: "#FECDD3", color: "#E11D48" },
      dark: { bg: "rgba(225, 29, 72, 0.2)", border: "rgba(225, 29, 72, 0.35)", color: "#FB7185" },
    },
    {
      label: "VOLUME",
      value: volume || "Vol. 1",
      icon: "layers-outline",
      isMono: false,
      light: { bg: "#EFF6FF", border: "#BFDBFE", color: "#2563EB" },
      dark: { bg: "rgba(37, 99, 235, 0.2)", border: "rgba(37, 99, 235, 0.35)", color: "#60A5FA" },
    },
    {
      label: "SERIES",
      value: series || "Wayward Son Chronicles",
      icon: "library-outline",
      isMono: false,
      light: { bg: "#FFFBEB", border: "#FDE68A", color: "#D97706" },
      dark: { bg: "rgba(217, 119, 6, 0.2)", border: "rgba(217, 119, 6, 0.35)", color: "#FBBF24" },
    },
    {
      label: "EDITION",
      value: edition || "1st Edition",
      icon: "ribbon-outline",
      isMono: false,
      light: { bg: "#ECFEFF", border: "#A5F3FC", color: "#0891B2" },
      dark: { bg: "rgba(8, 145, 178, 0.2)", border: "rgba(8, 145, 178, 0.35)", color: "#22D3EE" },
    },
    {
      label: "PRICE (PHP)",
      value: displayPrice || "₱450.00",
      icon: "cash-outline",
      isMono: false,
      light: { bg: "#F0FDF4", border: "#BBF7D0", color: "#16A34A" },
      dark: { bg: "rgba(22, 163, 74, 0.2)", border: "rgba(22, 163, 74, 0.35)", color: "#4ADE80" },
    },
    {
      label: "COPIES IN SYSTEM",
      value: String(totalCopies),
      icon: "copy-outline",
      isMono: false,
      light: { bg: "#F0FDFA", border: "#99F6E4", color: "#0D9488" },
      dark: { bg: "rgba(13, 148, 136, 0.2)", border: "rgba(13, 148, 136, 0.35)", color: "#2DD4BF" },
    },
    {
      label: "ACCESSION NO.",
      value: accessionNumber,
      icon: "sparkles-outline",
      isMono: true,
      light: { bg: "#FDF4FF", border: "#F5D0FE", color: "#C026D3" },
      dark: { bg: "rgba(192, 38, 211, 0.2)", border: "rgba(192, 38, 211, 0.35)", color: "#E879F9" },
    },
  ];

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top, height: 70 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: isDarkMode ? theme.headerBorder : "rgba(2, 116, 187, 0.12)" }]}>
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

        <Text style={[styles.logo, { color: isDarkMode ? theme.accentGold : theme.accentBlue, fontWeight: "900" }]}>
          BOOKHIVE
        </Text>

        <TouchableOpacity onPress={toggleFav} activeOpacity={0.7}>
          <View style={{
            backgroundColor: isDarkMode ? "rgba(255, 215, 0, 0.12)" : "#E0F2FE",
            borderRadius: 10,
            padding: 6,
            borderWidth: 1,
            borderColor: isDarkMode ? "rgba(255, 215, 0, 0.3)" : "rgba(2, 116, 187, 0.25)",
          }}>
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
        <View style={[
          styles.card,
          {
            backgroundColor: theme.cardBg,
            borderColor: theme.cardBorder,
            ...(!isDarkMode && {
              shadowColor: "#0274BB",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 3,
            }),
          }
        ]}>
          {/* HERO BOOK SHOWCASE */}
          <View style={styles.heroShowcaseRow}>
            {/* Left: Book Cover (Real Photo or 3D Digital Cover) */}
            <View style={styles.heroCoverWrapper}>
              <BookCoverImage
                uri={coverUri}
                title={title}
                author={author}
                category={category || departmentParam}
                style={styles.heroCoverImage}
                isHero={true}
              />
            </View>

            {/* Right: Book Meta, Category, Title & Author */}
            <View style={styles.heroMetaCol}>
              <View style={[styles.heroCategoryPill, { backgroundColor: palette.iconBg, borderColor: palette.border }]}>
                <View style={[styles.heroCategoryDot, { backgroundColor: palette.iconColor }]} />
                <Text style={[styles.heroCategoryText, { color: palette.iconColor }]}>
                  {(category || departmentParam || "CIRCULATION").toUpperCase()}
                </Text>
              </View>

              <Text style={[styles.heroTitleText, { color: theme.textPrimary }]} numberOfLines={3}>
                {title}
              </Text>

              <Text style={[styles.heroAuthorText, { color: theme.textSecondary }]} numberOfLines={2}>
                by <Text style={{ fontWeight: "700", color: isDarkMode ? theme.accentGold : "#0274BB" }}>{author}</Text>
              </Text>

              {/* Rating & Review */}
              <View style={styles.heroRatingRow}>
                <Ionicons name="star" size={13} color="#F59E0B" />
                <Text style={[styles.heroRatingScore, { color: theme.textPrimary }]}>{rating}</Text>
                <Text style={[styles.heroRatingCount, { color: theme.textSecondary }]}>({reviews} reviews)</Text>
              </View>
            </View>
          </View>

          {/* STATUS PILLS ROW */}
          <View style={styles.heroStatusPillsRow}>
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
              <View style={[styles.statusDot, { backgroundColor: badgeStyle.dot }]} />
              <Text style={[styles.availableText, { color: badgeStyle.text }]}>
                {badgeStyle.label}
              </Text>
            </Animated.View>

            {isApprovedLoan && (
              <View
                style={[
                  styles.topActiveLoanBadge,
                  isLoanDue && {
                    borderColor: "#EF4444",
                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                  },
                ]}
              >
                <Ionicons
                  name={isLoanDue ? "alert-circle-outline" : "checkmark-circle-outline"}
                  size={13}
                  color={isLoanDue ? "#EF4444" : "#10B981"}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.topActiveLoanText,
                    isLoanDue && { color: "#EF4444" },
                  ]}
                >
                  {isLoanDue ? "Active Loan · Due to Return" : "Active Loan"}
                </Text>
              </View>
            )}

            {isPendingBorrowApproval && (
              <View style={styles.topPendingApprovalBadge}>
                <Ionicons name="time-outline" size={13} color="#F59E0B" style={{ marginRight: 4 }} />
                <Text style={styles.topPendingApprovalText}>Pending Borrow Approval</Text>
              </View>
            )}

            {isReservationWaitlist && !hasAvailableCopyForReserved && (
              <View style={[styles.topPendingApprovalBadge, { borderColor: "#A855F7", backgroundColor: "rgba(168, 85, 247, 0.15)" }]}>
                <Ionicons name="bookmark-outline" size={13} color="#A855F7" style={{ marginRight: 4 }} />
                <Text style={[styles.topPendingApprovalText, { color: "#C084FC" }]}>Waitlisted (Queue #{activeRequest?.queuePosition || 1})</Text>
              </View>
            )}

            {isReservationWaitlist && hasAvailableCopyForReserved && (
              <View style={[styles.topActiveLoanBadge, { borderColor: "#10B981", backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                <Ionicons name="checkmark-circle-outline" size={13} color="#10B981" style={{ marginRight: 4 }} />
                <Text style={[styles.topActiveLoanText, { color: "#34D399" }]}>1 Copy Available to Borrow!</Text>
              </View>
            )}

            {params.matchPercent !== undefined && Number(params.matchPercent) > 0 && (
              <View style={[
                styles.matchBadge,
                !isDarkMode && {
                  backgroundColor: "#E0F2FE",
                  borderColor: "rgba(2, 116, 187, 0.3)",
                }
              ]}>
                <Text style={[styles.matchText, !isDarkMode && { color: "#0274BB" }]}>
                  {params.matchPercent}% MATCH
                </Text>
              </View>
            )}
          </View>

          {/* COPY INVENTORY & AVAILABILITY */}
          <View style={[styles.inventoryBox, { backgroundColor: isDarkMode ? "#0A1322" : "#F0F7FF", borderColor: isDarkMode ? "rgba(255, 214, 0, 0.2)" : "rgba(2, 116, 187, 0.2)" }]}>
            <View style={styles.inventoryHeader}>
              <View style={styles.inventoryHeaderLeft}>
                <View style={[styles.inventoryHeaderIcon, { backgroundColor: isDarkMode ? "rgba(255, 214, 0, 0.15)" : "#E0F2FE", borderColor: isDarkMode ? "rgba(255, 214, 0, 0.3)" : "rgba(2, 116, 187, 0.25)", borderWidth: 1 }]}>
                  <Ionicons name="book" size={13} color={isDarkMode ? "#FFD700" : "#0274BB"} />
                </View>
                <Text style={[styles.inventoryHeaderText, { color: isDarkMode ? "#FFD700" : "#0274BB" }]}>COPY INVENTORY & AVAILABILITY</Text>
              </View>
              <View style={[styles.inventoryHeaderBadge, { backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.06)" : "#E0F2FE", borderColor: isDarkMode ? theme.cardBorder : "rgba(2, 116, 187, 0.25)" }]}>
                <Text style={[styles.inventoryHeaderRightText, { color: isDarkMode ? "rgba(255, 255, 255, 0.9)" : "#0274BB", fontWeight: "800" }]}>
                  {availableCopies} of {totalCopies} Available
                </Text>
              </View>
            </View>

            {/* 4-metric cards with distinctive colors */}
            <View style={styles.inventoryCardsRow}>
              <View style={[styles.inventoryCardPhysical, { backgroundColor: isDarkMode ? "rgba(2, 116, 187, 0.12)" : "#F0F7FF", borderColor: isDarkMode ? "rgba(2, 116, 187, 0.3)" : "#BAE6FD" }]}>
                <Text style={[styles.invCardLabelSlate, { color: "#0274BB" }]}>TOTAL PHYSICAL</Text>
                <Text style={[styles.invCardValueWhite, { color: theme.textPrimary }]}>{totalCopies}</Text>
                <Text style={[styles.invCardSubSlate, { color: isDarkMode ? "#94A3B8" : "#64748B" }]}>In System</Text>
              </View>

              <View style={[styles.inventoryCardAvail, { backgroundColor: isDarkMode ? "rgba(16, 185, 129, 0.12)" : "#ECFDF5", borderColor: isDarkMode ? "rgba(16, 185, 129, 0.3)" : "#A7F3D0" }]}>
                <Text style={[styles.invCardLabelEmerald, { color: "#059669" }]}>AVAILABLE</Text>
                <Text style={[styles.invCardValueEmerald, { color: isDarkMode ? "#34D399" : "#047857" }]}>{availableCopies}</Text>
                <Text style={[styles.invCardSubEmerald, { color: "#10B981" }]}>For Checkout</Text>
              </View>

              <View style={[styles.inventoryCardRes, { backgroundColor: isDarkMode ? "rgba(245, 158, 11, 0.12)" : "#FFFBEB", borderColor: isDarkMode ? "rgba(245, 158, 11, 0.3)" : "#FDE68A" }]}>
                <Text style={[styles.invCardLabelAmber, { color: "#D97706" }]}>RESERVED</Text>
                <Text style={[styles.invCardValueAmber, { color: isDarkMode ? "#FBBF24" : "#B45309" }]}>{reservedCopies}</Text>
                <Text style={[styles.invCardSubAmber, { color: "#F59E0B" }]}>Pending Holds</Text>
              </View>

              <View style={[styles.inventoryCardLoan, { backgroundColor: isDarkMode ? "rgba(239, 68, 68, 0.12)" : "#FFF1F2", borderColor: isDarkMode ? "rgba(239, 68, 68, 0.3)" : "#FECDD3" }]}>
                <Text style={[styles.invCardLabelRose, { color: "#E11D48" }]}>ON LOAN</Text>
                <Text style={[styles.invCardValueRose, { color: isDarkMode ? "#F87171" : "#BE123C" }]}>{unavailableCopies}</Text>
                <Text style={[styles.invCardSubRose, { color: "#EF4444" }]}>Borrowed</Text>
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

          {/* 12 Detail Cards with Rich Themed Accents */}
          <View style={styles.detailGrid}>
            {Array.from({ length: 6 }).map((_, rIdx) => {
              const item1 = detailMetadataList[rIdx * 2];
              const item2 = detailMetadataList[rIdx * 2 + 1];
              const theme1 = isDarkMode ? item1.dark : item1.light;
              const theme2 = isDarkMode ? item2.dark : item2.light;

              return (
                <View key={`detail-row-${rIdx}`} style={styles.detailRow}>
                  {/* Item 1 */}
                  <View style={[styles.detailCard, { backgroundColor: theme.cardBg || "#111C35", borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "#E2E8F0" }]}>
                    <View style={[styles.detailIconBox, { backgroundColor: theme1.bg, borderColor: theme1.border }]}>
                      <Ionicons name={item1.icon as any} size={15} color={theme1.color} />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{item1.label}</Text>
                      <Text style={[styles.detailValue, { color: theme.textPrimary }, item1.isMono && { fontFamily: "monospace" }]} numberOfLines={2}>
                        {item1.value}
                      </Text>
                    </View>
                  </View>

                  {/* Item 2 */}
                  <View style={[styles.detailCard, { backgroundColor: theme.cardBg || "#111C35", borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "#E2E8F0" }]}>
                    <View style={[styles.detailIconBox, { backgroundColor: theme2.bg, borderColor: theme2.border }]}>
                      <Ionicons name={item2.icon as any} size={15} color={theme2.color} />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{item2.label}</Text>
                      <Text style={[styles.detailValue, { color: theme.textPrimary }, item2.isMono && { fontFamily: "monospace" }]} numberOfLines={2}>
                        {item2.value}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {/* BOOK CARD (Physical Library Checkout Ledger Card) */}
          <View style={[
            styles.bookCardContainer,
            {
              backgroundColor: isDarkMode ? "#0A1322" : "#FFFFFF",
              borderColor: isDarkMode ? theme.cardBorder : "rgba(2, 116, 187, 0.2)",
            },
          ]}>
            {/* Header: BOOK CARD */}
            <View style={[
              styles.bookCardHeader,
              {
                backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.03)" : "#E0F2FE",
                borderBottomColor: isDarkMode ? theme.cardBorder : "rgba(2, 116, 187, 0.2)",
              },
            ]}>
              <Text style={[styles.bookCardHeaderText, { color: isDarkMode ? "#FFFFFF" : "#0274BB", fontWeight: "900", letterSpacing: 0.8 }]}>BOOK CARD</Text>
            </View>

            {/* Subheader: Title of Book */}
            <View style={[
              styles.bookCardTitleRow,
              {
                backgroundColor: isDarkMode ? "rgba(0, 0, 0, 0.2)" : "#F8FAFC",
                borderBottomColor: isDarkMode ? theme.cardBorder : "rgba(2, 116, 187, 0.12)",
              },
            ]}>
              <Text style={[styles.bookCardTitleLabel, { color: isDarkMode ? theme.textSecondary : "#0274BB", fontWeight: "700" }]}>Title of Book: </Text>
              <Text style={[styles.bookCardTitleValue, { color: theme.textPrimary }]} numberOfLines={1}>
                {title}
              </Text>
            </View>

            {/* Column Headers */}
            <View style={[
              styles.bookCardTableHead,
              {
                backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.04)" : "#F0F7FF",
                borderBottomColor: isDarkMode ? theme.cardBorder : "rgba(2, 116, 187, 0.15)",
              },
            ]}>
              <View style={[styles.bookCardColDate, { borderRightColor: isDarkMode ? theme.cardBorder : "rgba(2, 116, 187, 0.15)" }]}>
                <Text style={[styles.bookCardColHeadText, { color: isDarkMode ? theme.textSecondary : "#0274BB", fontWeight: "700" }]}>Borrow Date:</Text>
              </View>
              <View style={styles.bookCardColName}>
                <Text style={[styles.bookCardColHeadText, { color: isDarkMode ? theme.textSecondary : "#0274BB", fontWeight: "700" }]}>Borrower’s Name:</Text>
              </View>
            </View>

            {/* 10 Fixed Ledger Rows */}
            <View style={styles.bookCardRowsWrapper}>
              {Array.from({ length: 10 }).map((_, idx) => {
                const ledgerEntry = liveBookData?.ledger ? liveBookData.ledger[idx] : null;
                const hasLedger = Boolean(liveBookData?.ledger && liveBookData.ledger.length > 0);
                const isFirstActiveRow = idx === 0 && !hasLedger && (isApprovedLoan || isBorrowedByOther || !!liveBookData?.activeLoan);

                let borrowDate = "";
                let borrowerName = "";

                if (ledgerEntry) {
                  const rawD = ledgerEntry.borrowDate || ledgerEntry.requestedAt || ledgerEntry.decidedAt || ledgerEntry.date;
                  borrowDate = rawD ? String(rawD).split("T")[0] : "";
                  borrowerName = ledgerEntry.borrowerName || ledgerEntry.studentName || (isMyActiveLoan ? (user?.fullName || "Student Borrower") : "Student Borrower");
                } else if (isFirstActiveRow) {
                  const source = liveBookData?.activeLoan || (isApprovedLoan ? activeRequest : null);
                  const rawD = source?.borrowDate || source?.pickupDate || source?.requestedAt || source?.decidedAt || source?.date;
                  borrowDate = rawD ? String(rawD).split("T")[0] : (isMyActiveLoan ? new Date().toISOString().split("T")[0] : "");
                  borrowerName = source?.borrowerName || source?.studentName || (isMyActiveLoan ? (user?.fullName || "Student Borrower") : "Active Borrower");
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
                    if (isBorrowLimitReached) {
                      Alert.alert(
                        'Borrow Limit Reached',
                        `You currently have ${activeBorrowCount} books borrowed, reaching the library limit of ${borrowLimit} books. Please return a borrowed book before checking out this reserved copy.`
                      );
                      return;
                    }
                    if (hasOverdueLoans) {
                      const titles = overdueBooks.map(b => `'${b.title}'`).slice(0, 2).join(', ');
                      Alert.alert(
                        'Overdue Return Required',
                        `You have ${overdueBooks.length} book(s) due or overdue for return (${titles}). Please return overdue books before checking out this copy.`
                      );
                      return;
                    }
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
              <View style={{ gap: 10 }}>
                <View style={{
                  padding: 12,
                  borderRadius: 14,
                  backgroundColor: isDarkMode ? "rgba(168, 85, 247, 0.12)" : "#F3E8FF",
                  borderWidth: 1.5,
                  borderColor: "#A855F7",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}>
                  <MaterialCommunityIcons name="podium-gold" size={24} color="#A855F7" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: "#A855F7" }}>
                      Reserved: Que #{activeRequest?.queuePosition || 1} in Line
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                      {Number(activeRequest?.queuePosition || 1) === 1
                        ? "You are 1st in the reservation queue! When a copy is returned, you will receive a 24-hour claim window to borrow."
                        : `You are #${activeRequest?.queuePosition || 1} in queue (1st-come, 1st-served). You will advance as earlier loans are returned.`}
                    </Text>
                  </View>
                </View>

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
                        Cancel Reservation (Que #{activeRequest?.queuePosition || 1})
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
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
            <View style={{ gap: 10 }}>
              {!isAvailable && (
                <View style={{
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: isDarkMode ? "rgba(249, 115, 22, 0.12)" : "#FFF7ED",
                  borderWidth: 1,
                  borderColor: "#F97316",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}>
                  <Ionicons name="information-circle-outline" size={22} color="#F97316" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12.5, fontWeight: "800", color: "#F97316" }}>
                      All Copies Unavailable
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                      All copies are currently checked out. You can reserve to join the 1st-come, 1st-served queue (Spot #{nextQuePos}).
                    </Text>
                  </View>
                </View>
              )}

              {isAvailable && isBorrowLimitReached && (
                <View style={{
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: isDarkMode ? "rgba(239, 68, 68, 0.15)" : "#FEE2E2",
                  borderWidth: 1,
                  borderColor: isDarkMode ? "rgba(239, 68, 68, 0.4)" : "#FCA5A5",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}>
                  <Ionicons name="alert-circle" size={22} color={isDarkMode ? "#F87171" : "#DC2626"} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: isDarkMode ? "#F87171" : "#B91C1C" }}>
                      Borrow Limit Reached ({activeBorrowCount}/{borrowLimit})
                    </Text>
                    <Text style={{ fontSize: 11, color: isDarkMode ? "#FCA5A5" : "#991B1B", marginTop: 2, lineHeight: 16 }}>
                      You currently have {activeBorrowCount} books borrowed. Please return your borrowed book(s) before checking out new titles.
                    </Text>
                  </View>
                </View>
              )}

              {isAvailable && !isBorrowLimitReached && hasOverdueLoans && (
                <View style={{
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: isDarkMode ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7",
                  borderWidth: 1,
                  borderColor: isDarkMode ? "rgba(245, 158, 11, 0.4)" : "#FDE68A",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}>
                  <Ionicons name="warning" size={22} color={isDarkMode ? "#FBBF24" : "#D97706"} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: isDarkMode ? "#FBBF24" : "#B45309" }}>
                      Overdue Return Required ({overdueBooks.length})
                    </Text>
                    <Text style={{ fontSize: 11, color: isDarkMode ? "#FDE68A" : "#92400E", marginTop: 2, lineHeight: 16 }}>
                      You have {overdueBooks.length} book(s) due or overdue for return. Please return them to restore borrowing privileges.
                    </Text>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.reserveButton,
                  {
                    backgroundColor: (isAvailable && isBorrowLimitReached)
                      ? (isDarkMode ? "rgba(239, 68, 68, 0.18)" : "#FEE2E2")
                      : (isAvailable && hasOverdueLoans)
                      ? (isDarkMode ? "rgba(245, 158, 11, 0.18)" : "#FEF3C7")
                      : theme.buttonPrimaryBg,
                    borderColor: (isAvailable && isBorrowLimitReached)
                      ? (isDarkMode ? "#EF4444" : "#F87171")
                      : (isAvailable && hasOverdueLoans)
                      ? (isDarkMode ? "#F59E0B" : "#FBBF24")
                      : theme.buttonPrimaryBorder,
                    marginTop: 0,
                  },
                  isSubmitting && { opacity: 0.6 },
                ]}
                disabled={isSubmitting}
                onPress={handleReservation}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
                ) : (
                  <>
                    <Ionicons
                      name={
                        isAvailable
                          ? (isBorrowLimitReached ? "alert-circle" : (hasOverdueLoans ? "warning" : "cart-outline"))
                          : "bookmark-outline"
                      }
                      size={18}
                      color={
                        (isAvailable && isBorrowLimitReached)
                          ? (isDarkMode ? "#F87171" : "#DC2626")
                          : (isAvailable && hasOverdueLoans)
                          ? (isDarkMode ? "#FBBF24" : "#D97706")
                          : theme.buttonPrimaryText
                      }
                    />
                    <Text
                      style={[
                        styles.reserveText,
                        {
                          color: (isAvailable && isBorrowLimitReached)
                            ? (isDarkMode ? "#F87171" : "#DC2626")
                            : (isAvailable && hasOverdueLoans)
                            ? (isDarkMode ? "#FBBF24" : "#D97706")
                            : theme.buttonPrimaryText,
                          fontWeight: "800",
                        },
                      ]}
                    >
                      {isAvailable
                        ? (isBorrowLimitReached
                            ? `Borrow Limit Reached (${activeBorrowCount}/${borrowLimit})`
                            : (hasOverdueLoans
                                ? `Overdue Return Required (${overdueBooks.length})`
                                : "Borrow Book"))
                        : `Reserve Book (Que #${nextQuePos})`}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
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
          style={[
            styles.citationCard,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.cardBorder,
              ...(!isDarkMode && {
                shadowColor: "#0274BB",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
                elevation: 3,
              }),
            }
          ]}
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
                  backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : "#E0F2FE",
                  borderColor: isDarkMode ? "#1E293B" : "rgba(2, 116, 187, 0.25)",
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
    marginHorizontal: 16,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1E2D4A",
  },

  /* HERO SHOWCASE STYLES */
  heroShowcaseRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 12,
  },
  heroCoverWrapper: {
    width: 102,
    height: 142,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
  },
  heroCoverImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  heroCoverFallback: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    padding: 6,
  },
  heroSpine: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  heroSpineCrease: {
    position: "absolute",
    left: 5,
    top: 0,
    bottom: 0,
    width: 2,
  },
  heroRibbon: {
    position: "absolute",
    top: 0,
    right: 8,
    width: 8,
    height: 16,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  heroIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  heroTagChip: {
    position: "absolute",
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  heroTagText: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  heroStiStamp: {
    position: "absolute",
    bottom: 4,
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  heroMetaCol: {
    flex: 1,
    justifyContent: "center",
  },
  heroCategoryPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  heroCategoryDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  heroCategoryText: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  heroTitleText: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21,
    letterSpacing: 0.2,
  },
  heroAuthorText: {
    fontSize: 12.5,
    marginTop: 4,
  },
  heroRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  heroRatingScore: {
    fontSize: 12,
    fontWeight: "800",
  },
  heroRatingCount: {
    fontSize: 11,
  },
  heroStatusPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
    marginTop: 2,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EF4444",
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
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
    gap: 9,
    minHeight: 52,
  },
  detailIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
    marginTop: 2,
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
    backgroundColor: "#FCD400",
    height: 54,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EAB308",
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