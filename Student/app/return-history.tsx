import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AnimatedScreen from '../components/AnimatedScreen';
import { useThemeColors } from '../hooks/useThemeColors';

export default function ReturnHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: 18 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder, borderBottomWidth: 1 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons
            name="arrow-back"
            size={24}
            color={theme.accentGold}
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          RETURNING HISTORY
        </Text>

        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* SUMMARY CARD */}
        <View style={[styles.summaryCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1 }]}>
          <View style={[styles.topCircle, { backgroundColor: theme.background }]} />

          <View style={styles.summaryRow}>
            <View style={[styles.iconBox, { backgroundColor: theme.background }]}>
              <Ionicons
                name="library"
                size={22}
                color={theme.accentGold}
              />
            </View>

            <View>
              <Text style={styles.summaryLabel}>
                TOTAL BOOKS RETURNED
              </Text>

              <Text style={[styles.summaryCount, { color: theme.textPrimary }]}>
                24 Volumes
              </Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            <View style={styles.greenDot} />

            <Text style={[styles.statusText, { color: theme.textSecondary }]}>
              Current Status:
            </Text>

            <View style={[styles.statusBadge, { backgroundColor: theme.background }]}>
              <Text style={[styles.statusBadgeText, { color: theme.accentGold }]}>
                All Clear - No Active Loans
              </Text>
            </View>
          </View>
        </View>

        {/* SECTION TITLE */}
        <Text style={[styles.sectionTitle, { color: theme.accentGold }]}>
          Previous Returns
        </Text>

        {/* HISTORY CARD */}
        <View style={[styles.historyCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1 }]}>
          <View style={styles.bookRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bookTitle, { color: theme.textPrimary }]}>
                Systems Architecture
              </Text>

              <Text style={[styles.bookAuthor, { color: theme.textSecondary }]}>
                M. J. Roberts • 2023 Ed.
              </Text>

              <View style={styles.bottomRow}>
                <Ionicons
                  name="return-down-back"
                  size={13}
                  color={theme.textSecondary}
                />

                <Text style={[styles.returnDate, { color: theme.textSecondary }]}>
                  Returned Oct 15, 2023
                </Text>

                <Text style={[styles.txId, { color: theme.textSecondary }]}>
                  TX-2023-9482
                </Text>
              </View>
            </View>

            <Ionicons
              name="checkmark-circle"
              size={18}
              color="#22C55E"
            />
          </View>
        </View>

        {/* HISTORY CARD */}
        <View style={[styles.historyCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1 }]}>
          <View style={styles.bookRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bookTitle, { color: theme.textPrimary }]}>
                Digital Logic Design
              </Text>

              <Text style={[styles.bookAuthor, { color: theme.textSecondary }]}>
                Dr. Elena Thorne
              </Text>

              <View style={styles.bottomRow}>
                <Ionicons
                  name="return-down-back"
                  size={13}
                  color={theme.textSecondary}
                />

                <Text style={[styles.returnDate, { color: theme.textSecondary }]}>
                  Returned Sep 28, 2023
                </Text>

                <Text style={[styles.txId, { color: theme.textSecondary }]}>
                  TX-2023-8821
                </Text>
              </View>
            </View>

            <Ionicons
              name="checkmark-circle"
              size={18}
              color="#22C55E"
            />
          </View>
        </View>

        {/* HISTORY CARD */}
        <View style={[styles.historyCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1 }]}>
          <View style={styles.bookRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bookTitle, { color: theme.textPrimary }]}>
                Modern Web Paradigms
              </Text>

              <Text style={[styles.bookAuthor, { color: theme.textSecondary }]}>
                Chris Anderson
              </Text>

              <View style={styles.bottomRow}>
                <Ionicons
                  name="return-down-back"
                  size={13}
                  color={theme.textSecondary}
                />

                <Text style={[styles.returnDate, { color: theme.textSecondary }]}>
                  Returned Sep 12, 2023
                </Text>

                <Text style={[styles.txId, { color: theme.textSecondary }]}>
                  TX-2023-7411
                </Text>
              </View>
            </View>

            <Ionicons
              name="checkmark-circle"
              size={18}
              color="#22C55E"
            />
          </View>
        </View>

        {/* LOAD MORE */}
        <TouchableOpacity style={[styles.loadBtn, { backgroundColor: theme.cardBg }]}>
          <Ionicons
            name="refresh"
            size={15}
            color={theme.textSecondary}
          />

          <Text style={[styles.loadText, { color: theme.textSecondary }]}>
            Load More History
          </Text>
        </TouchableOpacity>
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
    paddingTop: 55,
    paddingBottom: 18,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    marginLeft: 14,
  },

  summaryCard: {
    backgroundColor: '#fff',
    margin: 18,
    borderRadius: 18,
    padding: 18,
    overflow: 'hidden',
  },

  topCircle: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#EEF2F5',
    top: -25,
    right: -25,
  },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#E6F0F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  summaryLabel: {
    color: '#94A3B8',
    fontSize: 11,
    letterSpacing: 1,
  },

  summaryCount: {
    color: '#0B5A8E',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    flexWrap: 'wrap',
  },

  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    marginRight: 7,
  },

  statusText: {
    color: '#64748B',
    fontSize: 12,
  },

  statusBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 8,
  },

  statusBadgeText: {
    color: '#16A34A',
    fontWeight: '600',
    fontSize: 11,
  },

  sectionTitle: {
    marginHorizontal: 20,
    marginTop: 6,
    marginBottom: 10,
    color: '#0B5A8E',
    fontWeight: '600',
    fontSize: 13,
  },

  historyCard: {
    backgroundColor: '#fff',
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 14,
    padding: 14,
  },

  bookRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  bookTitle: {
    color: '#0B3A5B',
    fontWeight: 'bold',
    fontSize: 14,
  },

  bookAuthor: {
    color: '#64748B',
    marginTop: 4,
    fontSize: 12,
  },

  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    flexWrap: 'wrap',
  },

  returnDate: {
    color: '#94A3B8',
    fontSize: 11,
    marginLeft: 5,
  },

  txId: {
    color: '#94A3B8',
    fontSize: 11,
    marginLeft: 12,
  },

  loadBtn: {
    backgroundColor: '#EAEFF3',
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },

  loadText: {
    color: '#64748B',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '600',
  },
});