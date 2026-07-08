import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getReservationHistory, getUpcomingReservations, subscribe } from '../data/store';
import AnimatedScreen from '../components/AnimatedScreen';
import { useThemeColors } from '../hooks/useThemeColors';

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();
  const [history, setHistory] = useState(getReservationHistory());
  const [upcoming, setUpcoming] = useState(getUpcomingReservations());

  const handleBack = () => {
    if (router.canGoBack?.()) {
      router.back();
    } else {
      router.push('/profile');
    }
  };

  useEffect(() => {
    setHistory(getReservationHistory());
    setUpcoming(getUpcomingReservations());

    const unsubscribe = subscribe(() => {
      setHistory(getReservationHistory());
      setUpcoming(getUpcomingReservations());
    });

    return unsubscribe;
  }, []);

  const returnedCount = history.filter((item) => item.status === 'Completed' || item.date === 'Returned').length;

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: 18 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder, borderBottomWidth: 1 }]}>
        <TouchableOpacity onPress={handleBack}>
          <Ionicons name="arrow-back" size={22} color={theme.accentGold} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>BORROWING HISTORY</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 40,
        }}
      >
        <View style={[styles.summaryCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1 }]}>
          <View style={styles.summaryTop}>
            <View style={[styles.bookIconBox, { backgroundColor: theme.background }]}>
              <Ionicons name="book" size={18} color={theme.accentGold} />
            </View>

            <View>
              <Text style={styles.totalLabel}>TOTAL HISTORY</Text>
              <Text style={[styles.totalValue, { color: theme.textPrimary }]}>{returnedCount} Records</Text>
            </View>

            <View style={styles.cornerShape} />
          </View>

          <View style={styles.statusRow}>
            <View style={styles.greenDot} />
            <Text style={[styles.statusText, { color: theme.textSecondary }]}>Current Status:</Text>
            <View style={[styles.statusBadge, { backgroundColor: theme.background }]}>
              <Text style={[styles.statusBadgeText, { color: theme.accentGold }]}>
                {upcoming.length === 0
                  ? 'All Clear - No Active Loans'
                  : 'Active loans in progress'}
              </Text>
            </View>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.accentGold }]}>Previous Returns</Text>

        {history.length === 0 ? (
          <View style={[styles.emptyHistory, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1 }]}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No history records yet.</Text>
          </View>
        ) : (
          history.map((book) => (
            <View key={book.id} style={[styles.returnCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <View style={styles.returnTop}>
                <View>
                  <Text style={[styles.bookTitle, { color: theme.textPrimary }]}>{book.title}</Text>
                  <Text style={[styles.authorText, { color: theme.textSecondary }]}>
                    {book.author}
                  </Text>
                </View>

                <Ionicons
                  name={book.date === 'Returned' || book.status === 'Completed' ? 'checkmark-circle' : 'alert-circle'}
                  size={14}
                  color={book.date === 'Returned' || book.status === 'Completed' ? '#00C853' : '#F59E0B'}
                />
              </View>

              <Text style={[styles.returnInfo, { color: theme.textSecondary }]}>
                {book.date === 'Returned' || book.status === 'Completed'
                  ? `Returned ${book.returnDate || book.date}`
                  : `${book.status || 'Pending'} • ${book.date}`}
              </Text>
            </View>
          ))
        )}
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
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 14,
    letterSpacing: 0.3,
  },

  summaryCard: {
    backgroundColor: '#fff',
    marginHorizontal: 18,
    marginTop: 18,
    borderRadius: 18,
    padding: 16,
    overflow: 'hidden',
  },

  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  bookIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  totalLabel: {
    fontSize: 10,
    color: '#94A3B8',
    letterSpacing: 1,
  },

  totalValue: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0B1F3A',
  },

  cornerShape: {
    flex: 1,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },

  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    marginRight: 8,
  },

  statusText: {
    color: '#475569',
    fontSize: 12,
    marginRight: 8,
  },

  statusBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },

  statusBadgeText: {
    color: '#0B3A5B',
    fontSize: 11,
    fontWeight: '700',
  },

  sectionTitle: {
    marginHorizontal: 18,
    marginTop: 22,
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#0B1F3A',
  },

  returnCard: {
    backgroundColor: '#fff',
    marginHorizontal: 18,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  returnTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  bookTitle: {
    fontWeight: '700',
    color: '#0B1F3A',
    fontSize: 14,
  },

  authorText: {
    marginTop: 4,
    color: '#64748B',
    fontSize: 12,
  },

  returnInfo: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 20,
  },

  emptyHistory: {
    backgroundColor: '#fff',
    marginHorizontal: 18,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
  },

  emptyText: {
    color: '#64748B',
    fontSize: 14,
  },
});