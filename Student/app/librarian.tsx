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
import AnimatedScreen from '../components/AnimatedScreen';
import { useThemeColors } from '../hooks/useThemeColors';

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getReservations, addNotification } from '../data/store';

interface ReservationBook {
  id: string;
  title: string;
  author: string;
  studentName?: string;
  studentId?: string;
  course?: string;
  isbn?: string;
  department?: string;
  date?: string;
  returnDate?: string;
  status?: string;
}

export default function LibrarianScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();
  const [pendingReservations, setPendingReservations] = useState<ReservationBook[]>([]);

  useEffect(() => {
    const allReservations = getReservations();
    const pending = allReservations.filter((r: any) => r.status === 'Pending');
    setPendingReservations(pending);
  }, []);

  const handleApprove = (reservation: ReservationBook) => {
    Alert.alert(
      'Approve Reservation',
      `Approve "${reservation.title}" for ${reservation.studentName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: () => {
            // In a real system, this would update the database
            // For demo purposes, we'll add a notification
            addNotification({
              id: Date.now().toString(),
              title: 'Reservation Approved',
              body: `Your reservation for "${reservation.title}" has been approved by the librarian.`,
              timestamp: 'Just now',
              read: false,
              type: 'reservation'
            });

            // Remove from pending list
            setPendingReservations(prev => prev.filter(r => r.id !== reservation.id));

            Alert.alert('Success', 'Reservation approved successfully!');
          },
        },
      ]
    );
  };

  const handleReject = (reservation: ReservationBook) => {
    Alert.alert(
      'Reject Reservation',
      `Reject "${reservation.title}" for ${reservation.studentName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          onPress: () => {
            // Add rejection notification
            addNotification({
              id: Date.now().toString(),
              title: 'Reservation Rejected',
              body: `Your reservation for "${reservation.title}" has been rejected. Please contact the librarian for details.`,
              timestamp: 'Just now',
              read: false,
              type: 'general'
            });

            // Remove from pending list
            setPendingReservations(prev => prev.filter(r => r.id !== reservation.id));

            Alert.alert('Success', 'Reservation rejected.');
          },
        },
      ]
    );
  };

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 120,
        }}
      >
        {/* HEADER */}
        <View style={[styles.header, { paddingTop: 18 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder, borderBottomWidth: 1 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons
              name="arrow-back"
              size={22}
              color={theme.accentGold}
            />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
            LIBRARIAN DASHBOARD
          </Text>

          <TouchableOpacity
            onPress={() => router.push('/notifications')}
          >
            <Ionicons
              name="notifications-outline"
              size={20}
              color={theme.accentGold}
            />
          </TouchableOpacity>
        </View>

        {/* STATS */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <Text style={[styles.statNumber, { color: theme.accentGold }]}>
              {pendingReservations.length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Pending Approvals
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <Text style={[styles.statNumber, { color: theme.accentGold }]}>
              12
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Books Issued Today
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <Text style={[styles.statNumber, { color: theme.accentGold }]}>
              3
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Overdue Returns
            </Text>
          </View>
        </View>

        {/* PENDING APPROVALS */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.accentGold }]}>
            Pending Approvals
          </Text>
        </View>

        {pendingReservations.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1 }]}>
            <Ionicons
              name="checkmark-circle-outline"
              size={45}
              color={theme.textSecondary}
            />

            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              All Caught Up!
            </Text>

            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No pending reservations to review.
            </Text>
          </View>
        ) : (
          pendingReservations.map((reservation) => (
            <View key={reservation.id} style={[styles.reservationCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.bookIcon, { backgroundColor: theme.background }]}>
                  <Ionicons
                    name="book"
                    size={22}
                    color={theme.accentGold}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.bookTitle, { color: theme.textPrimary }]}>
                    {reservation.title}
                  </Text>

                  <Text style={[styles.bookAuthor, { color: theme.textSecondary }]}>
                    {reservation.author}
                  </Text>
                </View>

                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>
                    Pending
                  </Text>
                </View>
              </View>

              <View style={[styles.studentInfo, { backgroundColor: theme.background }]}>
                <Text style={[styles.studentName, { color: theme.textPrimary }]}>
                  {reservation.studentName}
                </Text>

                <Text style={[styles.studentDetails, { color: theme.textSecondary }]}>
                  ID: {reservation.studentId} • {reservation.course}
                </Text>

                <Text style={[styles.requestDate, { color: theme.accentGold }]}>
                  Requested: {reservation.date}
                </Text>
              </View>

              <View style={styles.bookDetails}>
                <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                  ISBN: {reservation.isbn}
                </Text>

                <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                  Department: {reservation.department}
                </Text>

                <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                  Return Date: {reservation.returnDate}
                </Text>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.rejectButton, { backgroundColor: isDarkMode ? "#3F1B1F" : "#FEF2F2" }]}
                  onPress={() => handleReject(reservation)}
                >
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color="#DC2626"
                  />
                  <Text style={styles.rejectText}>
                    Reject
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.approveButton, { backgroundColor: theme.accentGold }]}
                  onPress={() => handleApprove(reservation)}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={isDarkMode ? "#080F1E" : "#FFFFFF"}
                  />
                  <Text style={[styles.approveText, { color: isDarkMode ? "#080F1E" : "#FFFFFF" }]}>
                    Approve
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* QUICK ACTIONS */}
        <View style={styles.quickActions}>
          <Text style={[styles.actionsTitle, { color: theme.accentGold }]}>
            Quick Actions
          </Text>

          <View style={styles.actionGrid}>
            <TouchableOpacity style={[styles.actionCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} onPress={() => router.push('/search')}>
              <Ionicons
                name="search"
                size={24}
                color={theme.accentGold}
              />
              <Text style={[styles.actionText, { color: theme.textPrimary }]}>
                Search Books
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} onPress={() => router.push('/history')}>
              <Ionicons
                name="stats-chart"
                size={24}
                color={theme.accentGold}
              />
              <Text style={[styles.actionText, { color: theme.textPrimary }]}>
                View Reports
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} onPress={() => router.push('/settings')}>
              <Ionicons
                name="settings"
                size={24}
                color={theme.accentGold}
              />
              <Text style={[styles.actionText, { color: theme.textPrimary }]}>
                Settings
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} onPress={() => router.replace('/login')}>
              <Ionicons
                name="log-out"
                size={24}
                color={theme.accentGold}
              />
              <Text style={[styles.actionText, { color: theme.textPrimary }]}>
                Logout
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },

  header: {
    backgroundColor: '#032B44',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  headerTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.5,
  },

  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 18,
    marginTop: 20,
  },

  statCard: {
    backgroundColor: '#FFFFFF',
    width: '31%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0B5A8E',
  },

  statLabel: {
    marginTop: 8,
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
  },

  sectionHeader: {
    marginHorizontal: 18,
    marginTop: 28,
    marginBottom: 16,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 18,
    marginTop: 16,
    borderRadius: 22,
    padding: 32,
    alignItems: 'center',
  },

  emptyTitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },

  emptyText: {
    marginTop: 6,
    color: '#64748B',
    textAlign: 'center',
  },

  reservationCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 18,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  bookIcon: {
    width: 45,
    height: 45,
    borderRadius: 12,
    backgroundColor: '#0B5A8E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  bookTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },

  bookAuthor: {
    marginTop: 4,
    color: '#64748B',
    fontSize: 12,
  },

  statusBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },

  statusText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '600',
  },

  studentInfo: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },

  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },

  studentDetails: {
    marginTop: 4,
    color: '#64748B',
    fontSize: 12,
  },

  requestDate: {
    marginTop: 4,
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '600',
  },

  bookDetails: {
    marginBottom: 16,
  },

  detailText: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 4,
  },

  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    flex: 1,
    marginRight: 8,
  },

  rejectText: {
    color: '#DC2626',
    fontWeight: '600',
    marginLeft: 6,
  },

  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B5A8E',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    flex: 1,
    marginLeft: 8,
  },

  approveText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 6,
  },

  quickActions: {
    marginHorizontal: 18,
    marginTop: 32,
  },

  actionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 16,
  },

  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  actionCard: {
    backgroundColor: '#FFFFFF',
    width: '48%',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  actionText: {
    marginTop: 8,
    color: '#0B5A8E',
    fontSize: 12,
    fontWeight: '600',
  },
});