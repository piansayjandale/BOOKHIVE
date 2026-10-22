import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  BackHandler,
  Modal,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AnimatedScreen from '../components/AnimatedScreen';
import { useThemeColors } from '../hooks/useThemeColors';
import { getLiveBooks } from '../data/books';
import {
  clearNotifications,
  getNotifications,
  markNotificationRead,
  deleteNotification,
  NotificationItem,
  ReceiptData,
  getOrGenerateReceipt,
  subscribe,
  deduplicateNotifications,
  isDueToReturn,
} from '../data/store';
import QRCode from 'react-native-qrcode-svg';

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();
  const { width: windowWidth } = useWindowDimensions();
  const qrPassSize = Math.min(Math.max(Math.round(windowWidth * 0.64), 220), 260);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'books' | 'updates' | 'general'>('all');
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);
  const [selectedBook, setSelectedBook] = useState<any | null>(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<NotificationItem | null>(null);

  const isReceiptDue = Boolean(selectedReceipt?.returnDate && isDueToReturn(selectedReceipt.returnDate));
  const isReservationReceipt = Boolean(
    selectedReceipt?.isReservation ||
    selectedReceipt?.status?.toLowerCase().includes("reservation") ||
    selectedReceipt?.status?.toLowerCase().includes("queued") ||
    selectedReceipt?.status?.toLowerCase().includes("waitlist") ||
    (selectedReceipt as any)?.action === "Reserve" ||
    (selectedReceipt as any)?.type === "Reservation"
  );
  const isBorrowApproved = Boolean(
    !isReservationReceipt &&
    selectedReceipt &&
    (
      selectedReceipt.status?.toLowerCase() === "approved" ||
      selectedReceipt.status?.toLowerCase() === "ready for pickup" ||
      selectedReceipt.status?.toLowerCase().includes("approved")
    )
  );

  useEffect(() => {
    setNotifications(deduplicateNotifications(getNotifications()));
    return subscribe(() => {
      setNotifications(deduplicateNotifications(getNotifications()));
    });
  }, []);

  useEffect(() => {
    const onBackPress = () => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)");
      }
      return true;
    };

    const backSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );

    return () => backSubscription.remove();
  }, [router]);

  const handleMarkRead = (id: string) => {
    markNotificationRead(id);
    setNotifications(getNotifications());
  };

  const handleDelete = (id: string) => {
    deleteNotification(id);
    setNotifications(getNotifications());
  };

  const handleClearAll = () => {
    clearNotifications();
    setNotifications(getNotifications());
  };

  const resolveBookInfo = (item: NotificationItem) => {
    if (item.bookData && (item.bookData.title || item.bookData.author)) {
      const b = item.bookData;
      return {
        id: b.id || b.isbn || item.id,
        title: b.title || "Book Title",
        author: b.author || "Author",
        description: b.description || b.summary || item.body,
        year: b.year || b.publishedDate || "2024",
        pages: b.pages || 320,
        language: b.language || "EN",
        category: b.category || b.department || "General Catalog",
        available: b.available !== undefined ? String(b.available) : "Available",
        shelf: b.shelf || b.shelfLocation || "Circulation Desk",
        isbn: b.isbn || b.id || "N/A",
      };
    }

    // Try finding in live catalog by title in body or title
    const match = item.body.match(/['"]([^'"]+)['"]/);
    const candidateTitle = match ? match[1] : (item.title.includes("for") ? item.title.split("for")[1].trim() : item.title);
    const liveCatalog = getLiveBooks();
    const found = liveCatalog.find(
      (b) =>
        (b.title && b.title.toLowerCase().trim() === candidateTitle.toLowerCase().trim()) ||
        (b.title && b.title.toLowerCase().includes(candidateTitle.toLowerCase())) ||
        (candidateTitle && candidateTitle.toLowerCase().includes(b.title?.toLowerCase() || ""))
    );
    if (found) {
      return {
        id: found.isbn || found.id,
        title: found.title,
        author: found.author,
        description: found.description || found.summary || item.body,
        year: found.year || "2024",
        pages: found.pages || 300,
        language: (found as any).language || "EN",
        category: found.category || found.department || "General",
        available: String(found.available),
        shelf: found.shelf || found.shelf_location || "Main Stacks",
        isbn: found.isbn || found.id || "N/A",
      };
    }

    return {
      id: item.id,
      title: candidateTitle || item.title,
      author: "Library Collection",
      description: item.body,
      year: "2024",
      pages: 280,
      language: "EN",
      category: "Library Collection",
      available: "Available",
      shelf: "Main Stacks",
      isbn: "N/A",
    };
  };

  const handleOpenBookDetails = (book: any) => {
    setSelectedBook(null);
    router.push({
      pathname: "/book-details",
      params: {
        from: "notifications",
        id: String(book.id || book.isbn || ""),
        title: String(book.title || ""),
        author: String(book.author || ""),
        description: String(book.description || ""),
        year: String(book.year || ""),
        pages: String(book.pages || ""),
        language: String(book.language || "EN"),
        category: String(book.category || ""),
        available: String(book.available ?? "true"),
        shelf: String(book.shelf || ""),
        isbn: String(book.isbn || book.id || ""),
      },
    });
  };

  const handleNotificationPress = (item: NotificationItem) => {
    if (!item.read) {
      handleMarkRead(item.id);
    }

    const titleLower = item.title.toLowerCase();
    const isBookNotif =
      titleLower.includes("added") ||
      titleLower.includes("new book") ||
      (item.type === "general" && Boolean(item.bookData && !titleLower.includes("pickup") && !titleLower.includes("picked up")));

    const isAnnouncementNotif =
      item.type === "announcement" ||
      titleLower.includes("announcement") ||
      titleLower.includes("advisory") ||
      titleLower.includes("bulletin");

    if (isBookNotif) {
      const bookDetails = resolveBookInfo(item);
      setSelectedBook(bookDetails);
      return;
    }

    if (isAnnouncementNotif) {
      setSelectedAnnouncement(item);
      return;
    }

    // Circulation loan or borrow transaction (Borrow Approved, Returned, Due, etc.)
    const receipt = getOrGenerateReceipt(item);
    setSelectedReceipt(receipt);
  };

  const handleViewBookFromReceipt = (receipt: ReceiptData) => {
    setSelectedReceipt(null);

    let bookInfo = receipt.bookData;
    if (!bookInfo) {
      const liveCatalog = getLiveBooks();
      const found = liveCatalog.find(
        (b) =>
          (receipt.isbn && b.isbn === receipt.isbn) ||
          b.title.toLowerCase().trim() === receipt.bookTitle.toLowerCase().trim() ||
          b.title.toLowerCase().includes(receipt.bookTitle.toLowerCase()) ||
          receipt.bookTitle.toLowerCase().includes(b.title.toLowerCase())
      );
      if (found) {
        bookInfo = {
          id: found.isbn,
          title: found.title,
          author: found.author,
          description: found.description || found.summary,
          year: found.year,
          pages: found.pages,
          language: (found as any).language || "EN",
          category: found.category || found.department,
          available: String(found.available),
          shelf: found.shelf || found.shelf_location,
        };
      } else {
        bookInfo = {
          id: receipt.isbn || `notif-${receipt.receiptNumber}`,
          title: receipt.bookTitle,
          author: receipt.author || "Library Collection",
          description: `Circulation and borrow details for "${receipt.bookTitle}".`,
          year: "2024",
          pages: 320,
          language: "EN",
          category: receipt.category || "General",
          available: "false",
          shelf: receipt.shelf || "Circulation Desk",
        };
      }
    }

    router.push({
      pathname: "/book-details",
      params: {
        from: "notifications",
        id: String(bookInfo.id || ""),
        title: String(bookInfo.title || receipt.bookTitle || ""),
        author: String(bookInfo.author || receipt.author || ""),
        description: String(bookInfo.description || ""),
        year: String(bookInfo.year || ""),
        pages: String(bookInfo.pages || ""),
        language: String(bookInfo.language || "EN"),
        category: String(bookInfo.category || receipt.category || ""),
        available: String(bookInfo.available ?? "true"),
        shelf: String(bookInfo.shelf || receipt.shelf || ""),
        isbn: String(bookInfo.id || receipt.isbn || ""),
      },
    });
  };

  // Helper to extract reason/comment from body text
  const parseNotificationBody = (body: string) => {
    if (!body) return { mainText: '', reasonText: null, reasonPrefix: 'Reason' };

    // Match patterns like: "... Reason: <comment>" or "... Note: <comment>" or "... Comment: <comment>"
    const match = body.match(/^(.*?)(?:\.\s*|\s+)(Reason|Note|Comment|Librarian Reason|Librarian Note|Decline Reason|Declined Reason)[\s:]+(.+)$/i);
    if (match && match[3]) {
      let mainText = match[1].trim();
      if (mainText && !mainText.endsWith('.')) {
        mainText += '.';
      }
      return {
        mainText,
        reasonPrefix: match[2].trim(),
        reasonText: match[3].trim(),
      };
    }

    // Match if body starts directly with "Reason: <comment>"
    const startsWithReason = body.match(/^(Reason|Note|Comment|Librarian Reason|Librarian Note|Decline Reason)[\s:]+(.+)$/i);
    if (startsWithReason) {
      return {
        mainText: '',
        reasonPrefix: startsWithReason[1].trim(),
        reasonText: startsWithReason[2].trim(),
      };
    }

    return { mainText: body, reasonText: null, reasonPrefix: 'Reason' };
  };

  const getNotificationConfig = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes("added") || t.includes("new book")) {
      return {
        icon: "book-outline" as const,
        color: isDarkMode ? "#38BDF8" : "#0284C7", // Sky Blue
        bgColor: isDarkMode ? "rgba(56, 189, 248, 0.12)" : "#F0F9FF",
        borderColor: isDarkMode ? "rgba(56, 189, 248, 0.3)" : "#BAE6FD",
        badge: "NEW BOOK",
        badgeBg: isDarkMode ? "rgba(56, 189, 248, 0.15)" : "#E0F2FE",
        badgeText: isDarkMode ? "#38BDF8" : "#0369A1",
        isAlert: false,
      };
    }
    if (t.includes("declined") || t.includes("failed") || t.includes("cancel")) {
      return {
        icon: "close-circle-outline" as const,
        color: isDarkMode ? "#F87171" : "#EF4444", // Rose Red
        bgColor: isDarkMode ? "rgba(248, 113, 113, 0.12)" : "#FEF2F2",
        borderColor: isDarkMode ? "rgba(248, 113, 113, 0.3)" : "#FECACA",
        badge: "ALERT",
        badgeBg: isDarkMode ? "rgba(248, 113, 113, 0.15)" : "#FEE2E2",
        badgeText: isDarkMode ? "#F87171" : "#DC2626",
        isAlert: true,
      };
    }
    if (t.includes("reservation") || t.includes("queued") || t.includes("waitlist")) {
      if (t.includes("ready") || t.includes("available")) {
        return {
          icon: "checkmark-circle-outline" as const,
          color: isDarkMode ? "#34D399" : "#059669", // Emerald Green
          bgColor: isDarkMode ? "rgba(52, 211, 153, 0.12)" : "#ECFDF5",
          borderColor: isDarkMode ? "rgba(52, 211, 153, 0.3)" : "#A7F3D0",
          badge: "READY FOR PICKUP",
          badgeBg: isDarkMode ? "rgba(52, 211, 153, 0.15)" : "#D1FAE5",
          badgeText: isDarkMode ? "#34D399" : "#047857",
          isAlert: false,
        };
      }
      return {
        icon: "bookmark-outline" as const,
        color: isDarkMode ? "#C084FC" : "#7C3AED", // Violet (Matches Library Card Reservation)
        bgColor: isDarkMode ? "rgba(192, 132, 252, 0.12)" : "#F5F3FF",
        borderColor: isDarkMode ? "rgba(192, 132, 252, 0.3)" : "#DDD6FE",
        badge: "QUEUED RESERVATION",
        badgeBg: isDarkMode ? "rgba(192, 132, 252, 0.15)" : "#EDE9FE",
        badgeText: isDarkMode ? "#C084FC" : "#7C3AED",
        isAlert: false,
      };
    }
    if (t.includes("returned") || t.includes("success") || t.includes("approved")) {
      return {
        icon: "checkmark-circle-outline" as const,
        color: isDarkMode ? "#34D399" : "#059669", // Emerald Green
        bgColor: isDarkMode ? "rgba(52, 211, 153, 0.12)" : "#ECFDF5",
        borderColor: isDarkMode ? "rgba(52, 211, 153, 0.3)" : "#A7F3D0",
        badge: "SUCCESS",
        badgeBg: isDarkMode ? "rgba(52, 211, 153, 0.15)" : "#D1FAE5",
        badgeText: isDarkMode ? "#34D399" : "#047857",
        isAlert: false,
      };
    }
    if (t.includes("pending") || t.includes("request")) {
      return {
        icon: "time-outline" as const,
        color: isDarkMode ? "#FCD34D" : "#0274BB", // STI Brand Accent (Pending)
        bgColor: isDarkMode ? "rgba(252, 211, 77, 0.12)" : theme.badgeYellowBg,
        borderColor: isDarkMode ? "rgba(252, 211, 77, 0.3)" : theme.badgeYellowBorder,
        badge: "PENDING",
        badgeBg: isDarkMode ? "rgba(252, 211, 77, 0.15)" : theme.badgeYellowBg,
        badgeText: isDarkMode ? "#FCD34D" : theme.badgeYellowText,
        isAlert: false,
      };
    }
    if (t.includes("due") || t.includes("overdue") || t.includes("deadline")) {
      const isOverdueAlert = t.includes("overdue");
      return {
        icon: isOverdueAlert ? ("alert-circle-outline" as const) : ("calendar-outline" as const),
        color: isDarkMode ? "#EF4444" : "#DC2626", // Red
        bgColor: isDarkMode ? "rgba(239, 68, 68, 0.12)" : "#FEF2F2",
        borderColor: isDarkMode ? "rgba(239, 68, 68, 0.3)" : "#FECACA",
        badge: isOverdueAlert ? "OVERDUE" : "DUE TODAY",
        badgeBg: isDarkMode ? "rgba(239, 68, 68, 0.15)" : "#FEE2E2",
        badgeText: isDarkMode ? "#F87171" : "#DC2626",
        isAlert: true,
      };
    }
    return {
      icon: "sparkles-outline" as const,
      color: isDarkMode ? "#A78BFA" : "#7C3AED", // Purple
      bgColor: isDarkMode ? "rgba(167, 139, 250, 0.12)" : "#F5F3FF",
      borderColor: isDarkMode ? "rgba(167, 139, 250, 0.3)" : "#DDD6FE",
      badge: "GENERAL",
      badgeBg: isDarkMode ? "rgba(167, 139, 250, 0.15)" : "#EDE9FE",
      badgeText: isDarkMode ? "#A78BFA" : "#6D28D9",
      isAlert: false,
    };
  };

  // Helper counts
  const allCount = notifications.length;
  const unreadCount = notifications.filter(n => !n.read).length;
  const booksCount = notifications.filter(n => {
    const titleLower = n.title.toLowerCase();
    return titleLower.includes("added") || titleLower.includes("new book");
  }).length;
  const updatesCount = notifications.filter(n => {
    const titleLower = n.title.toLowerCase();
    return titleLower.includes("returned") || titleLower.includes("success") || 
           titleLower.includes("approved") || titleLower.includes("pending") || 
           titleLower.includes("request") || titleLower.includes("reservation") || 
           titleLower.includes("declined") || titleLower.includes("failed") || 
           titleLower.includes("cancel") || titleLower.includes("due") || 
           titleLower.includes("overdue") || titleLower.includes("deadline");
  }).length;
  const generalCount = notifications.filter(n => {
    const titleLower = n.title.toLowerCase();
    const isBook = titleLower.includes("added") || titleLower.includes("new book");
    const isUpdate = titleLower.includes("returned") || titleLower.includes("success") || 
                     titleLower.includes("approved") || titleLower.includes("pending") || 
                     titleLower.includes("request") || titleLower.includes("reservation") || 
                     titleLower.includes("declined") || titleLower.includes("failed") || 
                     titleLower.includes("cancel") || titleLower.includes("due") || 
                     titleLower.includes("overdue") || titleLower.includes("deadline");
    return !isBook && !isUpdate;
  }).length;

  const filteredNotifications = notifications.filter(item => {
    const textMatch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      item.body.toLowerCase().includes(searchQuery.toLowerCase());
    if (!textMatch) return false;

    const titleLower = item.title.toLowerCase();
    const isBook = titleLower.includes("added") || titleLower.includes("new book");
    const isUpdate = titleLower.includes("returned") || titleLower.includes("success") || 
                     titleLower.includes("approved") || titleLower.includes("pending") || 
                     titleLower.includes("request") || titleLower.includes("reservation") || 
                     titleLower.includes("declined") || titleLower.includes("failed") || 
                     titleLower.includes("cancel") || titleLower.includes("due") || 
                     titleLower.includes("overdue") || titleLower.includes("deadline");
    const isGeneral = !isBook && !isUpdate;

    if (activeTab === 'unread') return !item.read;
    if (activeTab === 'books') return isBook;
    if (activeTab === 'updates') return isUpdate;
    if (activeTab === 'general') return isGeneral;
    return true;
  });

  const tabs = [
    { key: 'all' as const, label: 'All', count: allCount },
    { key: 'unread' as const, label: 'Unread', count: unreadCount },
    { key: 'books' as const, label: 'Books', count: booksCount },
    { key: 'updates' as const, label: 'Updates', count: updatesCount },
    { key: 'general' as const, label: 'General', count: generalCount },
  ];

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      {/* HEADER */}
      <View style={[styles.header, { paddingTop: 12 + insets.top, height: 64 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)");
            }
          }}
        >
          <Ionicons name="arrow-back" size={20} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.headerTitle }]}>
          NOTIFICATIONS {unreadCount > 0 ? `(${unreadCount})` : ''}
        </Text>

        {notifications.length > 0 ? (
          <TouchableOpacity style={[styles.clearBtn, { backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2', borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.25)' : '#FECACA' }]} onPress={handleClearAll}>
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* SEARCH BAR */}
      <View style={styles.searchSection}>
        <View style={[styles.searchContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Ionicons name="search-outline" size={18} color={theme.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search in notifications..."
            placeholderTextColor={isDarkMode ? "#64748B" : "#94A3B8"}
            autoCorrect={false}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClearBtn}>
              <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* CATEGORY TABS */}
      <View style={styles.tabsSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tabButton,
                  {
                    backgroundColor: isActive 
                      ? (isDarkMode ? "rgba(252, 211, 77, 0.15)" : theme.tabBarActivePill) 
                      : theme.cardBg,
                    borderColor: isActive 
                      ? (isDarkMode ? "#FCD34D" : theme.badgeYellowBorder) 
                      : theme.cardBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isActive 
                        ? (isDarkMode ? "#FCD34D" : "#0274BB") 
                        : theme.textSecondary,
                      fontWeight: isActive ? "800" : "600",
                    },
                  ]}
                >
                  {tab.label}
                </Text>
                {tab.count > 0 && (
                  <View
                    style={[
                      styles.tabBadge,
                      {
                        backgroundColor: isActive 
                          ? (isDarkMode ? "#FCD34D" : "#0274BB") 
                          : (isDarkMode ? "#334155" : "#E2E8F0"),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabBadgeText,
                        {
                          color: isActive 
                            ? (isDarkMode ? "#080F1E" : "#FFFFFF") 
                            : (isDarkMode ? "#94A3B8" : "#475569"),
                        },
                      ]}
                    >
                      {tab.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* NOTIFICATIONS LIST */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {filteredNotifications.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={[styles.emptyIconWrapper, { backgroundColor: isDarkMode ? "rgba(252, 211, 77, 0.04)" : "rgba(2, 116, 187, 0.06)", borderColor: theme.cardBorder }]}>
              <Ionicons
                name={searchQuery || activeTab !== 'all' ? "funnel-outline" : "notifications-off-outline"}
                size={40}
                color={isDarkMode ? theme.accentGold : theme.accentBlue}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              {searchQuery || activeTab !== 'all' ? "No results found" : "Quiet in here!"}
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {searchQuery || activeTab !== 'all' 
                ? "Try adjusting your search query or switching filters."
                : "You have no notifications in this category."}
            </Text>
            {(searchQuery || activeTab !== 'all') && (
              <TouchableOpacity
                style={[styles.resetBtn, { backgroundColor: isDarkMode ? "rgba(252, 211, 77, 0.08)" : "rgba(11, 90, 142, 0.08)", borderColor: theme.accentGold }]}
                onPress={() => {
                  setSearchQuery('');
                  setActiveTab('all');
                }}
              >
                <Text style={[styles.resetBtnText, { color: theme.accentGold }]}>Reset Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredNotifications.map((item, index) => {
            const config = getNotificationConfig(item.title);
            const parsed = parseNotificationBody(item.body);

            // Callout styling based on alert type
            const calloutBg = config.isAlert
              ? (isDarkMode ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2')
              : (isDarkMode ? 'rgba(245, 158, 11, 0.12)' : '#FFFBEB');
            const calloutBorder = config.isAlert ? '#EF4444' : '#F59E0B';
            const calloutTextColor = config.isAlert
              ? (isDarkMode ? '#FCA5A5' : '#991B1B')
              : (isDarkMode ? '#FDE047' : '#B45309');
            const calloutIconName = config.isAlert ? "alert-circle" : "chatbubble-ellipses";

            return (
              <TouchableOpacity
                key={`notif-item-${item.id}-${index}`}
                activeOpacity={0.88}
                onPress={() => handleNotificationPress(item)}
                style={[
                  styles.notificationCard,
                  {
                    backgroundColor: theme.cardBg,
                    borderColor: theme.cardBorder,
                    shadowColor: isDarkMode ? "#000000" : "#0F172A",
                  },
                ]}
              >
                {/* Unread Indicator Ribbon / Tint */}
                {!item.read && (
                  <View style={[styles.unreadRibbon, { backgroundColor: config.color }]} />
                )}

                {/* HEADER ROW */}
                <View style={styles.cardHeader}>
                  <View style={styles.iconAndBadgeRow}>
                    <View style={[styles.iconWrapper, { backgroundColor: config.bgColor }]}>
                      <Ionicons
                        name={config.icon}
                        size={16}
                        color={config.color}
                      />
                    </View>
                    <View style={[styles.badgeContainer, { backgroundColor: config.badgeBg }]}>
                      <Text style={[styles.badgeText, { color: config.badgeText }]}>
                        {config.badge}
                      </Text>
                    </View>
                  </View>

                  {/* QUICK ACTION BUTTONS */}
                  <View style={styles.actionRow}>
                    {!item.read && (
                      <TouchableOpacity
                        style={[styles.actionIconButton, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.cardBorder }]}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleMarkRead(item.id);
                        }}
                      >
                        <Ionicons name="checkmark-done" size={15} color="#059669" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* CARD BODY */}
                <View style={styles.cardBody}>
                  {/* TITLE */}
                  <View style={styles.titleRow}>
                    <Text style={[styles.notificationTitle, { color: theme.textPrimary }, item.read && styles.notificationTitleRead]}>
                      {item.title}
                    </Text>
                    {!item.read && (
                      <View style={[styles.unreadDot, { backgroundColor: config.color }]} />
                    )}
                  </View>

                  {/* MAIN DESCRIPTION */}
                  {parsed.mainText ? (
                    <Text style={[styles.notificationBody, { color: isDarkMode ? '#9CA3AF' : '#475569' }, item.read && styles.notificationBodyRead]}>
                      {parsed.mainText}
                    </Text>
                  ) : null}

                  {/* LIBRARIAN COMMENT / REASON CALLOUT BOX */}
                  {parsed.reasonText && (
                    <View style={[styles.reasonContainer, { backgroundColor: calloutBg, borderLeftColor: calloutBorder }]}>
                      <View style={styles.reasonHeaderRow}>
                        <Ionicons name={calloutIconName} size={14} color={calloutBorder} style={{ marginRight: 6 }} />
                        <Text style={[styles.reasonHeaderLabel, { color: calloutBorder }]}>
                          {parsed.reasonPrefix}:
                        </Text>
                      </View>
                      <Text style={[styles.reasonBodyText, { color: calloutTextColor }]}>
                        {parsed.reasonText}
                      </Text>
                    </View>
                  )}

                  {/* TIMESTAMP FOOTER */}
                  <View style={styles.footerRow}>
                    <Ionicons name="time-outline" size={13} color={isDarkMode ? '#64748B' : '#94A3B8'} style={{ marginRight: 4 }} />
                    <Text style={[styles.notificationTime, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>
                      {item.timestamp}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* ── Official Circulation Receipt Modal ── */}
      <Modal
        visible={selectedReceipt !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedReceipt(null)}
      >
        <View style={styles.receiptBackdrop}>
          <View style={[
            styles.receiptCard,
            {
              backgroundColor: isDarkMode ? '#0B1726' : '#FFFFFF',
              borderColor: isDarkMode ? '#1E324A' : '#E2E8F0',
            }
          ]}>
            {/* Top header row */}
            <View style={[
              styles.receiptHeaderRow,
              {
                borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
              }
            ]}>
              <View style={styles.receiptBrandRow}>
                <View style={[styles.receiptLogoBox, { backgroundColor: isDarkMode ? '#FFD166' : '#0274BB' }]}>
                  <Ionicons name="book" size={16} color={isDarkMode ? '#0F1D2B' : '#FFFFFF'} />
                </View>
                <View>
                  <Text style={[styles.receiptBrandTitle, { color: isDarkMode ? '#FFD166' : '#0274BB' }]}>
                    BOOKHIVE
                  </Text>
                  <Text style={[styles.receiptBrandSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                    Official Circulation Desk
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedReceipt(null)}
                style={[styles.receiptCloseBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}
              >
                <Ionicons name="close" size={18} color={isDarkMode ? '#FFFFFF' : '#334155'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Receipt Title & Status Pill */}
              <View style={styles.receiptTitleBlock}>
                <Text style={[styles.receiptDocumentTitle, { color: theme.textPrimary }]}>
                  {isReservationReceipt ? "RESERVATION QUEUE SLIP" : "CIRCULATION LOAN SLIP"}
                </Text>

                {/* Live Status Pill */}
                <View style={[
                  styles.receiptBadge,
                  isReservationReceipt
                    ? { backgroundColor: 'rgba(168, 85, 247, 0.12)', borderColor: 'rgba(168, 85, 247, 0.35)' }
                    : isReceiptDue
                    ? { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.35)' }
                    : { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.35)' }
                ]}>
                  <View style={[
                    styles.receiptStatusDot,
                    { backgroundColor: isReservationReceipt ? '#A855F7' : isReceiptDue ? '#EF4444' : '#10B981' }
                  ]} />
                  <Text style={[
                    styles.receiptBadgeText,
                    { color: isReservationReceipt ? (isDarkMode ? '#C084FC' : '#7C3AED') : isReceiptDue ? '#EF4444' : '#10B981' }
                  ]}>
                    {isReservationReceipt
                      ? `QUEUED RESERVATION (QUE #${selectedReceipt?.queuePosition || '1'})`
                      : isReceiptDue
                      ? "DUE FOR RETURN TODAY"
                      : (selectedReceipt?.status?.toUpperCase() || "ACTIVE LOAN")}
                  </Text>
                </View>

                {/* Monospace Slip Badge */}
                <View style={[styles.slipPillBox, { backgroundColor: isDarkMode ? '#132337' : '#F1F5F9' }]}>
                  <Ionicons name="receipt-outline" size={12} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                  <Text style={[styles.receiptNumberText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
                    Slip No: {selectedReceipt?.receiptNumber}
                  </Text>
                </View>
              </View>

              {/* Perforated Ticket Notches & Divider */}
              <View style={styles.ticketDividerContainer}>
                <View style={[styles.ticketNotchLeft, { backgroundColor: 'rgba(0, 0, 0, 0.75)' }]} />
                <View style={[styles.receiptDashedLine, { borderColor: isDarkMode ? '#1E324A' : '#CBD5E1' }]} />
                <View style={[styles.ticketNotchRight, { backgroundColor: 'rgba(0, 0, 0, 0.75)' }]} />
              </View>

              {/* Book Details Section */}
              <View style={styles.receiptSection}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="book-outline" size={13} color={isDarkMode ? '#38BDF8' : '#0274BB'} />
                  <Text style={[styles.receiptSectionHeader, { color: isDarkMode ? '#38BDF8' : '#0274BB' }]}>
                    BOOK DETAILS
                  </Text>
                </View>

                <View style={[styles.receiptBookCard, { backgroundColor: isDarkMode ? '#101F33' : '#F8FAFC', borderColor: isDarkMode ? '#1E324A' : '#E2E8F0' }]}>
                  <Text style={[styles.receiptBookTitle, { color: theme.textPrimary }]} numberOfLines={2}>
                    {selectedReceipt?.bookTitle}
                  </Text>

                  {selectedReceipt?.author ? (
                    <View style={styles.receiptAuthorRow}>
                      <Ionicons name="person-circle-outline" size={14} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                      <Text style={[styles.receiptAuthorText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                        {selectedReceipt?.author}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.receiptTagRow}>
                    {selectedReceipt?.isbn ? (
                      <View style={[styles.receiptMetaTag, { backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.12)' : '#E0F2FE' }]}>
                        <Ionicons name="barcode-outline" size={11} color={isDarkMode ? '#38BDF8' : '#0274BB'} />
                        <Text style={[styles.receiptMetaTagText, { color: isDarkMode ? '#38BDF8' : '#0274BB' }]}>
                          {selectedReceipt.isbn}
                        </Text>
                      </View>
                    ) : null}

                    {selectedReceipt?.category ? (
                      <View style={[styles.receiptMetaTag, { backgroundColor: isDarkMode ? 'rgba(168, 85, 247, 0.12)' : '#F3E8FF' }]}>
                        <Ionicons name="pricetag-outline" size={11} color={isDarkMode ? '#C084FC' : '#7E22CE'} />
                        <Text style={[styles.receiptMetaTagText, { color: isDarkMode ? '#C084FC' : '#7E22CE' }]}>
                          {selectedReceipt.category}
                        </Text>
                      </View>
                    ) : null}

                    {selectedReceipt?.shelf ? (
                      <View style={[styles.receiptMetaTag, { backgroundColor: isDarkMode ? 'rgba(251, 191, 36, 0.12)' : '#FEF3C7' }]}>
                        <Ionicons name="library-outline" size={11} color={isDarkMode ? '#FBBF24' : '#B45309'} />
                        <Text style={[styles.receiptMetaTagText, { color: isDarkMode ? '#FBBF24' : '#B45309' }]}>
                          {selectedReceipt.shelf}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>

              {/* Circulation Timeline & Dates vs Reservation & Queue Details */}
              {isReservationReceipt ? (
                <View style={styles.receiptSection}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="bookmark-outline" size={13} color={isDarkMode ? '#C084FC' : '#7C3AED'} />
                    <Text style={[styles.receiptSectionHeader, { color: isDarkMode ? '#C084FC' : '#7C3AED' }]}>
                      RESERVATION & QUEUE DETAILS
                    </Text>
                  </View>

                  <View style={styles.receiptDateGrid}>
                    <View style={[styles.receiptDateBox, { backgroundColor: isDarkMode ? '#101F33' : '#F8FAFC', borderColor: isDarkMode ? '#1E324A' : '#E2E8F0' }]}>
                      <View style={styles.dateBoxHeader}>
                        <Ionicons name="calendar-outline" size={12} color="#64748B" />
                        <Text style={styles.receiptDateBoxLabel}>DATE RESERVED</Text>
                      </View>
                      <Text style={[styles.receiptDateBoxValue, { color: theme.textPrimary }]}>
                        {selectedReceipt?.reservationDate || selectedReceipt?.borrowDate || "Today"}
                      </Text>
                    </View>

                    <View style={[styles.receiptDateBox, { backgroundColor: isDarkMode ? '#101F33' : '#F8FAFC', borderColor: isDarkMode ? '#1E324A' : '#E2E8F0' }]}>
                      <View style={styles.dateBoxHeader}>
                        <Ionicons name="people-outline" size={13} color={isDarkMode ? '#C084FC' : '#7C3AED'} />
                        <Text style={[styles.receiptDateBoxLabel, { color: isDarkMode ? '#C084FC' : '#7C3AED' }]}>QUEUE NUMBER</Text>
                      </View>
                      <Text style={[styles.receiptDateBoxValue, { color: isDarkMode ? '#C084FC' : '#7C3AED', fontWeight: '800' }]}>
                        Que #{selectedReceipt?.queuePosition || "1"}
                      </Text>
                    </View>
                  </View>

                  {/* Queue Status Box */}
                  <View style={[
                    styles.receiptDueHeroCard,
                    {
                      backgroundColor: isDarkMode ? 'rgba(168, 85, 247, 0.10)' : '#F5F3FF',
                      borderColor: isDarkMode ? 'rgba(168, 85, 247, 0.35)' : '#DDD6FE',
                    }
                  ]}>
                    <View style={styles.dueHeroTopRow}>
                      <View style={styles.dueHeroLabelGroup}>
                        <Ionicons
                          name="ribbon-outline"
                          size={16}
                          color={isDarkMode ? '#C084FC' : '#7C3AED'}
                        />
                        <Text style={[
                          styles.dueHeroTitle,
                          { color: isDarkMode ? '#C084FC' : '#7C3AED' }
                        ]}>
                          QUEUE STATUS: IN LINE
                        </Text>
                      </View>

                      <View style={[
                        styles.dueHeroStatusPill,
                        { backgroundColor: isDarkMode ? 'rgba(168, 85, 247, 0.2)' : '#EDE9FE' }
                      ]}>
                        <Text style={[
                          styles.dueHeroStatusPillText,
                          { color: isDarkMode ? '#C084FC' : '#7C3AED' }
                        ]}>
                          1ST-COME 1ST-SERVED
                        </Text>
                      </View>
                    </View>

                    <Text style={[
                      styles.dueHeroDateValue,
                      { color: isDarkMode ? '#C084FC' : '#6D28D9', fontSize: 16 }
                    ]}>
                      Waiting for Returned Copy
                    </Text>

                    <View style={styles.dueHeroNoticeRow}>
                      <Ionicons
                        name="information-circle-outline"
                        size={13}
                        color={isDarkMode ? '#C084FC' : '#7C3AED'}
                      />
                      <Text style={[
                        styles.dueHeroNoticeText,
                        { color: isDarkMode ? '#94A3B8' : '#64748B' }
                      ]}>
                        When a physical copy is returned to the library, your reservation will automatically turn into an active borrow pass with a pickup QR code.
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.receiptSection}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="time-outline" size={13} color={isDarkMode ? '#38BDF8' : '#0274BB'} />
                    <Text style={[styles.receiptSectionHeader, { color: isDarkMode ? '#38BDF8' : '#0274BB' }]}>
                      CIRCULATION TIMELINE
                    </Text>
                  </View>

                  <View style={styles.receiptDateGrid}>
                    <View style={[styles.receiptDateBox, { backgroundColor: isDarkMode ? '#101F33' : '#F8FAFC', borderColor: isDarkMode ? '#1E324A' : '#E2E8F0' }]}>
                      <View style={styles.dateBoxHeader}>
                        <Ionicons name="calendar-outline" size={12} color="#64748B" />
                        <Text style={styles.receiptDateBoxLabel}>DATE BORROWED</Text>
                      </View>
                      <Text style={[styles.receiptDateBoxValue, { color: theme.textPrimary }]}>
                        {selectedReceipt?.borrowDate}
                      </Text>
                    </View>

                    <View style={[styles.receiptDateBox, { backgroundColor: isDarkMode ? '#101F33' : '#F8FAFC', borderColor: isDarkMode ? '#1E324A' : '#E2E8F0' }]}>
                      <View style={styles.dateBoxHeader}>
                        <Ionicons name="checkmark-done-circle-outline" size={13} color="#10B981" />
                        <Text style={[styles.receiptDateBoxLabel, { color: '#10B981' }]}>PICKED UP</Text>
                      </View>
                      <Text style={[styles.receiptDateBoxValue, { color: '#10B981', fontWeight: '800' }]}>
                        {selectedReceipt?.pickupDate}
                      </Text>
                    </View>
                  </View>

                  {/* Due Date Hero Card - Completely Prevents Overflow */}
                  <View style={[
                    styles.receiptDueHeroCard,
                    isReceiptDue
                      ? {
                          backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                          borderColor: isDarkMode ? '#EF4444' : '#F87171',
                        }
                      : {
                          backgroundColor: isDarkMode ? 'rgba(2, 116, 187, 0.10)' : '#F0F9FF',
                          borderColor: isDarkMode ? '#0284C7' : '#BAE6FD',
                        }
                  ]}>
                    <View style={styles.dueHeroTopRow}>
                      <View style={styles.dueHeroLabelGroup}>
                        <Ionicons
                          name={isReceiptDue ? "alert-circle" : "calendar"}
                          size={16}
                          color={isReceiptDue ? '#EF4444' : (isDarkMode ? '#38BDF8' : '#0274BB')}
                        />
                        <Text style={[
                          styles.dueHeroTitle,
                          { color: isReceiptDue ? '#EF4444' : (isDarkMode ? '#38BDF8' : '#0284C7') }
                        ]}>
                          DUE RETURN DEADLINE
                        </Text>
                      </View>

                      <View style={[
                        styles.dueHeroStatusPill,
                        { backgroundColor: isReceiptDue ? 'rgba(239, 68, 68, 0.2)' : 'rgba(2, 132, 199, 0.15)' }
                      ]}>
                        <Text style={[
                          styles.dueHeroStatusPillText,
                          { color: isReceiptDue ? '#EF4444' : (isDarkMode ? '#38BDF8' : '#0284C7') }
                        ]}>
                          {isReceiptDue ? "DUE TODAY" : "ON SCHEDULE"}
                        </Text>
                      </View>
                    </View>

                    <Text style={[
                      styles.dueHeroDateValue,
                      { color: isReceiptDue ? (isDarkMode ? '#F87171' : '#DC2626') : (isDarkMode ? '#38BDF8' : '#0369A1') }
                    ]}>
                      {selectedReceipt?.returnDate}
                    </Text>

                    <View style={styles.dueHeroNoticeRow}>
                      <Ionicons
                        name="information-circle-outline"
                        size={13}
                        color={isReceiptDue ? (isDarkMode ? '#FCA5A5' : '#B91C1C') : (isDarkMode ? '#94A3B8' : '#64748B')}
                      />
                      <Text style={[
                        styles.dueHeroNoticeText,
                        { color: isReceiptDue ? (isDarkMode ? '#FCA5A5' : '#B91C1C') : (isDarkMode ? '#94A3B8' : '#64748B') }
                      ]}>
                        {isReceiptDue
                          ? "Please return this copy to the circulation desk to avoid overdue penalties."
                          : "Return book on or before the due date to keep your library account clear."}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Borrower / Student Details Section */}
              <View style={styles.receiptSection}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="id-card-outline" size={13} color={isReservationReceipt ? (isDarkMode ? '#C084FC' : '#7C3AED') : (isDarkMode ? '#38BDF8' : '#0274BB')} />
                  <Text style={[styles.receiptSectionHeader, { color: isReservationReceipt ? (isDarkMode ? '#C084FC' : '#7C3AED') : (isDarkMode ? '#38BDF8' : '#0274BB') }]}>
                    {isReservationReceipt ? "STUDENT DETAILS" : "BORROWER DETAILS"}
                  </Text>
                </View>

                <View style={[styles.receiptBorrowerCard, { backgroundColor: isDarkMode ? '#101F33' : '#F8FAFC', borderColor: isDarkMode ? '#1E324A' : '#E2E8F0' }]}>
                  <View style={styles.borrowerInfoRow}>
                    <View style={[styles.borrowerAvatarBox, { backgroundColor: isDarkMode ? '#1E324A' : '#E2E8F0' }]}>
                      <Ionicons name="person" size={16} color={isDarkMode ? '#38BDF8' : '#0274BB'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.borrowerNameText, { color: theme.textPrimary }]}>
                        {selectedReceipt?.studentName || "Student Borrower"}
                      </Text>
                      <View style={styles.borrowerPillRow}>
                        <View style={[styles.borrowerPill, { backgroundColor: isDarkMode ? '#1E2D40' : '#EDE9FE' }]}>
                          <Text style={[styles.borrowerPillText, { color: isDarkMode ? '#A78BFA' : '#6D28D9' }]}>
                            ID: {selectedReceipt?.studentId || "N/A"}
                          </Text>
                        </View>
                        <View style={[styles.borrowerPill, { backgroundColor: isDarkMode ? '#1E2D40' : '#E0F2FE' }]}>
                          <Text style={[styles.borrowerPillText, { color: isDarkMode ? '#38BDF8' : '#0369A1' }]}>
                            {selectedReceipt?.department || "General"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              {/* Perforated Ticket Notches & Divider */}
              <View style={styles.ticketDividerContainer}>
                <View style={[styles.ticketNotchLeft, { backgroundColor: 'rgba(0, 0, 0, 0.75)' }]} />
                <View style={[styles.receiptDashedLine, { borderColor: isDarkMode ? '#1E324A' : '#CBD5E1' }]} />
                <View style={[styles.ticketNotchRight, { backgroundColor: 'rgba(0, 0, 0, 0.75)' }]} />
              </View>

              {/* Dedicated Unique QR Code Section for Borrow Approved */}
              {isBorrowApproved && (
                <View style={styles.qrPassSection}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="qr-code-outline" size={14} color={isDarkMode ? '#FCD34D' : '#0274BB'} />
                    <Text style={[styles.receiptSectionHeader, { color: isDarkMode ? '#FCD34D' : '#0274BB' }]}>
                      PICKUP VERIFICATION QR CODE
                    </Text>
                  </View>

                  <View style={[
                    styles.qrPassCard,
                    {
                      backgroundColor: isDarkMode ? '#101F33' : '#F8FAFC',
                      borderColor: isDarkMode ? '#FCD34D' : '#0274BB',
                      padding: 12,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }
                  ]}>
                    <View style={[styles.qrCodeWrapper, { marginBottom: 0 }]}>
                      <View style={[styles.qrCodeBox, { padding: 8, borderRadius: 14 }]}>
                        <QRCode
                          value={selectedReceipt?.qrPayload || JSON.stringify({
                            type: "PICKUP_PASS",
                            transactionId: selectedReceipt?.transactionId || selectedReceipt?.receiptNumber,
                            receiptNumber: selectedReceipt?.receiptNumber,
                            studentId: selectedReceipt?.studentId,
                            studentName: selectedReceipt?.studentName,
                            isbn: selectedReceipt?.isbn,
                            bookTitle: selectedReceipt?.bookTitle,
                            author: selectedReceipt?.author,
                            category: selectedReceipt?.category,
                            shelf: selectedReceipt?.shelf,
                            department: selectedReceipt?.department,
                            borrowDate: selectedReceipt?.borrowDate,
                            pickupDate: selectedReceipt?.pickupDate,
                            returnDate: selectedReceipt?.returnDate,
                            status: selectedReceipt?.status,
                            qrCode: selectedReceipt?.studentId,
                          })}
                          size={qrPassSize}
                          color="#0F172A"
                          backgroundColor="#FFFFFF"
                        />
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* Verified Digital Record Badge */}
              <View style={styles.receiptVerifiedBadgeContainer}>
                <View style={[styles.qrVerifiedBadge, { backgroundColor: isDarkMode ? '#102334' : '#F0FDF4' }]}>
                  <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                  <Text style={styles.qrVerifiedBadgeText}>Verified STI WNU Digital Record</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActionButtonsWrapper}>
                <TouchableOpacity
                  style={[
                    styles.receiptViewBookBtn,
                    { backgroundColor: isDarkMode ? '#0284C7' : '#0274BB' }
                  ]}
                  onPress={() => selectedReceipt && handleViewBookFromReceipt(selectedReceipt)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="book-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.receiptViewBookBtnText}>
                    View Book
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 2 }} />
                </TouchableOpacity>

                <View style={styles.receiptActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.receiptSaveBtn,
                      { backgroundColor: isDarkMode ? '#FFD166' : '#F59E0B' }
                    ]}
                    onPress={() => {
                      Alert.alert(
                        isReservationReceipt ? "Reservation Slip Saved" : "Receipt Saved",
                        isReservationReceipt
                          ? `Reservation slip #${selectedReceipt?.receiptNumber} has been logged to your digital library card records.`
                          : `Circulation receipt #${selectedReceipt?.receiptNumber} has been logged to your digital library card records.`
                      );
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="download-outline" size={16} color={isDarkMode ? '#0F1D2B' : '#FFFFFF'} />
                    <Text style={[styles.receiptSaveBtnText, { color: isDarkMode ? '#0F1D2B' : '#FFFFFF' }]}>
                      {isReservationReceipt ? "Save Slip" : "Save Receipt"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.receiptDoneBtn,
                      {
                        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
                        borderColor: isDarkMode ? '#1E324A' : '#CBD5E1',
                      }
                    ]}
                    onPress={() => setSelectedReceipt(null)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.receiptDoneBtnText, { color: theme.textPrimary }]}>
                      Close
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Book Details Modal (for New Book Available / New Added Book) ── */}
      <Modal
        visible={selectedBook !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedBook(null)}
      >
        <View style={styles.receiptBackdrop}>
          <View style={[
            styles.bookModalCard,
            {
              backgroundColor: isDarkMode ? '#0B1726' : '#FFFFFF',
              borderColor: isDarkMode ? '#1E324A' : '#E2E8F0',
            }
          ]}>
            <View style={[
              styles.receiptHeaderRow,
              {
                borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
              }
            ]}>
              <View style={styles.receiptBrandRow}>
                <View style={[styles.receiptLogoBox, { backgroundColor: isDarkMode ? '#38BDF8' : '#0274BB' }]}>
                  <Ionicons name="book" size={16} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={[styles.receiptBrandTitle, { color: isDarkMode ? '#38BDF8' : '#0274BB' }]}>
                    BOOK DETAILS
                  </Text>
                  <Text style={[styles.receiptBrandSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                    New Catalog Release
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedBook(null)}
                style={[styles.receiptCloseBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}
              >
                <Ionicons name="close" size={18} color={isDarkMode ? '#FFFFFF' : '#334155'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={styles.bookModalHero}>
                <View style={[styles.bookCoverPlaceholder, { backgroundColor: isDarkMode ? '#102A45' : '#E0F2FE', borderColor: isDarkMode ? '#38BDF8' : '#0284C7' }]}>
                  <Ionicons name="book-outline" size={42} color={isDarkMode ? '#38BDF8' : '#0274BB'} />
                </View>
                <Text style={[styles.bookModalTitle, { color: theme.textPrimary }]} numberOfLines={2}>
                  {selectedBook?.title}
                </Text>
                <Text style={[styles.bookModalAuthor, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  by {selectedBook?.author}
                </Text>

                <View style={styles.bookModalBadgesRow}>
                  <View style={[styles.bookBadgePill, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                    <View style={[styles.receiptStatusDot, { backgroundColor: '#10B981' }]} />
                    <Text style={[styles.bookBadgeText, { color: '#10B981' }]}>
                      Available
                    </Text>
                  </View>

                  {selectedBook?.category ? (
                    <View style={[styles.bookBadgePill, { backgroundColor: isDarkMode ? 'rgba(168, 85, 247, 0.12)' : '#F3E8FF', borderColor: isDarkMode ? 'rgba(168, 85, 247, 0.3)' : '#E9D5FF' }]}>
                      <Text style={[styles.bookBadgeText, { color: isDarkMode ? '#C084FC' : '#7E22CE' }]}>
                        {selectedBook.category}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.bookInfoGrid}>
                <View style={[styles.bookInfoTile, { backgroundColor: isDarkMode ? '#101F33' : '#F8FAFC', borderColor: isDarkMode ? '#1E324A' : '#E2E8F0' }]}>
                  <Ionicons name="calendar-outline" size={14} color={isDarkMode ? '#38BDF8' : '#0274BB'} />
                  <Text style={styles.bookInfoTileLabel}>YEAR</Text>
                  <Text style={[styles.bookInfoTileValue, { color: theme.textPrimary }]}>
                    {selectedBook?.year || "2024"}
                  </Text>
                </View>
                <View style={[styles.bookInfoTile, { backgroundColor: isDarkMode ? '#101F33' : '#F8FAFC', borderColor: isDarkMode ? '#1E324A' : '#E2E8F0' }]}>
                  <Ionicons name="document-text-outline" size={14} color={isDarkMode ? '#38BDF8' : '#0274BB'} />
                  <Text style={styles.bookInfoTileLabel}>PAGES</Text>
                  <Text style={[styles.bookInfoTileValue, { color: theme.textPrimary }]}>
                    {selectedBook?.pages || "320"}
                  </Text>
                </View>
                <View style={[styles.bookInfoTile, { backgroundColor: isDarkMode ? '#101F33' : '#F8FAFC', borderColor: isDarkMode ? '#1E324A' : '#E2E8F0' }]}>
                  <Ionicons name="location-outline" size={14} color={isDarkMode ? '#38BDF8' : '#0274BB'} />
                  <Text style={styles.bookInfoTileLabel}>LOCATION</Text>
                  <Text style={[styles.bookInfoTileValue, { color: theme.textPrimary }]}>
                    {selectedBook?.shelf || "Main Stacks"}
                  </Text>
                </View>
              </View>

              <View style={styles.receiptSection}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="information-circle-outline" size={14} color={isDarkMode ? '#38BDF8' : '#0274BB'} />
                  <Text style={[styles.receiptSectionHeader, { color: isDarkMode ? '#38BDF8' : '#0274BB' }]}>
                    OVERVIEW & SUMMARY
                  </Text>
                </View>
                <View style={[styles.bookDescriptionBox, { backgroundColor: isDarkMode ? '#101F33' : '#F8FAFC', borderColor: isDarkMode ? '#1E324A' : '#E2E8F0' }]}>
                  <Text style={[styles.bookDescriptionText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
                    {selectedBook?.description || "No overview available for this book."}
                  </Text>
                </View>
              </View>

              <View style={styles.modalActionButtonsWrapper}>
                <TouchableOpacity
                  style={[
                    styles.receiptViewBookBtn,
                    { backgroundColor: isDarkMode ? '#0284C7' : '#0274BB' }
                  ]}
                  onPress={() => selectedBook && handleOpenBookDetails(selectedBook)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="book-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.receiptViewBookBtnText}>
                    View Book / Borrow
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 2 }} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.receiptDoneBtn,
                    {
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
                      borderColor: isDarkMode ? '#1E324A' : '#CBD5E1',
                      marginTop: 8,
                    }
                  ]}
                  onPress={() => setSelectedBook(null)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.receiptDoneBtnText, { color: theme.textPrimary }]}>
                    Close
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Announcement Modal (for Bulletins / Notices) ── */}
      <Modal
        visible={selectedAnnouncement !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedAnnouncement(null)}
      >
        <View style={styles.receiptBackdrop}>
          <View style={[
            styles.bookModalCard,
            {
              backgroundColor: isDarkMode ? '#0B1726' : '#FFFFFF',
              borderColor: isDarkMode ? '#1E324A' : '#E2E8F0',
            }
          ]}>
            <View style={[
              styles.receiptHeaderRow,
              {
                borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
              }
            ]}>
              <View style={styles.receiptBrandRow}>
                <View style={[styles.receiptLogoBox, { backgroundColor: isDarkMode ? '#F59E0B' : '#D97706' }]}>
                  <Ionicons name="megaphone" size={16} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={[styles.receiptBrandTitle, { color: isDarkMode ? '#F59E0B' : '#D97706' }]}>
                    LIBRARY ANNOUNCEMENT
                  </Text>
                  <Text style={[styles.receiptBrandSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                    Official Notice
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedAnnouncement(null)}
                style={[styles.receiptCloseBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}
              >
                <Ionicons name="close" size={18} color={isDarkMode ? '#FFFFFF' : '#334155'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
              <Text style={[styles.bookModalTitle, { color: theme.textPrimary, textAlign: 'left', marginTop: 0 }]}>
                {selectedAnnouncement?.title}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 16 }}>
                <Ionicons name="time-outline" size={14} color={isDarkMode ? '#94A3B8' : '#64748B'} style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 13, color: isDarkMode ? '#94A3B8' : '#64748B' }}>
                  {selectedAnnouncement?.timestamp}
                </Text>
              </View>

              <View style={[styles.bookDescriptionBox, { backgroundColor: isDarkMode ? '#101F33' : '#F8FAFC', borderColor: isDarkMode ? '#1E324A' : '#E2E8F0', padding: 16 }]}>
                <Text style={[styles.bookDescriptionText, { color: isDarkMode ? '#CBD5E1' : '#334155', fontSize: 14, lineHeight: 22 }]}>
                  {selectedAnnouncement?.body}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.receiptDoneBtn,
                  {
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
                    borderColor: isDarkMode ? '#1E324A' : '#CBD5E1',
                    marginTop: 20,
                  }
                ]}
                onPress={() => setSelectedAnnouncement(null)}
                activeOpacity={0.85}
              >
                <Text style={[styles.receiptDoneBtnText, { color: theme.textPrimary }]}>
                  Close
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  headerTitle: {
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1.5,
  },
  clearBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  clearText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 11,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 4,
  },
  tabsSection: {
    paddingBottom: 8,
  },
  tabsContainer: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 4,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabLabel: {
    fontSize: 12.5,
  },
  tabBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  notificationCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
    // Soft elevation
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  unreadRibbon: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconAndBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeContainer: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {
    paddingLeft: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  notificationTitle: {
    fontWeight: '700',
    fontSize: 15,
    flex: 1,
    letterSpacing: -0.2,
  },
  notificationTitleRead: {
    opacity: 0.8,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginLeft: 8,
  },
  notificationBody: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  notificationBodyRead: {
    opacity: 0.75,
  },
  // REASON CALLOUT BOX
  reasonContainer: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderLeftWidth: 4,
    marginVertical: 8,
  },
  reasonHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  reasonHeaderLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reasonBodyText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  notificationTime: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyBox: {
    marginTop: 80,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  resetBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  resetBtnText: {
    fontWeight: '700',
    fontSize: 12,
  },
  receiptBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  receiptCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 20,
  },
  receiptHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  receiptBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  receiptLogoBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptBrandTitle: {
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1.5,
  },
  receiptBrandSub: {
    fontSize: 10,
    fontWeight: '600',
  },
  receiptCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptTitleBlock: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
    alignItems: 'center',
  },
  receiptDocumentTitle: {
    fontSize: 14.5,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  receiptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 6,
  },
  receiptStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  receiptBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  slipPillBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  receiptNumberText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  ticketDividerContainer: {
    position: 'relative',
    marginVertical: 12,
    justifyContent: 'center',
  },
  ticketNotchLeft: {
    position: 'absolute',
    left: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    zIndex: 10,
  },
  ticketNotchRight: {
    position: 'absolute',
    right: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    zIndex: 10,
  },
  receiptDashedLine: {
    borderStyle: 'dashed',
    borderBottomWidth: 1.5,
    marginHorizontal: 16,
  },
  receiptSection: {
    paddingHorizontal: 18,
    marginVertical: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  receiptSectionHeader: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1,
  },
  receiptBookCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  receiptBookTitle: {
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  receiptAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 10,
  },
  receiptAuthorText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  receiptTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  receiptMetaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  receiptMetaTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  receiptDateGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  receiptDateBox: {
    flex: 1,
    padding: 11,
    borderRadius: 14,
    borderWidth: 1,
  },
  dateBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 5,
  },
  receiptDateBoxLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  receiptDateBoxValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  receiptDueHeroCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  dueHeroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  dueHeroLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dueHeroTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  dueHeroStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  dueHeroStatusPillText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  dueHeroDateValue: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  dueHeroNoticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
  dueHeroNoticeText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    flex: 1,
  },
  receiptBorrowerCard: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  borrowerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  borrowerAvatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  borrowerNameText: {
    fontSize: 14.5,
    fontWeight: '900',
    marginBottom: 4,
  },
  borrowerPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  borrowerPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  borrowerPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  receiptVerifiedBadgeContainer: {
    alignItems: 'center',
    marginVertical: 4,
    paddingHorizontal: 20,
  },
  qrVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  qrVerifiedBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  modalActionButtonsWrapper: {
    gap: 10,
    paddingHorizontal: 18,
    marginTop: 14,
  },
  receiptViewBookBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: '#0274BB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  receiptViewBookBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  receiptActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  receiptSaveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
  },
  receiptSaveBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  receiptDoneBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  receiptDoneBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  qrPassSection: {
    paddingHorizontal: 18,
    marginVertical: 10,
  },
  qrPassCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  qrPassInstructions: {
    fontSize: 11.5,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 16,
  },
  qrCodeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  qrCodeBox: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  qrPassFooter: {
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  qrPassBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  qrPassBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  qrPassSubNotice: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  bookModalCard: {
    width: '92%',
    maxWidth: 420,
    maxHeight: '85%',
    borderRadius: 24,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 20,
  },
  bookModalHero: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
    alignItems: 'center',
  },
  bookCoverPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    marginBottom: 12,
  },
  bookModalTitle: {
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  bookModalAuthor: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  bookModalBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  bookBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 16,
    borderWidth: 1,
  },
  bookBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  bookInfoGrid: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    gap: 8,
    marginVertical: 10,
  },
  bookInfoTile: {
    flex: 1,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 3,
  },
  bookInfoTileLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  bookInfoTileValue: {
    fontSize: 11.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  bookDescriptionBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  bookDescriptionText: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
  },
});
