import React, { useEffect, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useThemeColors } from '../../hooks/useThemeColors';
import {
  getUpcomingReservations,
  subscribe,
  ReservationBook,
  getNotifications,
  NotificationItem,
} from '../../data/store';

export default function ReservationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();
  
  const [activeTab, setActiveTab] = useState<'borrowed' | 'reserved'>('borrowed');
  const [activeReservations, setActiveReservations] = useState<ReservationBook[]>(
    getUpcomingReservations()
  );
  const [notifications, setNotifications] = useState<NotificationItem[]>(getNotifications());

  useEffect(() => {
    setActiveReservations(getUpcomingReservations());
    setNotifications(getNotifications());
    return subscribe(() => {
      setActiveReservations(getUpcomingReservations());
      setNotifications(getNotifications());
    });
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const borrowedBooks = activeReservations.filter((book) => book.status === 'Approved');
  const reservedBooks = activeReservations.filter(
    (book) => book.status === 'Pending' || book.status === 'Upcoming' || book.status === 'Reserved'
  );

  const navigateToDetails = (book: ReservationBook) => {
    router.push({
      pathname: "/book-details",
      params: {
        from: "reservations",
        id: book.id,
        title: book.title,
        author: book.author,
        description: book.description || "No description available.",
        year: String(book.year || "2024"),
        pages: String(book.pages || "320"),
        language: book.language || "EN",
        category: book.category || "CS",
        available: 'false',
      },
    });
  };

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      {/* GLOBAL SCREEN HEADER */}
      <View style={[styles.header, { paddingTop: 18 + insets.top, height: 70 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
        <TouchableOpacity onPress={() => router.push("/")} activeOpacity={0.7}>
          <Ionicons
            name="arrow-back"
            size={22}
            color={theme.accentGold}
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          RESERVATIONS & LOANS
        </Text>

        <TouchableOpacity
          style={styles.notificationButtonRelative}
          onPress={() => router.push('/notifications')}
          activeOpacity={0.7}
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
        {/* SEGMENTED PILL TAB BAR */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.pillButton,
              activeTab === 'borrowed'
                ? styles.activePill
                : [
                    styles.inactivePill,
                    {
                      backgroundColor: isDarkMode ? '#111A2E' : '#E2E8F0',
                      borderColor: isDarkMode ? '#1E293B' : '#CBD5E1',
                    },
                  ],
            ]}
            onPress={() => setActiveTab('borrowed')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.pillText,
                activeTab === 'borrowed'
                  ? styles.activePillText
                  : [styles.inactivePillText, { color: isDarkMode ? '#94A3B8' : '#475569' }],
              ]}
            >
              Borrowed Books
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.pillButton,
              activeTab === 'reserved'
                ? styles.activePill
                : [
                    styles.inactivePill,
                    {
                      backgroundColor: isDarkMode ? '#111A2E' : '#E2E8F0',
                      borderColor: isDarkMode ? '#1E293B' : '#CBD5E1',
                    },
                  ],
            ]}
            onPress={() => setActiveTab('reserved')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.pillText,
                activeTab === 'reserved'
                  ? styles.activePillText
                  : [styles.inactivePillText, { color: isDarkMode ? '#94A3B8' : '#475569' }],
              ]}
            >
              Reserved Books
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Section Content rendering based on activeTab */}
        {activeTab === 'borrowed' ? (
          <>
            {/* SECTION HEADING: BORROWED BOOKS */}
            <View style={styles.sectionHeaderContainer}>
              <Text style={[styles.sectionTitle, { color: theme.accentGold }]}>
                Borrowed Books
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Books currently in your possession
              </Text>
            </View>

            {/* STATE 1 or STATE 2 */}
            {borrowedBooks.length > 0 ? (
              borrowedBooks.map((book) => (
                <View
                  key={book.id}
                  style={[
                    styles.cardContainer,
                    {
                      backgroundColor: theme.cardBg,
                      borderColor: theme.cardBorder,
                      shadowColor: theme.shadowColor,
                      shadowOpacity: isDarkMode ? 0.3 : 0.05,
                    },
                  ]}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.bookInfoLeft}>
                      <Text style={[styles.bookTitle, { color: theme.textPrimary }]} numberOfLines={2}>
                        {book.title}
                      </Text>
                      <Text style={[styles.bookAuthor, { color: theme.textSecondary }]}>
                        {book.author}
                      </Text>
                    </View>

                    <View style={styles.cardRightColumn}>
                      <View style={styles.activeLoanBadge}>
                        <Text style={styles.activeLoanBadgeText}>ACTIVE LOAN</Text>
                      </View>

                      <View style={styles.dueDateRow}>
                        <Ionicons
                          name="calendar-outline"
                          size={16}
                          color={isDarkMode ? "#FFFFFF" : theme.textPrimary}
                        />
                        <View style={{ marginLeft: 6 }}>
                          <Text style={[styles.dueDateLabel, { color: isDarkMode ? "#FFFFFF" : theme.textPrimary }]}>
                            Due Date:
                          </Text>
                          <Text style={[styles.dueDateValue, { color: isDarkMode ? "#FFFFFF" : theme.textPrimary }]}>
                            {book.date || "05/31/26"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.fullWidthActionBtn,
                      {
                        backgroundColor: isDarkMode ? '#1E293B' : '#D97706',
                        borderColor: isDarkMode ? '#334155' : '#D97706',
                      },
                    ]}
                    onPress={() => navigateToDetails(book)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.actionBtnText}>View Details</Text>
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              /* STATE 1: BORROWED BOOKS — EMPTY STATE */
              <View
                style={[
                  styles.emptyCardContainer,
                  {
                    backgroundColor: theme.cardBg,
                    borderColor: theme.cardBorder,
                    shadowColor: theme.shadowColor,
                    shadowOpacity: isDarkMode ? 0.3 : 0.05,
                  },
                ]}
              >
                <Ionicons name="time-outline" size={44} color={theme.textMuted} />
                <Text style={[styles.emptyCardText, { color: theme.textSecondary }]}>
                  No Borrowed Books.
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            {/* SECTION HEADING: RESERVED BOOKS */}
            <View style={styles.sectionHeaderContainer}>
              <Text style={[styles.sectionTitle, { color: theme.accentGold }]}>
                Reserved Books
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Books currently you reserved
              </Text>
            </View>

            {/* STATE 3 or STATE 4 */}
            {reservedBooks.length > 0 ? (
              reservedBooks.map((book) => (
                <View
                  key={book.id}
                  style={[
                    styles.cardContainer,
                    {
                      backgroundColor: theme.cardBg,
                      borderColor: theme.cardBorder,
                      shadowColor: theme.shadowColor,
                      shadowOpacity: isDarkMode ? 0.3 : 0.05,
                    },
                  ]}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.bookInfoLeft}>
                      <Text style={[styles.bookTitle, { color: theme.textPrimary }]} numberOfLines={2}>
                        {book.title}
                      </Text>
                      <Text style={[styles.bookAuthor, { color: theme.textSecondary }]}>
                        {book.author}
                      </Text>
                    </View>

                    <View style={styles.cardRightColumn}>
                      <View style={styles.reservedBadge}>
                        <Text style={styles.reservedBadgeText}>RESERVED</Text>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.fullWidthActionBtn,
                      {
                        backgroundColor: isDarkMode ? '#1E293B' : '#D97706',
                        borderColor: isDarkMode ? '#334155' : '#D97706',
                      },
                    ]}
                    onPress={() => navigateToDetails(book)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.actionBtnText}>View Details</Text>
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              /* STATE 3: RESERVED BOOKS — EMPTY STATE */
              <View
                style={[
                  styles.emptyCardContainer,
                  {
                    backgroundColor: theme.cardBg,
                    borderColor: theme.cardBorder,
                    shadowColor: theme.shadowColor,
                    shadowOpacity: isDarkMode ? 0.3 : 0.05,
                  },
                ]}
              >
                <Ionicons name="time-outline" size={44} color={theme.textMuted} />
                <Text style={[styles.emptyCardText, { color: theme.textSecondary }]}>
                  No Pending Reservation.
                </Text>
              </View>
            )}
          </>
        )}
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
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#111A2E',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 1.2,
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

  /* SEGMENTED PILL TAB BAR */
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 12,
    alignItems: 'center',
  },
  pillButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activePill: {
    backgroundColor: '#FFD700',
  },
  inactivePill: {
    backgroundColor: '#111A2E',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  pillText: {
    fontSize: 14,
  },
  activePillText: {
    color: '#000000',
    fontWeight: '800',
  },
  inactivePillText: {
    color: '#94A3B8',
    fontWeight: '600',
  },

  /* SECTION HEADINGS */
  sectionHeaderContainer: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    color: '#FFD700',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  sectionSubtitle: {
    color: '#94A3B8',
    marginTop: 4,
    fontSize: 13,
  },

  /* EMPTY CARD STATE (STATES 1 & 3) */
  emptyCardContainer: {
    backgroundColor: '#111A2E',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 18,
    paddingVertical: 42,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  emptyCardText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 12,
  },

  /* CARD CONTAINER (STATES 2 & 4) */
  cardContainer: {
    backgroundColor: '#111A2E',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bookInfoLeft: {
    flex: 1,
    paddingRight: 12,
  },
  bookTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bookAuthor: {
    marginTop: 4,
    fontSize: 13,
    color: '#94A3B8',
  },
  cardRightColumn: {
    alignItems: 'flex-end',
  },

  /* BADGES */
  activeLoanBadge: {
    backgroundColor: '#86EFAC',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  activeLoanBadgeText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '800',
  },
  reservedBadge: {
    backgroundColor: '#F97316',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
  },
  reservedBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  /* DUE DATE */
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  dueDateLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  dueDateValue: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },

  /* FULL WIDTH ACTION BUTTON */
  fullWidthActionBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    width: '100%',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});