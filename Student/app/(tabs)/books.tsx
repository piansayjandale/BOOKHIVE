import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
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
  getPendingTransactions,
  formatBorrowDateTime,
  syncTransactionsWithBackend,
  ReservationBook,
} from '../../data/store';

type MainTabType = 'Pending' | 'Favorites' | 'History';
type HistoryFilterType = 'All' | 'Filtered' | 'Prompted' | 'Reservation' | 'Borrow';

export default function BooksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();
  const { tab, subTab } = useLocalSearchParams();

  // Tab sequence: Pending, Favorites, History (as instructed by user)
  const [activeTab, setActiveTab] = useState<MainTabType>('Pending');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilterType>('All');
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [selectedBorrowDetail, setSelectedBorrowDetail] = useState<ReservationBook | null>(null);

  // Store data states
  const [searchQueries, setSearchQueries] = useState<string[]>(getSearchQueries());
  const [viewedBooks, setViewedBooks] = useState<any[]>(getViewedBooksHistory());
  const [favorites, setFavorites] = useState<any[]>(getFavoriteBooks());
  const [notifications, setNotifications] = useState<NotificationItem[]>(getNotifications());
  const [upcomingReservations, setUpcomingReservations] = useState<ReservationBook[]>(getUpcomingReservations());
  const [allReservations, setAllReservations] = useState<ReservationBook[]>(getReservations());
  const [allHistory, setAllHistory] = useState<ReservationBook[]>(getReservationHistory());
  const [libraryCardBooks, setLibraryCardBooks] = useState<ReservationBook[]>(getLibraryCardHistory());
  const [pendingTransactions, setPendingTransactions] = useState<ReservationBook[]>(getPendingTransactions());

  // Handle active tab parameter or global override passed from other screens
  useFocusEffect(
    React.useCallback(() => {
      void syncTransactionsWithBackend(true);
      const override = getBooksTabOverride();
      if (override === 'Pending') {
        setActiveTab('Pending');
      } else if (override === 'Favorites') {
        setActiveTab('Favorites');
      } else if (override === 'History' || override === 'Search History' || override === 'Filtered' || override === 'Prompted') {
        setActiveTab('History');
        if (override === 'Prompted') {
          setHistoryFilter('Prompted');
        } else if (override === 'Filtered' || override === 'Search History') {
          setHistoryFilter('Filtered');
        } else {
          setHistoryFilter('All');
        }
      } else if (tab === 'Pending') {
        setActiveTab('Pending');
        router.setParams({ tab: '' });
      } else if (tab === 'Favorites') {
        setActiveTab('Favorites');
        router.setParams({ tab: '' });
      } else if (tab === 'History' || tab === 'Search History' || tab === 'Filtered' || tab === 'Prompted') {
        setActiveTab('History');
        if (tab === 'Prompted') {
          setHistoryFilter('Prompted');
        } else if (tab === 'Filtered') {
          setHistoryFilter('Filtered');
        } else {
          setHistoryFilter('All');
        }
        router.setParams({ tab: '' });
      }

      if (subTab === 'Reservation History' || subTab === 'Reservation') {
        setActiveTab('History');
        setHistoryFilter('Reservation');
        router.setParams({ subTab: '' });
      } else if (subTab === 'Borrow History' || subTab === 'Borrow') {
        setActiveTab('History');
        setHistoryFilter('Borrow');
        router.setParams({ subTab: '' });
      } else if (subTab === 'Prompted') {
        setActiveTab('History');
        setHistoryFilter('Prompted');
        router.setParams({ subTab: '' });
      } else if (subTab === 'Filtered') {
        setActiveTab('History');
        setHistoryFilter('Filtered');
        router.setParams({ subTab: '' });
      }
    }, [tab, subTab, router])
  );

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
      setPendingTransactions(getPendingTransactions());
    };

    updateStoreData();
    const unsubscribe = subscribe(updateStoreData);
    return unsubscribe;
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Deduplicated Unified Reservation List (excluding pending waitlist/approvals which go to Pending tab)
  const reservationList = useMemo(() => {
    const seenIds = new Set<string>();
    const list: ReservationBook[] = [];

    const tryAdd = (item: ReservationBook) => {
      if (!item || !item.id || seenIds.has(item.id)) return;
      const isRes = item.action === 'Reserve' || (item as any).type === 'Reservation' || item.status === 'Reserved';
      if (!isRes) return;
      if (item.status === 'Pending' || item.status === 'Waitlisted' || item.status === 'Declined' || item.status === 'Cancelled') return;
      seenIds.add(item.id);
      list.push(item);
    };

    for (const item of upcomingReservations) {
      tryAdd(item);
    }
    for (const item of allReservations) {
      tryAdd(item);
    }
    for (const item of allHistory) {
      tryAdd(item);
    }

    return list;
  }, [upcomingReservations, allReservations, allHistory]);

  // Deduplicated Unified Borrow List
  const borrowList = useMemo(() => {
    const seenIds = new Set<string>();
    const list: ReservationBook[] = [];

    for (const item of libraryCardBooks) {
      const isRes =
        item.action === 'Reserve' ||
        (item as any).type === 'Reservation' ||
        item.status === 'Reserved' ||
        item.status === 'Reservation' ||
        (item as any).dueReturnDate === 'Reservation';
      if (!isRes && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        list.push(item);
      }
    }

    for (const item of allHistory) {
      const isRes =
        item.action === 'Reserve' ||
        (item as any).type === 'Reservation' ||
        item.status === 'Reserved' ||
        item.status === 'Reservation' ||
        (item as any).dueReturnDate === 'Reservation';
      if (isRes) continue;

      const isBorrowRecord =
        item.action === 'Borrow' ||
        (item as any).type === 'Borrow' ||
        (item as any).type === 'Borrowing' ||
        item.status === 'Approved' ||
        item.status === 'Picked Up' ||
        item.status === 'On Loan' ||
        item.status === 'Completed' ||
        item.status === 'Returned' ||
        item.isReturned === true ||
        item.date === 'Returned';

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
    const bookCopies = Math.max(1, Number(book.copies || book.totalCopies || 1));
    const isAvail = book.isAvailable !== undefined 
      ? Boolean(book.isAvailable) 
      : (book.availability ? book.availability === 'Available' : (book.available !== undefined ? String(book.available) === 'true' : true));
    const availCopies = book.availableCopies !== undefined 
      ? Number(book.availableCopies) 
      : (isAvail ? bookCopies : 0);

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
        available: String(isAvail),
        status: isAvail ? 'Available' : (book.status || book.availability || 'Unavailable'),
        availableCopies: String(availCopies),
        reservedCount: String(book.reservedCount || 0),
        borrowedCount: String(book.borrowedCount || 0),
        year: book.publicationDate ? String(book.publicationDate).substring(0, 4) : (book.year ? String(book.year) : '2026'),
        publicationDate: book.publicationDate || (book.year ? `${book.year}-01-01` : '2026-09-01'),
        pages: book.pages || '320',
        language: book.language || 'EN',
        shelf: book.shelfLocation || book.callNumber || book.shelf || 'General Shelf',
        isbn: book.isbn || '',
        copies: String(bookCopies),
        volume: book.volume || 'Single Volume / None',
        edition: book.edition || 'Single Edition / None',
        accessionNumber: book.accessionNumber || '',
      },
    });
  };

  const handleReservationPress = (item: any) => {
    router.push({
      pathname: '/reservation-details',
      params: {
        from: 'books',
        id: item.id,
        title: item.title,
        author: item.author,
        isbn: item.isbn || '',
        category: item.category || item.genres || item.department || 'Circulation',
        department: item.department || 'Circulation',
        shelf: item.shelfLocation || item.callNumber || item.shelf || 'General Shelf',
        pages: String(item.pages || '320'),
        language: item.language || 'EN',
        description: item.description || item.summary || '',
        queuePosition: String(item.queuePosition || '1'),
        dateReserved: item.dateReserved || item.pickupDate || item.date || 'Today',
        available: String(item.available === 'true' || item.available === 'Available' || !!item.expiresAt),
        expiresAt: item.expiresAt || '',
        status: item.status || 'Pending',
      },
    });
  };

  // Dropdown filter options for History:
  // Note: user specifically instructed: "reservation(remove history), borrow(remove history)"
  const historyFilterOptions: {
    key: HistoryFilterType;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    count: number;
  }[] = [
    {
      key: 'All',
      label: 'All History',
      icon: 'layers-outline',
      count: viewedBooks.length + searchQueries.length + reservationList.length + borrowList.length,
    },
    {
      key: 'Filtered',
      label: 'Filtered',
      icon: 'filter-outline',
      count: viewedBooks.length,
    },
    {
      key: 'Prompted',
      label: 'Prompted',
      icon: 'chatbubble-ellipses-outline',
      count: searchQueries.length,
    },
    {
      key: 'Reservation',
      label: 'Reservation',
      icon: 'bookmark-outline',
      count: reservationList.length,
    },
    {
      key: 'Borrow',
      label: 'Borrow',
      icon: 'time-outline',
      count: borrowList.length,
    },
  ];

  const currentFilterMeta =
    historyFilterOptions.find((opt) => opt.key === historyFilter) || historyFilterOptions[0];

  // ==============================================================
  // SECTION: PENDING TRANSACTIONS (Borrow & Reservation)
  // ==============================================================
  const renderPendingSection = () => {
    return (
      <View>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: isDarkMode ? theme.accentGold : theme.textPrimary }]}>
              Pending Transactions
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
              Books awaiting librarian verification & counter approval
            </Text>
          </View>
          <View
            style={[
              styles.countBadgePill,
              !isDarkMode && { backgroundColor: '#E0F2FE', borderWidth: 1, borderColor: 'rgba(2, 116, 187, 0.25)' },
            ]}
          >
            <Text
              style={[
                styles.countBadgeText,
                !isDarkMode && { color: '#0274BB', fontWeight: '800' },
              ]}
            >
              {pendingTransactions.length} Pending
            </Text>
          </View>
        </View>

        {pendingTransactions.length === 0 ? (
          <View style={[styles.emptyCardContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7' },
              ]}
            >
              <Ionicons name="hourglass-outline" size={32} color={isDarkMode ? '#FCD34D' : '#D97706'} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              No Pending Transactions
            </Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Any book borrow or reservation requests currently waiting for librarian approval will show up here.
            </Text>
            <TouchableOpacity
              style={[styles.emptyActionBtn, { backgroundColor: isDarkMode ? theme.accentGold : theme.accentBlue }]}
              onPress={() => router.push('/search')}
              activeOpacity={0.8}
            >
              <Ionicons name="search" size={15} color={isDarkMode ? '#080F1E' : '#FFFFFF'} style={{ marginRight: 6 }} />
              <Text style={[styles.emptyActionBtnText, { color: isDarkMode ? '#080F1E' : '#FFFFFF' }]}>
                Explore Books to Borrow or Reserve
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          pendingTransactions.map((item, index) => {
            const isReservation =
              item.action === 'Reserve' ||
              (item as any).type === 'Reservation' ||
              item.status === 'Reserved' ||
              item.status === 'Waitlisted';

            const requestDate =
              item.dateReserved ||
              item.borrowDate ||
              item.pickupDate ||
              (item.date !== 'Returned' ? item.date : undefined) ||
              'Pending Librarian Review';

            return (
              <TouchableOpacity
                key={`pending-tx-${item.id || index}-${index}`}
                style={[styles.historyItemCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                onPress={() => {
                  if (isReservation) {
                    handleReservationPress(item);
                  } else {
                    setSelectedBorrowDetail(item);
                  }
                }}
                activeOpacity={0.85}
              >
                <View style={styles.historyCardTopRow}>
                  <View
                    style={[
                      styles.historyCardIconSquare,
                      isReservation
                        ? {
                            backgroundColor: isDarkMode ? 'rgba(168, 85, 247, 0.15)' : '#F3E8FF',
                            borderColor: isDarkMode ? 'rgba(168, 85, 247, 0.35)' : '#D8B4FE',
                          }
                        : {
                            backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7',
                            borderColor: isDarkMode ? 'rgba(245, 158, 11, 0.35)' : '#FDE68A',
                          },
                    ]}
                  >
                    <Ionicons
                      name={isReservation ? 'bookmark' : 'hourglass-outline'}
                      size={16}
                      color={isReservation ? '#A855F7' : isDarkMode ? '#FCD34D' : '#D97706'}
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
                  <View
                    style={[
                      styles.statusPill,
                      isReservation
                        ? { backgroundColor: 'rgba(168, 85, 247, 0.15)', borderColor: '#A855F7' }
                        : { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#F59E0B' },
                    ]}
                  >
                    <Ionicons
                      name={isReservation ? 'bookmark-outline' : 'hourglass-outline'}
                      size={11}
                      color={isReservation ? '#C084FC' : isDarkMode ? '#FCD34D' : '#D97706'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.statusPillText,
                        isReservation
                          ? { color: '#C084FC' }
                          : { color: isDarkMode ? '#FCD34D' : '#D97706' },
                      ]}
                    >
                      {isReservation
                        ? item.queuePosition
                          ? `WAITLIST #${item.queuePosition}`
                          : 'PENDING RESERVATION'
                        : 'PENDING BORROW'}
                    </Text>
                  </View>
                </View>

                {/* Pending Verification Banner */}
                <View
                  style={[
                    styles.claimCountdownBanner,
                    {
                      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                      borderColor: isDarkMode ? theme.cardBorder : '#E2E8F0',
                    },
                  ]}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={14}
                    color={isDarkMode ? '#94A3B8' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.claimCountdownText,
                      { color: isDarkMode ? '#94A3B8' : '#64748B', fontWeight: '600' },
                    ]}
                  >
                    Awaiting librarian counter confirmation & release
                  </Text>
                </View>

                {/* Details Row */}
                <View
                  style={[
                    styles.historyCardDetailsRow,
                    { borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
                  ]}
                >
                  <View style={styles.historyDetailItem}>
                    <Ionicons name="calendar-outline" size={13} color={theme.textSecondary} />
                    <Text style={[styles.historyDetailText, { color: theme.textSecondary }]}>
                      Requested: {requestDate}
                    </Text>
                  </View>

                  <View style={styles.historyDetailItem}>
                    <Ionicons name="business-outline" size={13} color={theme.textSecondary} />
                    <Text style={[styles.historyDetailText, { color: theme.textSecondary }]}>
                      {item.department || item.category || 'Circulation Desk'}
                    </Text>
                  </View>
                </View>

                {/* Action Button */}
                <TouchableOpacity
                  style={[
                    styles.historyCardActionBtn,
                    {
                      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#F0F7FF',
                      borderColor: isDarkMode ? theme.cardBorder : 'rgba(2, 116, 187, 0.2)',
                    },
                  ]}
                  onPress={() => {
                    if (isReservation) {
                      handleReservationPress(item);
                    } else {
                      setSelectedBorrowDetail(item);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.historyCardActionBtnText,
                      { color: isDarkMode ? '#FCD34D' : theme.accentBlue },
                    ]}
                  >
                    {isReservation ? 'View Reservation Details' : 'View Borrow Request Details'}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={isDarkMode ? '#FCD34D' : theme.accentBlue}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    );
  };

  // ==============================================================
  // SECTION: FAVORITES VIEW
  // ==============================================================
  const renderFavoritesSection = () => {
    return (
      <View>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? theme.accentGold : theme.textPrimary }]}>
            Favorite Books
          </Text>
          <View
            style={[
              styles.countBadgePill,
              !isDarkMode && { backgroundColor: '#E0F2FE', borderWidth: 1, borderColor: 'rgba(2, 116, 187, 0.25)' },
            ]}
          >
            <Text style={[styles.countBadgeText, !isDarkMode && { color: '#0274BB', fontWeight: '800' }]}>
              {favorites.length} Saved
            </Text>
          </View>
        </View>

        {favorites.length === 0 ? (
          <View style={[styles.emptyCardContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: isDarkMode ? 'rgba(255, 215, 0, 0.12)' : '#FEF9C3' },
              ]}
            >
              <Ionicons name="bookmark-outline" size={32} color={isDarkMode ? theme.accentGold : '#854D0E'} />
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
              <Ionicons name="search" size={15} color={isDarkMode ? '#080F1E' : '#FFFFFF'} style={{ marginRight: 6 }} />
              <Text style={[styles.emptyActionBtnText, { color: isDarkMode ? '#080F1E' : '#FFFFFF' }]}>
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
                <View
                  style={
                    !isDarkMode
                      ? {
                          backgroundColor: '#E0F2FE',
                          borderRadius: 8,
                          padding: 6,
                          borderWidth: 1,
                          borderColor: 'rgba(2, 116, 187, 0.25)',
                        }
                      : { padding: 4 }
                  }
                >
                  <Ionicons name="bookmark" size={18} color={isDarkMode ? '#FFD700' : '#0274BB'} />
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </View>
    );
  };

  // ==============================================================
  // SECTION: FILTERED BOOKS
  // ==============================================================
  const renderFilteredSection = (isCombined = false) => {
    if (isCombined && viewedBooks.length === 0) return null;

    return (
      <View style={isCombined ? { marginBottom: 24 } : undefined}>
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
              <Text style={[styles.clearText, { color: isDarkMode ? '#38BDF8' : theme.accentBlue }]}>
                Clear All
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {viewedBooks.length === 0 ? (
          <View style={[styles.emptyCardContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: isDarkMode ? 'rgba(2, 116, 187, 0.15)' : '#E0F2FE' },
              ]}
            >
              <Ionicons name="filter-outline" size={32} color={isDarkMode ? '#38BDF8' : '#0274BB'} />
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
              <Ionicons name="search" size={15} color={isDarkMode ? '#080F1E' : '#FFFFFF'} style={{ marginRight: 6 }} />
              <Text style={[styles.emptyActionBtnText, { color: isDarkMode ? '#080F1E' : '#FFFFFF' }]}>
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
                <View
                  style={[
                    styles.historyCardIconSquare,
                    {
                      backgroundColor: isDarkMode ? 'rgba(2, 116, 187, 0.15)' : '#E0F2FE',
                      borderColor: isDarkMode ? 'rgba(2, 116, 187, 0.3)' : 'rgba(2, 116, 187, 0.25)',
                    },
                  ]}
                >
                  <Ionicons name="book" size={16} color={isDarkMode ? '#38BDF8' : '#0274BB'} />
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

              <View
                style={[
                  styles.historyCardDetailsRow,
                  { borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
                ]}
              >
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
                style={[
                  styles.historyCardActionBtn,
                  {
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#F0F7FF',
                    borderColor: isDarkMode ? theme.cardBorder : 'rgba(2, 116, 187, 0.2)',
                  },
                ]}
                onPress={() => handleBookPress(book)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.historyCardActionBtnText,
                    { color: isDarkMode ? '#FCD34D' : theme.accentBlue },
                  ]}
                >
                  View Book Details
                </Text>
                <Ionicons name="chevron-forward" size={14} color={isDarkMode ? '#FCD34D' : theme.accentBlue} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    );
  };

  // ==============================================================
  // SECTION: PROMPTED INQUIRIES
  // ==============================================================
  const renderPromptedSection = (isCombined = false) => {
    if (isCombined && searchQueries.length === 0) return null;

    return (
      <View style={isCombined ? { marginBottom: 24 } : undefined}>
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
              <Text style={[styles.clearText, { color: isDarkMode ? '#38BDF8' : theme.accentBlue }]}>
                Clear All
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {searchQueries.length === 0 ? (
          <View style={[styles.emptyCardContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: isDarkMode ? 'rgba(255, 215, 0, 0.12)' : '#FEF9C3' },
              ]}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={32} color={isDarkMode ? theme.accentGold : '#854D0E'} />
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
              <Ionicons name="search" size={15} color={isDarkMode ? '#080F1E' : '#FFFFFF'} style={{ marginRight: 6 }} />
              <Text style={[styles.emptyActionBtnText, { color: isDarkMode ? '#080F1E' : '#FFFFFF' }]}>
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
                  <View
                    style={[
                      styles.historyIconBox,
                      {
                        backgroundColor: isDarkMode ? 'rgba(255, 215, 0, 0.12)' : '#E0F2FE',
                        borderColor: isDarkMode ? 'rgba(255, 215, 0, 0.25)' : 'rgba(2, 116, 187, 0.25)',
                      },
                    ]}
                  >
                    <Ionicons name="sparkles" size={14} color={isDarkMode ? theme.accentGold : '#0274BB'} />
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
    );
  };

  // ==============================================================
  // SECTION: RESERVATION RECORDS
  // ==============================================================
  const renderReservationSection = (isCombined = false) => {
    if (isCombined && reservationList.length === 0) return null;

    return (
      <View style={isCombined ? { marginBottom: 24 } : undefined}>
        {!isCombined && (
          <View style={[styles.summaryBannerCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={styles.summaryBannerRow}>
              <View style={[styles.summaryStatBox, { borderRightColor: theme.cardBorder, borderRightWidth: 1 }]}>
                <Text style={[styles.summaryStatNumber, { color: theme.textPrimary }]}>
                  {reservationList.length}
                </Text>
                <Text style={[styles.summaryStatLabel, !isDarkMode && { color: theme.accentBlue }]}>
                  Total Reservations
                </Text>
              </View>
              <View style={[styles.summaryStatBox, { borderRightColor: theme.cardBorder, borderRightWidth: 1 }]}>
                <Text style={[styles.summaryStatNumber, { color: '#C084FC' }]}>
                  {reservationList.filter((r) => r.status === 'Pending' || r.queuePosition !== undefined).length}
                </Text>
                <Text style={styles.summaryStatLabel}>In Waitlist</Text>
              </View>
              <View style={styles.summaryStatBox}>
                <Text style={[styles.summaryStatNumber, { color: '#10B981' }]}>
                  {reservationList.filter((r) => r.status === 'Approved' || r.available === 'true').length}
                </Text>
                <Text style={styles.summaryStatLabel}>Ready / Active</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.sectionTitle }]}>
            Reservation Records
          </Text>
          <View
            style={[
              styles.countBadgePill,
              {
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E0F2FE',
                borderColor: isDarkMode ? theme.cardBorder : 'rgba(2, 116, 187, 0.25)',
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[styles.countBadgeText, { color: isDarkMode ? '#FCD34D' : '#0274BB' }]}>
              {reservationList.length} Records
            </Text>
          </View>
        </View>

        {reservationList.length === 0 ? (
          <View style={[styles.emptyCardContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: isDarkMode ? 'rgba(168, 85, 247, 0.12)' : '#F3E8FF' },
              ]}
            >
              <Ionicons name="bookmark-outline" size={32} color="#A855F7" />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              No Reservation Records
            </Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Books you reserve when all copies are checked out will appear here with queue positions and status updates.
            </Text>
            <TouchableOpacity
              style={[styles.emptyActionBtn, { backgroundColor: isDarkMode ? theme.accentGold : theme.accentBlue }]}
              onPress={() => router.push('/search')}
              activeOpacity={0.8}
            >
              <Ionicons name="search" size={15} color={isDarkMode ? '#080F1E' : '#FFFFFF'} style={{ marginRight: 6 }} />
              <Text style={[styles.emptyActionBtnText, { color: isDarkMode ? '#080F1E' : '#FFFFFF' }]}>
                Find Books to Reserve
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          reservationList.map((item, idx) => {
            const countdown = getReservationCountdown(item);
            const isClaimReady = item.available === 'true' || !!item.expiresAt;
            const isPending = item.status === 'Pending' || item.queuePosition !== undefined;
            const isApproved = item.status === 'Approved';
            const isCompleted = item.status === 'Completed';

            return (
              <TouchableOpacity
                key={`res-item-${item.id || idx}-${idx}`}
                style={[styles.historyItemCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                onPress={() => handleReservationPress(item)}
                activeOpacity={0.85}
              >
                <View style={styles.historyCardTopRow}>
                  <View
                    style={[
                      styles.historyCardIconSquare,
                      {
                        backgroundColor: isDarkMode ? 'rgba(168, 85, 247, 0.12)' : '#F3E8FF',
                        borderColor: isDarkMode ? 'rgba(168, 85, 247, 0.3)' : '#D8B4FE',
                      },
                    ]}
                  >
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
                  <View
                    style={[
                      styles.statusPill,
                      isClaimReady
                        ? { backgroundColor: 'rgba(168, 85, 247, 0.15)', borderColor: '#A855F7' }
                        : isPending
                        ? { backgroundColor: 'rgba(168, 85, 247, 0.15)', borderColor: '#A855F7' }
                        : isApproved
                        ? { backgroundColor: 'rgba(168, 85, 247, 0.15)', borderColor: '#A855F7' }
                        : isCompleted
                        ? {
                            backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.15)' : '#E0F2FE',
                            borderColor: isDarkMode ? '#38BDF8' : 'rgba(2, 116, 187, 0.3)',
                          }
                        : { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#EF4444' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        isClaimReady
                          ? { color: '#C084FC' }
                          : isPending
                          ? { color: '#C084FC' }
                          : isApproved
                          ? { color: '#C084FC' }
                          : isCompleted
                          ? { color: isDarkMode ? '#38BDF8' : '#0274BB' }
                          : { color: '#EF4444' },
                      ]}
                    >
                      {isClaimReady
                        ? 'READY TO BORROW'
                        : isPending
                        ? `WAITLIST #${item.queuePosition || 1}`
                        : isApproved
                        ? 'RESERVED'
                        : isCompleted
                        ? 'CLAIMED'
                        : 'CANCELLED'}
                    </Text>
                  </View>
                </View>

                {/* Countdown banner if copy is ready for 24h pickup */}
                {isClaimReady && (
                  <View
                    style={[
                      styles.claimCountdownBanner,
                      {
                        backgroundColor: countdown.isUrgent ? 'rgba(239, 68, 68, 0.12)' : 'rgba(168, 85, 247, 0.12)',
                        borderColor: countdown.isUrgent ? '#EF4444' : '#A855F7',
                      },
                    ]}
                  >
                    <Ionicons name="timer-outline" size={15} color={countdown.isUrgent ? '#EF4444' : '#A855F7'} />
                    <Text style={[styles.claimCountdownText, { color: countdown.isUrgent ? '#EF4444' : '#A855F7' }]}>
                      Pickup Window: {countdown.text}
                    </Text>
                  </View>
                )}

                {/* Timeline & Metadata */}
                <View
                  style={[
                    styles.historyCardDetailsRow,
                    { borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
                  ]}
                >
                  <View style={styles.historyDetailItem}>
                    <Ionicons name="calendar-outline" size={13} color={theme.textSecondary} />
                    <Text style={[styles.historyDetailText, { color: theme.textSecondary }]}>
                      Reserved: {item.dateReserved || item.pickupDate || item.date || 'Requested'}
                    </Text>
                  </View>
                  <View style={styles.historyDetailItem}>
                    <Ionicons name="people-outline" size={13} color={isDarkMode ? '#A855F7' : '#7C3AED'} />
                    <Text style={[styles.historyDetailText, { color: isDarkMode ? '#C084FC' : '#6D28D9' }]}>
                      1st-Come, 1st-Served
                    </Text>
                  </View>
                </View>

                {/* Action Button */}
                <TouchableOpacity
                  style={[
                    styles.historyCardActionBtn,
                    {
                      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#F0F7FF',
                      borderColor: isDarkMode ? theme.cardBorder : 'rgba(2, 116, 187, 0.2)',
                    },
                  ]}
                  onPress={() => handleReservationPress(item)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.historyCardActionBtnText, { color: isDarkMode ? '#FCD34D' : theme.accentBlue }]}>
                    View Reservation Details
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={isDarkMode ? '#FCD34D' : theme.accentBlue} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    );
  };

  // ==============================================================
  // SECTION: BORROWING RECORDS
  // ==============================================================
  const renderBorrowSection = (isCombined = false) => {
    if (isCombined && borrowList.length === 0) return null;

    return (
      <View style={isCombined ? { marginBottom: 24 } : undefined}>
        {!isCombined && (
          <View style={[styles.summaryBannerCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={styles.summaryBannerRow}>
              <View style={[styles.summaryStatBox, { borderRightColor: theme.cardBorder, borderRightWidth: 1 }]}>
                <Text style={[styles.summaryStatNumber, { color: theme.textPrimary }]}>
                  {
                    borrowList.filter(
                      (b) =>
                        b.status === 'Approved' ||
                        b.status === 'Picked Up' ||
                        b.status === 'On Loan' ||
                        b.status === 'Completed' ||
                        b.status === 'Returned' ||
                        b.isReturned ||
                        b.date === 'Returned'
                    ).length
                  }
                </Text>
                <Text style={[styles.summaryStatLabel, !isDarkMode && { color: theme.accentBlue }]}>
                  Total Borrowed
                </Text>
              </View>
              <View style={[styles.summaryStatBox, { borderRightColor: theme.cardBorder, borderRightWidth: 1 }]}>
                <Text style={[styles.summaryStatNumber, { color: '#10B981' }]}>
                  {
                    borrowList.filter(
                      (b) =>
                        (b.status === 'Approved' || b.status === 'Picked Up' || b.status === 'On Loan' || b.isPickedUp) &&
                        !b.isReturned &&
                        b.date !== 'Returned' &&
                        b.status !== 'Completed' &&
                        b.status !== 'Returned'
                    ).length
                  }
                </Text>
                <Text style={[styles.summaryStatLabel, { color: '#10B981' }]}>Active Loans</Text>
              </View>
              <View style={styles.summaryStatBox}>
                <Text style={[styles.summaryStatNumber, { color: isDarkMode ? '#38BDF8' : theme.accentBlue }]}>
                  {
                    borrowList.filter(
                      (b) =>
                        b.status === 'Completed' ||
                        b.status === 'Returned' ||
                        b.isReturned ||
                        b.date === 'Returned'
                    ).length
                  }
                </Text>
                <Text style={[styles.summaryStatLabel, { color: isDarkMode ? '#38BDF8' : theme.accentBlue }]}>
                  Returned
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.sectionTitle }]}>
            Borrowing Records
          </Text>
          <View
            style={[
              styles.countBadgePill,
              {
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E0F2FE',
                borderColor: isDarkMode ? theme.cardBorder : 'rgba(2, 116, 187, 0.25)',
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[styles.countBadgeText, { color: isDarkMode ? '#FCD34D' : '#0274BB' }]}>
              {borrowList.length} Records
            </Text>
          </View>
        </View>

        {borrowList.length === 0 ? (
          <View style={[styles.emptyCardContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: isDarkMode ? 'rgba(2, 116, 187, 0.15)' : '#E0F2FE' },
              ]}
            >
              <Ionicons name="library-outline" size={32} color={isDarkMode ? '#38BDF8' : '#0274BB'} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              No Borrow Records
            </Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Books you borrow from the circulation desk will appear here with active loan dates and return history.
            </Text>
            <TouchableOpacity
              style={[styles.emptyActionBtn, { backgroundColor: isDarkMode ? theme.accentGold : theme.accentBlue }]}
              onPress={() => router.push('/search')}
              activeOpacity={0.8}
            >
              <Ionicons name="book-outline" size={15} color={isDarkMode ? '#080F1E' : '#FFFFFF'} style={{ marginRight: 6 }} />
              <Text style={[styles.emptyActionBtnText, { color: isDarkMode ? '#080F1E' : '#FFFFFF' }]}>
                Browse Catalog
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          borrowList.map((item, idx) => {
            const isReturned =
              item.status === 'Completed' ||
              item.status === 'Returned' ||
              item.isReturned ||
              item.date === 'Returned';
            const isPickedUp = !isReturned && (item.status === 'Picked Up' || Boolean(item.isPickedUp || item.pickedUpAt));
            const isApprovedWaitingPickup = !isReturned && !isPickedUp && item.status === 'Approved';
            const isPending =
              !isReturned &&
              !isPickedUp &&
              !isApprovedWaitingPickup &&
              (item.status === 'Pending' || (item.action === 'Borrow' && item.status === 'Upcoming'));
            const isActiveLoan = (isPickedUp || isApprovedWaitingPickup || item.status === 'On Loan') && !isReturned;
            const countdown = isApprovedWaitingPickup ? getReservationCountdown(item) : null;

            const borrowDateFormatted =
              item.borrowDate ||
              item.pickupDate ||
              item.dateReserved ||
              (item.date !== 'Returned' ? item.date : undefined);
            const returnDateFormatted =
              item.returnDate || (item.date && item.date !== 'Returned' ? item.date : 'Done');

            return (
              <TouchableOpacity
                key={`borrow-item-${item.id || idx}-${idx}`}
                style={[styles.historyItemCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                onPress={() => setSelectedBorrowDetail(item)}
                activeOpacity={0.75}
              >
                <View style={styles.historyCardTopRow}>
                  <View
                    style={[
                      styles.historyCardIconSquare,
                      isReturned
                        ? {
                            backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.15)' : '#E0F2FE',
                            borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.3)' : 'rgba(2, 116, 187, 0.25)',
                          }
                        : isPickedUp
                        ? { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' }
                        : isApprovedWaitingPickup
                        ? {
                            backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.15)' : '#E0F2FE',
                            borderColor: isDarkMode ? '#38BDF8' : 'rgba(2, 116, 187, 0.3)',
                          }
                        : { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)' },
                    ]}
                  >
                    <Ionicons
                      name={
                        isReturned
                          ? 'checkmark-circle'
                          : isPickedUp
                          ? 'book'
                          : isApprovedWaitingPickup
                          ? 'time'
                          : 'hourglass-outline'
                      }
                      size={16}
                      color={
                        isReturned
                          ? isDarkMode
                            ? '#38BDF8'
                            : '#0274BB'
                          : isPickedUp
                          ? '#10B981'
                          : isApprovedWaitingPickup
                          ? isDarkMode
                            ? '#38BDF8'
                            : '#0274BB'
                          : '#F59E0B'
                      }
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
                  <View
                    style={[
                      styles.statusPill,
                      isReturned
                        ? {
                            backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.15)' : '#E0F2FE',
                            borderColor: isDarkMode ? '#38BDF8' : 'rgba(2, 116, 187, 0.35)',
                          }
                        : isPickedUp
                        ? { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981' }
                        : isApprovedWaitingPickup
                        ? {
                            backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.15)' : '#E0F2FE',
                            borderColor: isDarkMode ? '#38BDF8' : 'rgba(2, 116, 187, 0.35)',
                          }
                        : { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#F59E0B' },
                    ]}
                  >
                    {isReturned && (
                      <Ionicons
                        name="checkmark-circle"
                        size={12}
                        color={isDarkMode ? '#38BDF8' : '#0274BB'}
                        style={{ marginRight: 4 }}
                      />
                    )}
                    {isPickedUp && (
                      <Ionicons name="checkmark-done" size={12} color="#10B981" style={{ marginRight: 4 }} />
                    )}
                    {isApprovedWaitingPickup && (
                      <Ionicons
                        name="time-outline"
                        size={12}
                        color={isDarkMode ? '#38BDF8' : '#0274BB'}
                        style={{ marginRight: 4 }}
                      />
                    )}
                    {isPending && (
                      <Ionicons name="hourglass-outline" size={12} color="#F59E0B" style={{ marginRight: 4 }} />
                    )}
                    <Text
                      style={[
                        styles.statusPillText,
                        isReturned
                          ? { color: isDarkMode ? '#38BDF8' : '#0274BB' }
                          : isPickedUp
                          ? { color: '#10B981' }
                          : isApprovedWaitingPickup
                          ? { color: isDarkMode ? '#38BDF8' : '#0274BB' }
                          : { color: '#F59E0B' },
                      ]}
                    >
                      {isReturned
                        ? 'RETURNED'
                        : isPickedUp
                        ? 'BORROWED (PICKED UP)'
                        : isApprovedWaitingPickup
                        ? 'READY FOR PICKUP'
                        : 'BORROW PENDING'}
                    </Text>
                  </View>
                </View>

                {/* Pickup countdown banner */}
                {isApprovedWaitingPickup && countdown?.text && (
                  <View
                    style={[
                      styles.claimCountdownBanner,
                      {
                        backgroundColor: countdown.isUrgent ? 'rgba(239, 68, 68, 0.12)' : 'rgba(56, 189, 248, 0.12)',
                        borderColor: countdown.isUrgent ? '#EF4444' : '#38BDF8',
                        marginTop: 8,
                      },
                    ]}
                  >
                    <Ionicons name="timer-outline" size={15} color={countdown.isUrgent ? '#EF4444' : '#38BDF8'} />
                    <Text style={[styles.claimCountdownText, { color: countdown.isUrgent ? '#EF4444' : '#38BDF8' }]}>
                      Pickup Window: {countdown.text}
                    </Text>
                  </View>
                )}

                {/* Timeline & Metadata */}
                <View
                  style={[
                    styles.historyCardDetailsRow,
                    { borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
                  ]}
                >
                  <View style={styles.historyDetailItem}>
                    <Ionicons name="log-out-outline" size={13} color={theme.textSecondary} />
                    <Text style={[styles.historyDetailText, { color: theme.textSecondary }]}>
                      {isPickedUp
                        ? `Picked Up: ${item.pickupDate || borrowDateFormatted || 'Today'}`
                        : `Borrowed: ${borrowDateFormatted || 'Active'}`}
                    </Text>
                  </View>

                  <View style={styles.historyDetailItem}>
                    <Ionicons
                      name={isReturned ? 'checkmark-done-outline' : 'alarm-outline'}
                      size={13}
                      color={isReturned ? (isDarkMode ? '#38BDF8' : theme.accentBlue) : isActiveLoan ? '#10B981' : theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.historyDetailText,
                        {
                          color: isReturned
                            ? isDarkMode
                              ? '#38BDF8'
                              : theme.accentBlue
                            : isActiveLoan
                            ? '#10B981'
                            : theme.textSecondary,
                        },
                      ]}
                    >
                      {isReturned ? `Returned: ${returnDateFormatted}` : `Due: ${item.returnDate || item.date || '7 Days'}`}
                    </Text>
                  </View>
                </View>

                {/* Action Button */}
                <TouchableOpacity
                  style={[
                    styles.historyCardActionBtn,
                    {
                      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#F0F7FF',
                      borderColor: isDarkMode ? theme.cardBorder : 'rgba(2, 116, 187, 0.2)',
                    },
                  ]}
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    handleBookPress(item);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.historyCardActionBtnText, { color: isDarkMode ? '#FCD34D' : theme.accentBlue }]}>
                    View Book Details
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={isDarkMode ? '#FCD34D' : theme.accentBlue} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    );
  };

  // ==============================================================
  // SECTION: COMBINED ALL HISTORY VIEW
  // ==============================================================
  const renderCombinedHistoryView = () => {
    const totalCount =
      viewedBooks.length + searchQueries.length + reservationList.length + borrowList.length;

    return (
      <View>
        {/* Comprehensive Metrics Bar */}
        <View style={[styles.summaryBannerCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={styles.summaryBannerRow}>
            <TouchableOpacity
              style={[styles.summaryStatBox, { borderRightColor: theme.cardBorder, borderRightWidth: 1 }]}
              onPress={() => setHistoryFilter('Filtered')}
              activeOpacity={0.7}
            >
              <Text style={[styles.summaryStatNumber, { color: isDarkMode ? '#38BDF8' : theme.accentBlue }]}>
                {viewedBooks.length}
              </Text>
              <Text style={styles.summaryStatLabel}>Filtered</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.summaryStatBox, { borderRightColor: theme.cardBorder, borderRightWidth: 1 }]}
              onPress={() => setHistoryFilter('Prompted')}
              activeOpacity={0.7}
            >
              <Text style={[styles.summaryStatNumber, { color: isDarkMode ? theme.accentGold : '#854D0E' }]}>
                {searchQueries.length}
              </Text>
              <Text style={styles.summaryStatLabel}>Prompted</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.summaryStatBox, { borderRightColor: theme.cardBorder, borderRightWidth: 1 }]}
              onPress={() => setHistoryFilter('Reservation')}
              activeOpacity={0.7}
            >
              <Text style={[styles.summaryStatNumber, { color: '#C084FC' }]}>
                {reservationList.length}
              </Text>
              <Text style={styles.summaryStatLabel}>Reservation</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.summaryStatBox}
              onPress={() => setHistoryFilter('Borrow')}
              activeOpacity={0.7}
            >
              <Text style={[styles.summaryStatNumber, { color: '#10B981' }]}>
                {borrowList.length}
              </Text>
              <Text style={styles.summaryStatLabel}>Borrow</Text>
            </TouchableOpacity>
          </View>
        </View>

        {totalCount === 0 ? (
          <View style={[styles.emptyCardContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: isDarkMode ? 'rgba(255, 215, 0, 0.12)' : '#FEF9C3' },
              ]}
            >
              <Ionicons name="time-outline" size={32} color={isDarkMode ? theme.accentGold : '#854D0E'} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              No History Logs Yet
            </Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Your filtered book views, search prompts, reservations, and borrow records will all be recorded here.
            </Text>
            <TouchableOpacity
              style={[styles.emptyActionBtn, { backgroundColor: isDarkMode ? theme.accentGold : theme.accentBlue }]}
              onPress={() => router.push('/search')}
              activeOpacity={0.8}
            >
              <Ionicons name="search" size={15} color={isDarkMode ? '#080F1E' : '#FFFFFF'} style={{ marginRight: 6 }} />
              <Text style={[styles.emptyActionBtnText, { color: isDarkMode ? '#080F1E' : '#FFFFFF' }]}>
                Explore Catalog
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {renderFilteredSection(true)}
            {renderPromptedSection(true)}
            {renderReservationSection(true)}
            {renderBorrowSection(true)}
          </View>
        )}
      </View>
    );
  };

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

      {/* SEGMENTED MAIN TAB SELECTOR (Pending | Favorites | History) */}
      <View style={styles.tabContainer}>
        {(['Pending', 'Favorites', 'History'] as MainTabType[]).map((tabName) => {
          const isActive = activeTab === tabName;
          const badgeCount =
            tabName === 'Pending'
              ? pendingTransactions.length
              : tabName === 'Favorites'
              ? favorites.length
              : viewedBooks.length + searchQueries.length + reservationList.length + borrowList.length;

          return (
            <TouchableOpacity
              key={tabName}
              style={[
                styles.tabPill,
                isActive
                  ? [styles.activeTabPill, !isDarkMode && { backgroundColor: theme.accentBlue }]
                  : [styles.inactiveTabPill, !isDarkMode && { backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.cardBorder }],
              ]}
              onPress={() => {
                setActiveTab(tabName);
                setDropdownOpen(false);
              }}
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
              {badgeCount > 0 && (
                <View
                  style={[
                    styles.tabPillBadge,
                    isActive
                      ? { backgroundColor: isDarkMode ? '#080F1E' : '#FFFFFF' }
                      : { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabPillBadgeText,
                      isActive
                        ? { color: isDarkMode ? theme.accentGold : theme.accentBlue }
                        : { color: theme.textSecondary },
                    ]}
                  >
                    {badgeCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* HISTORY DROPDOWN FILTER BAR (Shown when activeTab === 'History') */}
      {activeTab === 'History' && (
        <View style={styles.dropdownOuterWrapper}>
          <TouchableOpacity
            style={[
              styles.dropdownTriggerBar,
              {
                backgroundColor: isDarkMode ? '#111A2E' : '#FFFFFF',
                borderColor: dropdownOpen
                  ? (isDarkMode ? theme.accentGold : theme.accentBlue)
                  : (isDarkMode ? '#1E293B' : '#CBD5E1'),
              },
            ]}
            onPress={() => setDropdownOpen((prev) => !prev)}
            activeOpacity={0.8}
          >
            <View style={styles.dropdownTriggerContent}>
              <View
                style={[
                  styles.dropdownIconCircle,
                  {
                    backgroundColor: isDarkMode ? 'rgba(255, 215, 0, 0.14)' : '#E0F2FE',
                  },
                ]}
              >
                <Ionicons
                  name={currentFilterMeta.icon}
                  size={16}
                  color={isDarkMode ? theme.accentGold : theme.accentBlue}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.dropdownFilterSubtitle, { color: theme.textSecondary }]}>
                  History Filter
                </Text>
                <Text style={[styles.dropdownFilterTitle, { color: theme.textPrimary }]}>
                  {currentFilterMeta.label}
                </Text>
              </View>

              <View
                style={[
                  styles.dropdownCountBadge,
                  {
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                    borderColor: isDarkMode ? theme.cardBorder : '#E2E8F0',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dropdownCountBadgeText,
                    { color: isDarkMode ? theme.accentGold : theme.accentBlue },
                  ]}
                >
                  {currentFilterMeta.count}
                </Text>
              </View>

              <Ionicons
                name={dropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.textSecondary}
                style={{ marginLeft: 8 }}
              />
            </View>
          </TouchableOpacity>

          {/* DROPDOWN MENU POPOVER */}
          {dropdownOpen && (
            <View
              style={[
                styles.dropdownMenuCard,
                {
                  backgroundColor: isDarkMode ? '#111A2E' : '#FFFFFF',
                  borderColor: isDarkMode ? '#24334C' : '#CBD5E1',
                },
              ]}
            >
              {historyFilterOptions.map((opt, idx) => {
                const isSelected = historyFilter === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.dropdownMenuItem,
                      idx < historyFilterOptions.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                      },
                      isSelected && {
                        backgroundColor: isDarkMode ? 'rgba(255, 215, 0, 0.08)' : '#F0F7FF',
                      },
                    ]}
                    onPress={() => {
                      setHistoryFilter(opt.key);
                      setDropdownOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dropdownMenuItemLeft}>
                      <Ionicons
                        name={opt.icon}
                        size={16}
                        color={
                          isSelected
                            ? isDarkMode
                              ? theme.accentGold
                              : theme.accentBlue
                            : theme.textSecondary
                        }
                        style={{ marginRight: 10 }}
                      />
                      <Text
                        style={[
                          styles.dropdownMenuItemText,
                          {
                            color: isSelected
                              ? isDarkMode
                                ? theme.accentGold
                                : theme.accentBlue
                              : theme.textPrimary,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={[
                          styles.dropdownMenuItemBadge,
                          {
                            backgroundColor: isSelected
                              ? isDarkMode
                                ? 'rgba(255, 215, 0, 0.2)'
                                : 'rgba(2, 116, 187, 0.15)'
                              : isDarkMode
                              ? 'rgba(255, 255, 255, 0.06)'
                              : '#F1F5F9',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dropdownMenuItemBadgeText,
                            {
                              color: isSelected
                                ? isDarkMode
                                  ? theme.accentGold
                                  : theme.accentBlue
                                : theme.textSecondary,
                            },
                          ]}
                        >
                          {opt.count}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={isDarkMode ? theme.accentGold : theme.accentBlue}
                          style={{ marginLeft: 8 }}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* CONTENT SCROLL */}
      <ScrollView contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}>
        {activeTab === 'Pending' && renderPendingSection()}
        {activeTab === 'Favorites' && renderFavoritesSection()}
        {activeTab === 'History' && (
          <View>
            {historyFilter === 'All' && renderCombinedHistoryView()}
            {historyFilter === 'Filtered' && renderFilteredSection(false)}
            {historyFilter === 'Prompted' && renderPromptedSection(false)}
            {historyFilter === 'Reservation' && renderReservationSection(false)}
            {historyFilter === 'Borrow' && renderBorrowSection(false)}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Borrow & Return Details Modal */}
      <Modal
        visible={!!selectedBorrowDetail}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedBorrowDetail(null)}
      >
        {selectedBorrowDetail && (() => {
          const item = selectedBorrowDetail;
          const isReturned =
            item.status === 'Completed' ||
            item.status === 'Returned' ||
            item.isReturned ||
            item.date === 'Returned';
          const isPickedUp = !isReturned && (item.status === 'Picked Up' || Boolean(item.isPickedUp || item.pickedUpAt));
          const isApproved = !isReturned && !isPickedUp && item.status === 'Approved';
          const isPending = !isReturned && !isPickedUp && !isApproved;
          const countdown = isApproved ? getReservationCountdown(item) : null;
          const borrowDateText =
            item.borrowDate ||
            item.pickupDate ||
            item.dateReserved ||
            (item.date !== 'Returned' ? item.date : undefined) ||
            'Recorded';
          const returnDateText =
            item.returnDate || (item.date && item.date !== 'Returned' ? item.date : 'Returned');
          const dueDateText =
            item.dueDate || (item.date && item.date !== 'Returned' ? item.date : '7 Days');

          return (
            <View style={styles.detailModalBackdrop}>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => setSelectedBorrowDetail(null)}
              />
              <View
                style={[
                  styles.detailModalCard,
                  {
                    backgroundColor: isDarkMode ? '#111A2E' : '#FFFFFF',
                    borderColor: isDarkMode ? '#24334C' : '#CBD5E1',
                  },
                ]}
              >
                {/* Modal Header */}
                <View style={[styles.detailModalHeader, { borderBottomColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
                  <View style={styles.detailModalHeaderLeft}>
                    <View
                      style={[
                        styles.detailModalHeaderIcon,
                        {
                          backgroundColor: isReturned
                            ? isDarkMode
                              ? 'rgba(56, 189, 248, 0.15)'
                              : '#E0F2FE'
                            : isPickedUp
                            ? 'rgba(16, 185, 129, 0.15)'
                            : isApproved
                            ? isDarkMode
                              ? 'rgba(56, 189, 248, 0.15)'
                              : '#E0F2FE'
                            : 'rgba(245, 158, 11, 0.15)',
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          isReturned
                            ? 'checkmark-circle'
                            : isPickedUp
                            ? 'book'
                            : isApproved
                            ? 'time'
                            : 'hourglass-outline'
                        }
                        size={20}
                        color={
                          isReturned
                            ? isDarkMode
                              ? '#38BDF8'
                              : '#0274BB'
                            : isPickedUp
                            ? '#10B981'
                            : isApproved
                            ? isDarkMode
                              ? '#38BDF8'
                              : '#0274BB'
                            : '#F59E0B'
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.detailModalTitle, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
                        {isReturned
                          ? 'Return Details'
                          : isPickedUp
                          ? 'Borrow Loan Details'
                          : isApproved
                          ? 'Pickup Ready Details'
                          : 'Borrow Request Details'}
                      </Text>
                      <Text style={[styles.detailModalSubtitle, { color: theme.textSecondary }]}>
                        {isReturned
                          ? 'Completed Book Return Record'
                          : isPickedUp
                          ? 'Active Circulation Desk Loan'
                          : isApproved
                          ? 'Ready for Counter Pickup'
                          : 'Pending Librarian Verification'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedBorrowDetail(null)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.detailModalCloseBtn}
                  >
                    <Ionicons name="close-circle" size={24} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Book Summary Card */}
                  <View
                    style={[
                      styles.detailBookCard,
                      {
                        backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                        borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
                      },
                    ]}
                  >
                    <Text style={[styles.detailBookTitle, { color: theme.textPrimary }]}>{item.title}</Text>
                    <Text style={[styles.detailBookAuthor, { color: theme.textSecondary }]}>by {item.author}</Text>

                    {/* Status Pill in Modal */}
                    <View
                      style={[
                        styles.statusPill,
                        { alignSelf: 'flex-start', marginTop: 2 },
                        isReturned
                          ? {
                              backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.15)' : '#E0F2FE',
                              borderColor: isDarkMode ? '#38BDF8' : 'rgba(2, 116, 187, 0.35)',
                            }
                          : isPickedUp
                          ? { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981' }
                          : isApproved
                          ? {
                              backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.15)' : '#E0F2FE',
                              borderColor: isDarkMode ? '#38BDF8' : 'rgba(2, 116, 187, 0.35)',
                            }
                          : { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#F59E0B' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          isReturned
                            ? { color: isDarkMode ? '#38BDF8' : '#0274BB' }
                            : isPickedUp
                            ? { color: '#10B981' }
                            : isApproved
                            ? { color: isDarkMode ? '#38BDF8' : '#0274BB' }
                            : { color: '#F59E0B' },
                        ]}
                      >
                        {isReturned
                          ? 'RETURNED'
                          : isPickedUp
                          ? 'BORROWED (PICKED UP)'
                          : isApproved
                          ? 'READY FOR PICKUP'
                          : 'BORROW PENDING'}
                      </Text>
                    </View>
                  </View>

                  {/* Pickup countdown banner if applicable */}
                  {isApproved && countdown?.text && (
                    <View
                      style={[
                        styles.claimCountdownBanner,
                        {
                          backgroundColor: countdown.isUrgent
                            ? 'rgba(239, 68, 68, 0.12)'
                            : 'rgba(56, 189, 248, 0.12)',
                          borderColor: countdown.isUrgent ? '#EF4444' : '#38BDF8',
                          marginBottom: 14,
                        },
                      ]}
                    >
                      <Ionicons name="timer-outline" size={16} color={countdown.isUrgent ? '#EF4444' : '#38BDF8'} />
                      <Text
                        style={[
                          styles.claimCountdownText,
                          { color: countdown.isUrgent ? '#EF4444' : '#38BDF8' },
                        ]}
                      >
                        Pickup Window: {countdown.text}
                      </Text>
                    </View>
                  )}

                  {/* Info Rows */}
                  <View style={styles.detailInfoGrid}>
                    <View
                      style={[
                        styles.detailInfoRow,
                        { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
                      ]}
                    >
                      <View style={styles.detailInfoLabelRow}>
                        <Ionicons name="calendar-outline" size={15} color={theme.textSecondary} />
                        <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Borrow Date</Text>
                      </View>
                      <Text style={[styles.detailInfoValue, { color: theme.textPrimary }]}>{borrowDateText}</Text>
                    </View>

                    {isPickedUp && (
                      <View
                        style={[
                          styles.detailInfoRow,
                          { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
                        ]}
                      >
                        <View style={styles.detailInfoLabelRow}>
                          <Ionicons name="checkmark-done-circle-outline" size={15} color="#10B981" />
                          <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Picked Up</Text>
                        </View>
                        <Text style={[styles.detailInfoValue, { color: '#10B981' }]}>
                          {item.pickupDate || borrowDateText}
                        </Text>
                      </View>
                    )}

                    {isReturned ? (
                      <View
                        style={[
                          styles.detailInfoRow,
                          { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
                        ]}
                      >
                        <View style={styles.detailInfoLabelRow}>
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={15}
                            color={isDarkMode ? '#38BDF8' : theme.accentBlue}
                          />
                          <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Return Date</Text>
                        </View>
                        <Text
                          style={[
                            styles.detailInfoValue,
                            { color: isDarkMode ? '#38BDF8' : theme.accentBlue },
                          ]}
                        >
                          {returnDateText}
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.detailInfoRow,
                          { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
                        ]}
                      >
                        <View style={styles.detailInfoLabelRow}>
                          <Ionicons
                            name="alarm-outline"
                            size={15}
                            color={isPickedUp ? '#10B981' : theme.textSecondary}
                          />
                          <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Due Return Date</Text>
                        </View>
                        <Text
                          style={[
                            styles.detailInfoValue,
                            { color: isPickedUp ? '#10B981' : theme.textPrimary },
                          ]}
                        >
                          {dueDateText}
                        </Text>
                      </View>
                    )}

                    <View
                      style={[
                        styles.detailInfoRow,
                        { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
                      ]}
                    >
                      <View style={styles.detailInfoLabelRow}>
                        <Ionicons name="information-circle-outline" size={15} color={theme.textSecondary} />
                        <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>
                          Circulation Status
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.detailInfoValue,
                          {
                            color: isReturned
                              ? isDarkMode
                                ? '#38BDF8'
                                : theme.accentBlue
                              : isPickedUp
                              ? '#10B981'
                              : isApproved
                              ? isDarkMode
                                ? '#38BDF8'
                                : theme.accentBlue
                              : '#F59E0B',
                          },
                        ]}
                      >
                        {isReturned
                          ? 'Returned · Loan Closed'
                          : isPickedUp
                          ? 'Active Loan · In Student Hand'
                          : isApproved
                          ? 'Approved · Ready for Pickup'
                          : 'Pending Approval'}
                      </Text>
                    </View>

                    {item.shelf ? (
                      <View
                        style={[
                          styles.detailInfoRow,
                          { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
                        ]}
                      >
                        <View style={styles.detailInfoLabelRow}>
                          <Ionicons name="location-outline" size={15} color={theme.textSecondary} />
                          <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Shelf</Text>
                        </View>
                        <Text style={[styles.detailInfoValue, { color: theme.textPrimary }]}>{item.shelf}</Text>
                      </View>
                    ) : null}

                    {item.department || item.category ? (
                      <View
                        style={[
                          styles.detailInfoRow,
                          { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
                        ]}
                      >
                        <View style={styles.detailInfoLabelRow}>
                          <Ionicons name="business-outline" size={15} color={theme.textSecondary} />
                          <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Department</Text>
                        </View>
                        <Text style={[styles.detailInfoValue, { color: theme.textPrimary }]}>
                          {item.department || item.category}
                        </Text>
                      </View>
                    ) : null}

                    {item.isbn ? (
                      <View
                        style={[
                          styles.detailInfoRow,
                          { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
                        ]}
                      >
                        <View style={styles.detailInfoLabelRow}>
                          <Ionicons name="barcode-outline" size={15} color={theme.textSecondary} />
                          <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>ISBN</Text>
                        </View>
                        <Text style={[styles.detailInfoValue, { color: theme.textPrimary }]}>{item.isbn}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Actions */}
                  <View style={styles.detailModalActions}>
                    <TouchableOpacity
                      style={[
                        styles.detailModalBtnPrimary,
                        { backgroundColor: isDarkMode ? theme.accentGold : theme.accentBlue },
                      ]}
                      onPress={() => {
                        const target = selectedBorrowDetail;
                        setSelectedBorrowDetail(null);
                        handleBookPress(target);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[styles.detailModalBtnPrimaryText, { color: isDarkMode ? '#080F1E' : '#FFFFFF' }]}
                      >
                        View Book Details
                      </Text>
                      <Ionicons name="chevron-forward" size={15} color={isDarkMode ? '#080F1E' : '#FFFFFF'} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.detailModalBtnSecondary,
                        {
                          borderColor: theme.cardBorder,
                          backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9',
                        },
                      ]}
                      onPress={() => setSelectedBorrowDetail(null)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.detailModalBtnSecondaryText, { color: theme.textPrimary }]}>
                        Close
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </View>
          );
        })()}
      </Modal>
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

  // Main Segmented Tab Bar (Pending | Favorites | History)
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 8,
  },
  tabPill: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
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
  tabPillBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },

  // Dropdown Filter Bar for History Tab
  dropdownOuterWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    zIndex: 100,
    position: 'relative',
  },
  dropdownTriggerBar: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownTriggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownFilterSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dropdownFilterTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 1,
  },
  dropdownCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  dropdownCountBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  dropdownMenuCard: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownMenuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownMenuItemText: {
    fontSize: 13.5,
  },
  dropdownMenuItemBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  dropdownMenuItemBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Content scroll
  contentScroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
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
    fontSize: 17,
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

  // History Item Card (Pending, Filtered, Reservation & Borrow)
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

  // Detail Modal Styles
  detailModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  detailModalCard: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  detailModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  detailModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detailModalHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  detailModalTitle: {
    fontSize: 16.5,
    fontWeight: '800',
  },
  detailModalSubtitle: {
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
  },
  detailModalCloseBtn: {
    padding: 6,
  },
  detailBookCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  detailBookTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  detailBookAuthor: {
    fontSize: 13,
    marginBottom: 10,
  },
  detailInfoGrid: {
    marginBottom: 16,
  },
  detailInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  detailInfoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailInfoLabel: {
    fontSize: 13,
    marginLeft: 8,
    fontWeight: '600',
  },
  detailInfoValue: {
    fontSize: 13,
    fontWeight: '700',
    maxWidth: '55%',
    textAlign: 'right',
  },
  detailModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  detailModalBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  detailModalBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '800',
    marginRight: 6,
  },
  detailModalBtnSecondary: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailModalBtnSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
