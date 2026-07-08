import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedScreen from '../../components/AnimatedScreen';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeColors } from '../../hooks/useThemeColors';
import {
  removeReservation,
  getUpcomingReservations,
  addNotification,
  subscribe,
  ReservationBook,
  getNotifications,
  NotificationItem,
} from '../../data/store';

export default function ReservationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();
  
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

  const handleCancel = (id: string, title: string) => {
    Alert.alert('Cancel Reservation', 'Are you sure you want to cancel this reservation?', [
      {
        text: 'No',
        style: 'cancel',
      },
      {
        text: 'Yes',
        onPress: () => {
          removeReservation(id);
          addNotification({
            id: Date.now().toString(),
            title: 'Reservation Cancelled',
            body: `Your reservation for "${title}" has been cancelled.`,
            timestamp: 'Just now',
            read: false,
            type: 'general'
          });
        },
      },
    ]);
  };

  const borrowedBooks = activeReservations.filter((book) => book.status === 'Approved');
  const reservedBooks = activeReservations.filter((book) => book.status === 'Pending' || book.status === 'Upcoming');

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 120,
        }}
      >
        {/* HEADER */}
        <View style={[styles.header, { paddingTop: 18 + insets.top, height: 70 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
          <TouchableOpacity onPress={() => router.push("/")}>
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

        {/* SECTION 1: BORROWED BOOKS */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.accentGold }]}>
            Borrowed Books
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            Books currently in your possession
          </Text>
        </View>

        {borrowedBooks.length > 0 ? (
          borrowedBooks.map((book) => (
            <View key={book.id} style={[styles.reserveCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <View style={styles.topBadges}>
                <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={[styles.statusBadgeText, { color: '#16A34A' }]}>
                    ACTIVE LOAN
                  </Text>
                </View>
              </View>

              <Text style={[styles.bookTitle, { color: theme.textPrimary }]}>
                {book.title}
              </Text>

              <Text style={[styles.authorText, { color: theme.textSecondary }]}>
                {book.author}
              </Text>

              <View style={styles.infoRow}>
                <Ionicons
                  name="calendar-outline"
                  size={13}
                  color={theme.textSecondary}
                />
                <Text style={[styles.infoText, { color: theme.textPrimary }]}>
                  Due Date: {book.date}
                </Text>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.viewButton, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                  onPress={() =>
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
                    })
                  }
                >
                  <Text style={[styles.viewButtonText, { color: theme.textPrimary }]}>
                    View Details
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <Ionicons name="library-outline" size={24} color="#64748B" />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No active borrowed books.
            </Text>
          </View>
        )}

        {/* SECTION 2: RESERVED BOOKS */}
        <View style={[styles.sectionContainer, { marginTop: 32 }]}>
          <Text style={[styles.sectionTitle, { color: theme.accentGold }]}>
            Reserved Books
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            Pending pick-up requests and wait queues
          </Text>
        </View>

        {reservedBooks.length > 0 ? (
          reservedBooks.map((book) => (
            <View key={book.id} style={[styles.reserveCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <View style={styles.topBadges}>
                <View style={[styles.statusBadge, { backgroundColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
                  <Text style={[styles.statusBadgeText, { color: theme.accentGold }]}>
                    PENDING APPROVAL
                  </Text>
                </View>
              </View>

              <Text style={[styles.bookTitle, { color: theme.textPrimary }]}>
                {book.title}
              </Text>

              <Text style={[styles.authorText, { color: theme.textSecondary }]}>
                {book.author}
              </Text>

              <View style={styles.infoRow}>
                <Ionicons
                  name="time-outline"
                  size={13}
                  color={theme.textSecondary}
                />
                <Text style={[styles.infoText, { color: theme.textPrimary }]}>
                  Requested: {book.pickupDate || 'Today'}
                </Text>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.viewButton, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                  onPress={() =>
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
                    })
                  }
                >
                  <Text style={[styles.viewButtonText, { color: theme.textPrimary }]}>
                    View Details
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => handleCancel(book.id, book.title)}
                >
                  <Text style={styles.cancelButtonText}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <Ionicons name="time-outline" size={24} color="#64748B" />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No pending reservations.
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
  sectionContainer: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    color: '#FCD34D',
    fontSize: 22,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: '#94A3B8',
    marginTop: 4,
    fontSize: 12,
  },
  reserveCard: {
    backgroundColor: '#111A2E',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  topBadges: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  bookTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  authorText: {
    marginTop: 4,
    fontSize: 12,
    color: '#94A3B8',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  infoText: {
    marginLeft: 6,
    color: '#CBD5E1',
    fontSize: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 16,
    justifyContent: 'space-between',
    gap: 12,
  },
  viewButton: {
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: 12,
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  viewButtonText: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 12,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 12,
    width: 100,
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  cancelButtonText: {
    color: '#EF4444',
    fontWeight: '800',
    fontSize: 12,
  },
  emptyCard: {
    backgroundColor: '#111A2E',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 8,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
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