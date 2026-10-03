import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedScreen from '../../components/AnimatedScreen';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useThemeColors } from '../../hooks/useThemeColors';
import {
  getSearchQueries,
  clearSearchQueries,
  removeSearchQuery,
  getViewedBooksHistory,
  clearViewedBooksHistory,
  removeViewedBookFromHistory,
  getFavoriteBooks,
  toggleFavoriteBook,
  subscribe,
  getBooksTabOverride,
  getNotifications,
  NotificationItem,
  getUpcomingReservations,
  getReservations,
  getReservationHistory,
  getLibraryCardHistory,
  ReservationBook,
} from '../../data/store';

type MainTabType = 'History' | 'Favorites';
type HistorySubTabType = 'Filtered' | 'Prompted' | 'Reservation History' | 'Borrow History';

export default function BooksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();
  const { tab, subTab } = useLocalSearchParams();

  const [activeTab, setActiveTab] = useState<MainTabType>('History');
  const [activeHistorySubTab, setActiveHistorySubTab] = useState<HistorySubTabType>('Filtered');

  // Handle active tab parameter or global override passed from other screens
  useFocusEffect(
    React.useCallback(() => {
      const override = getBooksTabOverride();
      if (override === 'Favorites') {
        setActiveTab('Favorites');
      } else if (override === 'History' || override === 'Search History' || override === 'Filtered' || override === 'Prompted') {
        setActiveTab('History');
        if (override === 'Prompted') {
          setActiveHistorySubTab('Prompted');
        } else if (override === 'Filtered' || override === 'Search History') {
          setActiveHistorySubTab('Filtered');
        }
      } else if (tab === 'Favorites') {
        setActiveTab('Favorites');
        router.setParams({ tab: '' });
      } else if (tab === 'History' || tab === 'Search History' || tab === 'Filtered' || tab === 'Prompted') {
        setActiveTab('History');
        if (tab === 'Prompted') {
          setActiveHistorySubTab('Prompted');
        } else {
          setActiveHistorySubTab('Filtered');
        }
        router.setParams({ tab: '' });
      }

      if (subTab === 'Reservation History' || subTab === 'Borrow History' || subTab === 'Prompted' || subTab === 'Filtered') {
        setActiveTab('History');
        setActiveHistorySubTab(subTab as HistorySubTabType);
        router.setParams({ subTab: '' });
      }
    }, [tab, subTab, router])
  );

  // Store data states
  const [searchQueries, setSearchQueries] = useState<string[]>(getSearchQueries());
  const [viewedBooks, setViewedBooks] = useState<any[]>(getViewedBooksHistory());
  const [favorites, setFavorites] = useState<any[]>(getFavoriteBooks());
  const [notifications, setNotifications] = useState<NotificationItem[]>(getNotifications());
  const [upcomingReservations, setUpcomingReservations] = useState<ReservationBook[]>(getUpcomingReservations());
  const [allReservations, setAllReservations] = useState<ReservationBook[]>(getReservations());
  const [allHistory, setAllHistory] = useState<ReservationBook[]>(getReservationHistory());
  const [libraryCardBooks, setLibraryCardBooks] = useState<ReservationBook[]>(getLibraryCardHistory());

  // Real-time second ticker for hold countdowns
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const tickInterval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(tickInterval);
  }, []);

  const getReservationCountdown = (book: ReservationBook) => {
    if (!book.expiresAt) {
      return { text: "24h 00m remaining", isUrgent: false, isExpired: false };
    }
    const expiryMs = new Date(book.expiresAt).getTime();
    const diff = expiryMs - now;
    if (diff <= 0) {
      return { text: "Expired (Voided)", isUrgent: true, isExpired: true };
    }
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    const text = `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
    const isUrgent = diff < 2 * 60 * 60 * 1000;
    return { text, isUrgent, isExpired: false };
  };

  // Sync with store
  useEffect(() => {
    const updateStoreData = () => {
      setSearchQueries(getSearchQueries());
      setViewedBooks(getViewedBooksHistory());
      setFavorites(getFavoriteBooks());
      setNotifications(getNotifications());
      setUpcomingReservations(getUpcomingReservations());
      setAllReservations(getReservations());
      setAllHistory(getReservationHistory());
      setLibraryCardBooks(getLibraryCardHistory());
    };

    updateStoreData();
    const unsubscribe = subscribe(updateStoreData);
    return unsubscribe;
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Deduplicated Unified Reservation List
  const reservationList = useMemo(() => {
    const seenIds = new Set<string>();
    const list: ReservationBook[] = [];

    // 1. Upcoming active reservations
    for (const item of upcomingReservations) {
      const isRes = item.action === 'Reserve' || (item as any).type === 'Reservation' || item.queuePosition !== undefined || item.status === 'Pending';
      if (isRes && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        list.push(item);
      }
    }

    // 2. All stored reservations
    for (const item of allReservations) {
      const isRes = item.action === 'Reserve' || (item as any).type === 'Reservation' || item.queuePosition !== undefined;
      if (isRes && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        list.push(item);
      }
    }

    // 3. Historical reservation records
    for (const item of allHistory) {
      const isRes = item.action === 'Reserve' || (item as any).type === 'Reservation' || item.queuePosition !== undefined;
      if (isRes && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        list.push(item);
      }
    }

    // Fallback if none flagged specifically with action Reserve: include any pending reservations
    if (list.length === 0) {
      for (const item of allReservations) {
        if (item.status === 'Pending' && !seenIds.has(item.id)) {
          seenIds.add(item.id);
          list.push(item);
        }
      }
    }

    return list;
  }, [upcomingReservations, allReservations, allHistory]);

  // Deduplicated Unified Borrow List
  const borrowList = useMemo(() => {
    const seenIds = new Set<string>();
    const list: ReservationBook[] = [];

    // 1. Library card records (both active loans and returned books)
    for (const item of libraryCardBooks) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        list.push(item);
      }
    }

    // 2. All history records with borrow status
    for (const item of allHistory) {
      const isBorrowRecord =
        item.action === 'Borrow' ||
        item.status === 'Approved' ||
        item.status === 'Completed' ||
        item.isReturned === true ||
        item.date === 'Returned' ||
        (item as any).type === 'Borrowing';

      if (isBorrowRecord && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        list.push(item);
      }
    }

    return list;
  }, [libraryCardBooks, allHistory]);

  const handleQueryPress = (query: string) => {
    router.push({
      pathname: '/search',
      params: { q: query },
    });
  };

  const handleBookPress = (book: any) => {
    router.push({
      pathname: '/book-details',
      params: {
        from: 'books',
        id: book.id,
        title: book.title,
        author: book.author,
        category: book.genres || book.category || book.department || 'Circulation',
        department: book.department || 'Circulation',
        rating: book.rating || '4.8',
        description: book.description || book.summary || '',
        available: book.available !== undefined ? String(book.available) : 'true',
        year: book.publicationDate ? String(book.publicationDate).substring(0, 4) : (book.year ? String(book.year) : '2026'),
        publicationDate: book.publicationDate || (book.year ? `${book.year}-01-01` : '2026-09-01'),
        pages: book.pages || '320',
        language: book.language || 'EN',
        shelf: book.shelfLocation || book.callNumber || book.shelf || 'General Shelf',
        isbn: book.isbn || '',
        copies: String(book.copies !== undefined && book.copies !== null ? book.copies : 1),
        volume: book.volume || 'Single Volume / None',
        edition: book.edition || 'Single Edition / None',
        accessionNumber: book.accessionNumber || '',
      },
    });
  };

  const historySubTabs: { key: HistorySubTabType; label: string; icon: keyof typeof Ionicons.glyphMap; count: number }[] = [
    { key: 'Filtered', label: 'Filtered', icon: 'filter-outline', count: viewedBooks.length },
    { key: 'Prompted', label: 'Prompted', icon: 'chatbubble-ellipses-outline', count: searchQueries.length },
    { key: 'Reservation History', label: 'Reservation History', icon: 'bookmark-outline', count: reservationList.length },
    { key: 'Borrow History', label: 'Borrow History', icon: 'time-outline', count: borrowList.length },
  ];

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            height: 65 + insets.top,
            backgroundColor: theme.headerBg,
            borderBottomColor: theme.headerBorder,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.headerTitle }]}>MY BOOKSHELF</Text>

        <TouchableOpacity
          style={styles.notificationButtonRelative}
          onPress={() => router.push('/notifications')}
        >
          <Ionicons name="notifications-outline" size={22} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
          {unreadCount > 0 && (
            <View style={styles.badgeContainerRelative}>
              <Text style={styles.badgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* SEGMENTED MAIN TAB SELECTOR (History | Favorites) */}
      <View style={styles.tabContainer}>
        {(['History', 'Favorites'] as MainTabType[]).map((tabName) => {
          const isActive = activeTab === tabName;
          return (
            <TouchableOpacity
              key={tabName}
              style={[
                styles.tabPill,
                isActive
                  ? [styles.activeTabPill, !isDarkMode && { backgroundColor: theme.accentBlue }]
                  : [styles.inactiveTabPill, !isDarkMode && { backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.cardBorder }],
              ]}
              onPress={() => setActiveTab(tabName)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabText,
                  isActive
                    ? [styles.activeTabText, !isDarkMode && { color: '#FFFFFF', fontWeight: '800' }]
                    : [styles.inactiveTabText, !isDarkMode && { color: theme.textSecondary }],
                ]}
              >
                {tabName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* HISTORY SUB-TABS ROW (When History is selected) */}
      {activeTab === 'History' && (
        <View style={[styles.subTabWrapper, { borderBottomColor: theme.cardBorder }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subTabScrollContent}
          >
            {historySubTabs.map((subTabItem) => {
              const isSubActive = activeHistorySubTab === subTabItem.key;
              return (
                <TouchableOpacity
                  key={subTabItem.key}
                  style={[
                    styles.subTabPill,
                    isSubActive
                      ? [
                          styles.activeSubTabPill,
                          {
                            backgroundColor: isDarkMode ? "rgba(255, 215, 0, 0.16)" : "#E0F2FE",
                            borderColor: isDarkMode ? "#FFD700" : "rgba(2, 116, 187, 0.35)",
                          },
                        ]
                      : [
                          styles.inactiveSubTabPill,
                          {
                            backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.04)" : theme.cardBg,
                            borderColor: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(2, 116, 187, 0.14)",
                          },
                        ],
                  ]}
                  onPress={() => setActiveHistorySubTab(subTabItem.key)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={subTabItem.icon}
                    size={14}
                    color={
                      isSubActive
                        ? (isDarkMode ? "#FFD700" : "#0274BB")
                        : (isDarkMode ? "#94A3B8" : "#64748B")
                    }
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.subTabText,
                      isSubActive
                        ? { color: isDarkMode ? "#FFD700" : "#0274BB", fontWeight: '800' }
                        : { color: isDarkMode ? "#94A3B8" : "#64748B", fontWeight: '600' },
                    ]}
                  >
                    {subTabItem.label}
                  </Text>
                  {subTabItem.count > 0 && (
                    <View
                      style={[
                        styles.subTabBadge,
                        {
                          backgroundColor: isSubActive
                            ? (isDarkMode ? "rgba(255, 215, 0, 0.25)" : "rgba(2, 116, 187, 0.18)")
                            : (isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)"),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.subTabBadgeText,
                          {
                            color: isSubActive
                              ? (isDarkMode ? "#FFD700" : "#0274BB")
                              : (isDarkMode ? "#94A3B8" : "#64748B"),
                          },
                        ]}
                      >
                        {subTabItem.count}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* CONTENT BLOCK */}
      <ScrollView contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}>
        {/* ============================================================== */}
        {/* SUB-PAGE 1: FILTERED (Books clicked using filter)               */}
        {/* ============================================================== */}
        {activeTab === 'History' && activeHistorySubTab === 'Filtered' && (
          <View>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: theme.sectionTitle }]}>
                  Filtered Books
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  Books clicked using catalog filters & search
                </Text>
              </View>
              {viewedBooks.length > 0 && (
                <TouchableOpacity
                  onPress={async () => {
                    await clearViewedBooksHistory();
                    setViewedBooks([]);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.clearText, { color: isDarkMode ? "#38BDF8" : theme.accentBlue }]}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>

            {viewedBooks.length === 0 ? (
              <View style={[styles.emptyCardContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                <View style={[styles.emptyIconCircle, { backgroundColor: isDarkMode ? "rgba(2, 116, 187, 0.15)" : "#E0F2FE" }]}>
                  <Ionicons name="filter-outline" size={32} color={isDarkMode ? "#38BDF8" : "#0274BB"} />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                  No Filtered Books Yet
                </Text>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  Books you click and explore after searching or filtering by department and category will appear here.
                </Text>
                <TouchableOpacity
                  style={[styles.emptyActionBtn, { backgroundColor: isDarkMode ? theme.accentGold : theme.accentBlue }]}
                  onPress={() => router.push('/search')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="search" size={15} color={isDarkMode ? "#080F1E" : "#FFFFFF"} style={{ marginRight: 6 }} />
                  <Text style={[styles.emptyActionBtnText, { color: isDarkMode ? "#080F1E" : "#FFFFFF" }]}>
                    Explore Catalog Filters
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              viewedBooks.map((book, index) => (
                <View
                  key={`filtered-book-${book.id || index}-${index}`}
                  style={[styles.historyItemCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                >
                  <View style={styles.historyCardTopRow}>
                    <View style={[styles.historyCardIconSquare, { backgroundColor: isDarkMode ? "rgba(2, 116, 187, 0.15)" : "#E0F2FE", borderColor: isDarkMode ? "rgba(2, 116, 187, 0.3)" : "rgba(2, 116, 187, 0.25)" }]}>
                      <Ionicons name="book" size={16} color={isDarkMode ? "#38BDF8" : "#0274BB"} />
                    </View>

                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={[styles.historyCardTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                        {book.title}
                      </Text>
                      <Text style={[styles.historyCardAuthor, { color: theme.textSecondary }]} numberOfLines={1}>
                        {book.author}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={async () => {
                        await removeViewedBookFromHistory(book.id);
                        setViewedBooks(getViewedBooksHistory());
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="close-circle-outline" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.historyCardDetailsRow, { borderTopColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" }]}>
                    <View style={styles.historyDetailItem}>
                      <Ionicons name="business-outline" size={13} color={theme.textSecondary} />
                      <Text style={[styles.historyDetailText, { color: theme.textSecondary }]}>
                        {book.department || book.category || 'Circulation'}
                      </Text>
                    </View>

                    {book.shelf ? (
                      <View style={styles.historyDetailItem}>
                        <Ionicons name="location-outline" size={13} color={theme.textSecondary} />
                        <Text style={[styles.historyDetailText, { color: theme.textSecondary }]}>
                          {book.shelf}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    style={[styles.historyCardActionBtn, { backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.05)" : "#F0F7FF", borderColor: isDarkMode ? theme.cardBorder : "rgba(2, 116, 187, 0.2)" }]}
                    onPress={() => handleBookPress(book)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.historyCardActionBtnText, { color: isDarkMode ? "#FCD34D" : theme.accentBlue }]}>
                      View Book Details
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={isDarkMode ? "#FCD34D" : theme.accentBlue} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* ============================================================== */}
        {/* SUB-PAGE 2: PROMPTED (Search prompts entered)                  */}
        {/* ============================================================== */}
        {activeTab === 'History' && activeHistorySubTab === 'Prompted' && (
          <View>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: theme.sectionTitle }]}>
                  Prompt Inquiries
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  Each search inquiry and prompt entered
                </Text>
              </View>
              {searchQueries.length > 0 && (
                <TouchableOpacity
                  onPress={async () => {
                    await clearSearchQueries();
                    setSearchQueries([]);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.clearText, { color: isDarkMode ? "#38BDF8" : theme.accentBlue }]}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>

            {searchQueries.length === 0 ? (
              <View style={[styles.emptyCardContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                <View style={[styles.emptyIconCircle, { backgroundColor: isDarkMode ? "rgba(255, 215, 0, 0.12)" : "#FEF9C3" }]}>
                  <Ionicons name="chatbubble-ellipses-outline" size={32} color={isDarkMode ? theme.accentGold : "#854D0E"} />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                  No Prompts Yet
                </Text>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  Search queries and research prompts you submit will appear here as individual prompts.
                </Text>
                <TouchableOpacity
                  style={[styles.emptyActionBtn, { backgroundColor: isDarkMode ? theme.accentGold : theme.accentBlue }]}
                  onPress={() => router.push('/search')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="search" size={15} color={isDarkMode ? "#080F1E" : "#FFFFFF"} style={{ marginRight: 6 }} />
                  <Text style={[styles.emptyActionBtnText, { color: isDarkMode ? "#080F1E" : "#FFFFFF" }]}>
                    Ask or Search Prompt
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={styles.timestampDividerRow}>
                  <View style={[styles.dividerLine, { backgroundColor: theme.cardBorder }]} />
                  <Text style={[styles.timestampText, { color: theme.textSecondary }]}>
                    Saved Prompts ({searchQueries.length})
                  </Text>
                  <View style={[styles.dividerLine, { backgroundColor: theme.cardBorder }]} />
                </View>

                {searchQueries.map((query, index) => (
                  <View
                    key={`prompt-${index}`}
                    style={[styles.historyCapsuleCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                  >
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                      onPress={() => handleQueryPress(query)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.historyIconBox, { backgroundColor: isDarkMode ? "rgba(255, 215, 0, 0.12)" : "#E0F2FE", borderColor: isDarkMode ? "rgba(255, 215, 0, 0.25)" : "rgba(2, 116, 187, 0.25)" }]}>
                        <Ionicons name="sparkles" size={14} color={isDarkMode ? theme.accentGold : "#0274BB"} />
                      </View>
                      <Text style={[styles.historyQueryText, { color: theme.textPrimary }]} numberOfLines={1}>
                        {query}
                      </Text>
                      <Ionicons name="arrow-forward-outline" size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={async () => {
                        await removeSearchQuery(query);
                        setSearchQueries(getSearchQueries());
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="close-circle-outline" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ============================================================== */}
        {/* SUB-PAGE 3: RESERVATION HISTORY                                 */}
        {/* ============================================================== */}
        {activeTab === 'History' && activeHistorySubTab === 'Reservation History' && (
          <View>
            {/* Summary Metrics Bar */}
            <View style={[styles.summaryBannerCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <View style={styles.summaryBannerRow}>
                <View style={[styles.summaryStatBox, { borderRightColor: theme.cardBorder, borderRightWidth: 1 }]}>
                  <Text style={[styles.summaryStatNumber, { color: theme.textPrimary }]}>{reservationList.length}</Text>
                  <Text style={[styles.summaryStatLabel, !isDarkMode && { color: theme.accentBlue }]}>Total Reservations</Text>
                </View>
                <View style={[styles.summaryStatBox, { borderRightColor: theme.cardBorder, borderRightWidth: 1 }]}>
                  <Text style={[styles.summaryStatNumber, { color: "#C084FC" }]}>
                    {reservationList.filter(r => r.status === 'Pending' || r.queuePosition !== undefined).length}
                  </Text>
                  <Text style={styles.summaryStatLabel}>In Waitlist</Text>
                </View>
                <View style={styles.summaryStatBox}>
                  <Text style={[styles.summaryStatNumber, { color: "#10B981" }]}>
                    {reservationList.filter(r => r.status === 'Approved' || r.available === 'true').length}
                  </Text>
                  <Text style={styles.summaryStatLabel}>Ready / Active</Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.sectionTitle }]}>
                Reservation Records
              </Text>
              <View style={[styles.countBadgePill, { backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "#E0F2FE", borderColor: isDarkMode ? theme.cardBorder : "rgba(2, 116, 187, 0.25)", borderWidth: 1 }]}>
                <Text style={[styles.countBadgeText, { color: isDarkMode ? "#FCD34D" : "#0274BB" }]}>
                  {reservationList.length} Records
                </Text>
              </View>
            </View>

            {reservationList.length === 0 ? (
              <View style={[styles.emptyCardContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                <View style={[styles.emptyIconCircle, { backgroundColor: isDarkMode ? "rgba(168, 85, 247, 0.12)" : "#F3E8FF" }]}>
                  <Ionicons name="bookmark-outline" size={32} color="#A855F7" />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                  No Reservation History
                </Text>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  Books you reserve when all copies are checked out will appear here with queue positions and status updates.
                </Text>
                <TouchableOpacity
                  style={[styles.emptyActionBtn, { backgroundColor: isDarkMode ? theme.accentGold : theme.accentBlue }]}
                  onPress={() => router.push('/search')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="search" size={15} color={isDarkMode ? "#080F1E" : "#FFFFFF"} style={{ marginRight: 6 }} />
                  <Text style={[styles.emptyActionBtnText, { color: isDarkMode ? "#080F1E" : "#FFFFFF" }]}>
                    Find Books to Reserve
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              reservationList.map((item, idx) => {
                const countdown = getReservationCountdown(item);
                const isClaimReady = item.available === "true" || !!item.expiresAt;
                const isPending = item.status === "Pending" || item.queuePosition !== undefined;
                const isApproved = item.status === "Approved";
                const isCompleted = item.status === "Completed";

                return (
                  <View
                    key={`res-item-${item.id || idx}-${idx}`}
                    style={[styles.historyItemCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                  >
                    <View style={styles.historyCardTopRow}>
                      <View style={[styles.historyCardIconSquare, { backgroundColor: isDarkMode ? "rgba(168, 85, 247, 0.12)" : "#F3E8FF", borderColor: isDarkMode ? "rgba(168, 85, 247, 0.3)" : "#D8B4FE" }]}>
                        <Ionicons name="bookmark" size={16} color="#A855F7" />
                      </View>

                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={[styles.historyCardTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={[styles.historyCardAuthor, { color: theme.textSecondary }]} numberOfLines={1}>
                          {item.author}
                        </Text>
                      </View>

                      {/* Status Pill */}
                      <View style={[
                        styles.statusPill,
                        isClaimReady
                          ? { backgroundColor: "rgba(16, 185, 129, 0.15)", borderColor: "#10B981" }
                          : isPending
                          ? { backgroundColor: "rgba(168, 85, 247, 0.15)", borderColor: "#A855F7" }
                          : isApproved
                          ? { backgroundColor: "rgba(16, 185, 129, 0.15)", borderColor: "#10B981" }
                          : isCompleted
                          ? { backgroundColor: isDarkMode ? "rgba(56, 189, 248, 0.15)" : "#E0F2FE", borderColor: isDarkMode ? "#38BDF8" : "rgba(2, 116, 187, 0.3)" }
                          : { backgroundColor: "rgba(239, 68, 68, 0.15)", borderColor: "#EF4444" }
                      ]}>
                        <Text style={[
                          styles.statusPillText,
                          isClaimReady
                            ? { color: "#10B981" }
                            : isPending
                            ? { color: "#C084FC" }
                            : isApproved
                            ? { color: "#10B981" }
                            : isCompleted
                            ? { color: isDarkMode ? "#38BDF8" : "#0274BB" }
                            : { color: "#EF4444" }
                        ]}>
                          {isClaimReady
                            ? "READY TO BORROW"
                            : isPending
                            ? `WAITLIST #${item.queuePosition || 1}`
                            : isApproved
                            ? "APPROVED"
                            : isCompleted
                            ? "CLAIMED"
                            : "CANCELLED"}
                        </Text>
                      </View>
                    </View>

                    {/* Countdown banner if copy is ready for 24h pickup */}
                    {isClaimReady && (
                      <View style={[styles.claimCountdownBanner, { backgroundColor: countdown.isUrgent ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)", borderColor: countdown.isUrgent ? "#EF4444" : "#10B981" }]}>
                        <Ionicons name="timer-outline" size={15} color={countdown.isUrgent ? "#EF4444" : "#10B981"} />
                        <Text style={[styles.claimCountdownText, { color: countdown.isUrgent ? "#EF4444" : "#10B981" }]}>
                          Pickup Window: {countdown.text}
                        </Text>
                      </View>
                    )}

                    {/* Timeline & Metadata */}
                    <View style={[styles.historyCardDetailsRow, { borderTopColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" }]}>
                      <View style={styles.historyDetailItem}>
                        <Ionicons name="calendar-outline" size={13} color={theme.textSecondary} />
                        <Text style={[styles.historyDetailText, { color: theme.textSecondary }]}>
                          {item.pickupDate || item.date || "Requested"}
                        </Text>
                      </View>
                      {item.department ? (
                        <View style={styles.historyDetailItem}>
                          <Ionicons name="business-outline" size={13} color={theme.textSecondary} />
                          <Text style={[styles.historyDetailText, { color: theme.textSecondary }]}>
                            {item.department}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Action Button */}
                    <TouchableOpacity
                      style={[styles.historyCardActionBtn, { backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.05)" : "#F0F7FF", borderColor: isDarkMode ? theme.cardBorder : "rgba(2, 116, 187, 0.2)" }]}
                      onPress={() => handleBookPress(item)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.historyCardActionBtnText, { color: isDarkMode ? "#FCD34D" : theme.accentBlue }]}>
                        View Book Details
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={isDarkMode ? "#FCD34D" : theme.accentBlue} />
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ============================================================== */}
        {/* SUB-PAGE 4: BORROW HISTORY                                      */}
        {/* ============================================================== */}
        {activeTab === 'History' && activeHistorySubTab === 'Borrow History' && (
          <View>
            {/* Summary Metrics Bar */}
            <View style={[styles.summaryBannerCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <View style={styles.summaryBannerRow}>
                <View style={[styles.summaryStatBox, { borderRightColor: theme.cardBorder, borderRightWidth: 1 }]}>
                  <Text style={[styles.summaryStatNumber, { color: theme.textPrimary }]}>{borrowList.length}</Text>
                  <Text style={[styles.summaryStatLabel, !isDarkMode && { color: theme.accentBlue }]}>Total Borrowed</Text>
                </View>
                <View style={[styles.summaryStatBox, { borderRightColor: theme.cardBorder, borderRightWidth: 1 }]}>
                  <Text style={[styles.summaryStatNumber, { color: "#10B981" }]}>
                    {borrowList.filter(b => (b.status === 'Approved' || b.status === 'On Loan') && !b.isReturned && b.date !== 'Returned').length}
                  </Text>
                  <Text style={[styles.summaryStatLabel, { color: "#10B981" }]}>Active Loans</Text>
                </View>
                <View style={styles.summaryStatBox}>
                  <Text style={[styles.summaryStatNumber, { color: isDarkMode ? "#38BDF8" : theme.accentBlue }]}>
                    {borrowList.filter(b => b.status === 'Completed' || b.isReturned || b.date === 'Returned').length}
                  </Text>
                  <Text style={[styles.summaryStatLabel, { color: isDarkMode ? "#38BDF8" : theme.accentBlue }]}>Returned</Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.sectionTitle }]}>
                Borrowing Records
              </Text>
              <View style={[styles.countBadgePill, { backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "#E0F2FE", borderColor: isDarkMode ? theme.cardBorder : "rgba(2, 116, 187, 0.25)", borderWidth: 1 }]}>
                <Text style={[styles.countBadgeText, { color: isDarkMode ? "#FCD34D" : "#0274BB" }]}>
                  {borrowList.length} Records
                </Text>
              </View>
            </View>

            {borrowList.length === 0 ? (
              <View style={[styles.emptyCardContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                <View style={[styles.emptyIconCircle, { backgroundColor: isDarkMode ? "rgba(2, 116, 187, 0.15)" : "#E0F2FE" }]}>
                  <Ionicons name="library-outline" size={32} color={isDarkMode ? "#38BDF8" : "#0274BB"} />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                  No Borrow History
                </Text>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  Books you borrow from the circulation desk will appear here with active loan dates and return history.
                </Text>
                <TouchableOpacity
                  style={[styles.emptyActionBtn, { backgroundColor: isDarkMode ? theme.accentGold : theme.accentBlue }]}
                  onPress={() => router.push('/search')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="book-outline" size={15} color={isDarkMode ? "#080F1E" : "#FFFFFF"} style={{ marginRight: 6 }} />
                  <Text style={[styles.emptyActionBtnText, { color: isDarkMode ? "#080F1E" : "#FFFFFF" }]}>
                    Browse Catalog
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              borrowList.map((item, idx) => {
                const isReturned = item.status === "Completed" || item.isReturned || item.date === "Returned";
                const isPending = item.status === "Pending";
                const isActiveLoan = (item.status === "Approved" || item.status === "On Loan") && !isReturned;

                return (
                  <View
                    key={`borrow-item-${item.id || idx}-${idx}`}
                    style={[styles.historyItemCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                  >
                    <View style={styles.historyCardTopRow}>
                      <View style={[
                        styles.historyCardIconSquare,
                        isReturned
                          ? { backgroundColor: isDarkMode ? "rgba(56, 189, 248, 0.15)" : "#E0F2FE", borderColor: isDarkMode ? "rgba(56, 189, 248, 0.3)" : "rgba(2, 116, 187, 0.25)" }
                          : isActiveLoan
                          ? { backgroundColor: "rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.3)" }
                          : { backgroundColor: "rgba(245, 158, 11, 0.15)", borderColor: "rgba(245, 158, 11, 0.3)" }
                      ]}>
                        <Ionicons
                          name="book"
                          size={16}
                          color={isReturned ? (isDarkMode ? "#38BDF8" : "#0274BB") : (isActiveLoan ? "#10B981" : "#F59E0B")}
                        />
                      </View>

                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={[styles.historyCardTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={[styles.historyCardAuthor, { color: theme.textSecondary }]} numberOfLines={1}>
                          {item.author}
                        </Text>
                      </View>

                      {/* Status Pill */}
                      <View style={[
                        styles.statusPill,
                        isReturned
                          ? { backgroundColor: isDarkMode ? "rgba(56, 189, 248, 0.15)" : "#E0F2FE", borderColor: isDarkMode ? "#38BDF8" : "rgba(2, 116, 187, 0.35)" }
                          : isActiveLoan
                          ? { backgroundColor: "rgba(16, 185, 129, 0.15)", borderColor: "#10B981" }
                          : { backgroundColor: "rgba(245, 158, 11, 0.15)", borderColor: "#F59E0B" }
                      ]}>
                        {isReturned && (
                          <Ionicons
                            name="checkmark-circle"
                            size={12}
                            color={isDarkMode ? "#38BDF8" : "#0274BB"}
                            style={{ marginRight: 4 }}
                          />
                        )}
                        {isActiveLoan && (
                          <Ionicons
                            name="book"
                            size={12}
                            color="#10B981"
                            style={{ marginRight: 4 }}
                          />
                        )}
                        <Text style={[
                          styles.statusPillText,
                          isReturned
                            ? { color: isDarkMode ? "#38BDF8" : "#0274BB" }
                            : isActiveLoan
                            ? { color: "#10B981" }
                            : { color: "#F59E0B" }
                        ]}>
                          {isReturned
                            ? "RETURNED"
                            : isActiveLoan
                            ? "ACTIVE LOAN"
                            : "BORROW PENDING"}
                        </Text>
                      </View>
                    </View>

                    {/* Timeline & Metadata */}
                    <View style={[styles.historyCardDetailsRow, { borderTopColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" }]}>
                      <View style={styles.historyDetailItem}>
                        <Ionicons name="log-out-outline" size={13} color={theme.textSecondary} />
                        <Text style={[styles.historyDetailText, { color: theme.textSecondary }]}>
                          Borrowed: {item.pickupDate || item.date || "Active"}
                        </Text>
                      </View>

                      <View style={styles.historyDetailItem}>
                        <Ionicons
                          name={isReturned ? "checkmark-done-outline" : "alarm-outline"}
                          size={13}
                          color={isReturned ? (isDarkMode ? "#38BDF8" : theme.accentBlue) : (isActiveLoan ? "#10B981" : theme.textSecondary)}
                        />
                        <Text style={[
                          styles.historyDetailText,
                          { color: isReturned ? (isDarkMode ? "#38BDF8" : theme.accentBlue) : (isActiveLoan ? "#10B981" : theme.textSecondary) }
                        ]}>
                          {isReturned ? `Returned: ${item.returnDate || "Done"}` : `Due: ${item.returnDate || item.date || "7 Days"}`}
                        </Text>
                      </View>
                    </View>

                    {/* Action Button */}
                    <TouchableOpacity
                      style={[styles.historyCardActionBtn, { backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.05)" : "#F0F7FF", borderColor: isDarkMode ? theme.cardBorder : "rgba(2, 116, 187, 0.2)" }]}
                      onPress={() => handleBookPress(item)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.historyCardActionBtnText, { color: isDarkMode ? "#FCD34D" : theme.accentBlue }]}>
                        View Book Details
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={isDarkMode ? "#FCD34D" : theme.accentBlue} />
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ============================================================== */}
        {/* MAIN TAB 2: FAVORITES VIEW                                     */}
        {/* ============================================================== */}
        {activeTab === 'Favorites' && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: isDarkMode ? theme.accentGold : theme.textPrimary }]}>
                Favorite Books
              </Text>
              <View style={[styles.countBadgePill, !isDarkMode && { backgroundColor: "#E0F2FE", borderWidth: 1, borderColor: "rgba(2, 116, 187, 0.25)" }]}>
                <Text style={[styles.countBadgeText, !isDarkMode && { color: "#0274BB", fontWeight: "800" }]}>
                  {favorites.length} Saved
                </Text>
              </View>
            </View>

            {favorites.length === 0 ? (
              <View style={[styles.emptyCardContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                <View style={[styles.emptyIconCircle, { backgroundColor: isDarkMode ? "rgba(255, 215, 0, 0.12)" : "#FEF9C3" }]}>
                  <Ionicons name="bookmark-outline" size={32} color={isDarkMode ? theme.accentGold : "#854D0E"} />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                  No Saved Favorites
                </Text>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  Bookmark books while browsing to save them here for quick future reading.
                </Text>
                <TouchableOpacity
                  style={[styles.emptyActionBtn, { backgroundColor: isDarkMode ? theme.accentGold : theme.accentBlue }]}
                  onPress={() => router.push('/search')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="search" size={15} color={isDarkMode ? "#080F1E" : "#FFFFFF"} style={{ marginRight: 6 }} />
                  <Text style={[styles.emptyActionBtnText, { color: isDarkMode ? "#080F1E" : "#FFFFFF" }]}>
                    Discover Books
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              favorites.map((book, index) => (
                <TouchableOpacity
                  key={`fav-book-${book.id || index}-${index}`}
                  style={[styles.favoriteBookCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                  onPress={() => handleBookPress(book)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.favBookTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                      {book.title}
                    </Text>
                    <View style={styles.favDetailsRow}>
                      <Text style={[styles.favAuthorText, { color: theme.textSecondary }]}>
                        By: {book.author}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => toggleFavoriteBook(book)}
                    style={styles.bookmarkTouchArea}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <View style={!isDarkMode ? { backgroundColor: "#E0F2FE", borderRadius: 8, padding: 6, borderWidth: 1, borderColor: "rgba(2, 116, 187, 0.25)" } : { padding: 4 }}>
                      <Ionicons name="bookmark" size={18} color={isDarkMode ? "#FFD700" : "#0274BB"} />
                    </View>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080F1E',
  },
  header: {
    backgroundColor: '#080F1E',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#111A2E',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  notificationButtonRelative: {
    position: 'relative',
    padding: 4,
  },
  badgeContainerRelative: {
    position: 'absolute',
    right: -2,
    top: -2,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  // Main Segmented Tab Bar
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 12,
  },
  tabPill: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTabPill: {
    backgroundColor: '#FFD700',
  },
  inactiveTabPill: {
    backgroundColor: '#1E293B',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  activeTabText: {
    color: '#080F1E',
  },
  inactiveTabText: {
    color: '#94A3B8',
  },

  // History Sub-Tabs Wrapper & Pills
  subTabWrapper: {
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  subTabScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  subTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  activeSubTabPill: {
    backgroundColor: 'rgba(255, 215, 0, 0.16)',
    borderColor: '#FFD700',
  },
  inactiveSubTabPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  subTabText: {
    fontSize: 12,
  },
  subTabBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  subTabBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },

  // Content scroll
  contentScroll: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FCD34D',
  },
  sectionSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  clearText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '700',
  },

  // Summary Metrics Card
  summaryBannerCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 18,
  },
  summaryBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryStatBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  summaryStatNumber: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  summaryStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 2,
    textAlign: 'center',
  },

  // History Item Card (Filtered, Reservation & Borrow)
  historyItemCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
    marginBottom: 12,
  },
  historyCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyCardIconSquare: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginRight: 12,
  },
  historyCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  historyCardAuthor: {
    fontSize: 12.5,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  claimCountdownBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
    gap: 6,
  },
  claimCountdownText: {
    fontSize: 11,
    fontWeight: '800',
  },
  historyCardDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  historyDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyDetailText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  historyCardActionBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyCardActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Empty State Card
  emptyCardContainer: {
    backgroundColor: '#111A2E',
    borderRadius: 20,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
    marginTop: 6,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
  },
  emptyActionBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },

  // Prompt / Search History Items
  timestampDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1E293B',
  },
  timestampText: {
    color: '#64748B',
    fontSize: 11,
    marginHorizontal: 10,
    fontWeight: '600',
  },
  historyCapsuleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  historyIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginRight: 12,
  },
  historyQueryText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },

  // Badges & Counter
  countBadgePill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },

  // Favorites Card
  favoriteBookCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  favBookTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  favDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favAuthorText: {
    fontSize: 12.5,
    color: '#94A3B8',
  },
  bookmarkTouchArea: {
    padding: 4,
  },
});