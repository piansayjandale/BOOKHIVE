import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedScreen from '../components/AnimatedScreen';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '../hooks/useThemeColors';
import { fetchStudentCardAndViolations, ScannedStudentCardData } from '../data/store';

export default function ScannedCardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ qr?: string; studentId?: string }>();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ScannedStudentCardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const qrPayload = params.qr || params.studentId || "";

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!qrPayload) {
        setError("No QR payload provided.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await fetchStudentCardAndViolations(qrPayload);
        if (isMounted) {
          if (result && result.student) {
            setData(result);
          } else {
            setError("No student account found matching this QR code.");
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to load student card.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [qrPayload]);

  const student = data?.student;
  const libraryCard = data?.libraryCard || [];
  const violations = data?.violations || [];

  const studentFullName = student?.fullName || student?.name || "Student";
  const studentCourseSection = student ? `${student.course || "General Program"}` : "";

  const TOTAL_CARD_ROWS = Math.max(14, libraryCard.length);
  const cardTableRows = Array.from({ length: TOTAL_CARD_ROWS }, (_, index) => {
    const item = libraryCard[index];
    return {
      id: item?.id || `empty-row-${index}`,
      borrowDate: item?.borrowDate || "",
      dueReturnDate: item?.dueReturnDate || "",
      bookTitle: item?.bookTitle || "",
      hasData: !!item,
    };
  });

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: 18 + insets.top, height: 70 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <Ionicons
            name="arrow-back"
            size={24}
            color={theme.accentGold}
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          STUDENT LIBRARY RECORD
        </Text>

        <View style={styles.readOnlyBadge}>
          <Text style={styles.readOnlyBadgeText}>READ-ONLY</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 120,
        }}
      >
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={theme.accentGold} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Resolving student QR payload...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Ionicons name="alert-circle-outline" size={52} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: theme.accentGold }]}
              onPress={() => router.back()}
            >
              <Text style={[styles.retryBtnText, { color: isDarkMode ? "#080F1E" : "#FFFFFF" }]}>
                Back to Scanner
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* SECTION 1: BOOK CARD (LIBRARY CARD) */}
            <View style={[styles.libraryCardContainer, { backgroundColor: isDarkMode ? '#131E33' : '#F1F5F9', borderColor: isDarkMode ? '#24334C' : '#CBD5E1' }]}>
              {/* CARD TITLE HEADER */}
              <View style={styles.cardTopHeader}>
                <View style={{ width: 24 }} />
                <Text style={[styles.cardMainTitle, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                  LIBRARY CARD
                </Text>
                <Ionicons name="card-outline" size={22} color={theme.accentGold} />
              </View>

              {/* DATA TABLE */}
              <View style={[styles.cardTable, { borderColor: isDarkMode ? '#2E3F5C' : '#CBD5E1' }]}>
                {/* Row 1: Fullname */}
                <View style={[styles.tableInfoRow, { borderBottomColor: isDarkMode ? '#2E3F5C' : '#CBD5E1' }]}>
                  <View style={[styles.tableInfoLabelCol, { borderRightColor: isDarkMode ? '#2E3F5C' : '#CBD5E1' }]}>
                    <Text style={[styles.tableLabelText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
                      Fullname:
                    </Text>
                  </View>
                  <View style={styles.tableInfoValueCol}>
                    <Text style={[styles.tableValueText, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]} numberOfLines={1}>
                      {studentFullName}
                    </Text>
                  </View>
                </View>

                {/* Row 2: Course & Section */}
                <View style={[styles.tableInfoRow, { borderBottomColor: isDarkMode ? '#2E3F5C' : '#CBD5E1' }]}>
                  <View style={[styles.tableInfoLabelCol, { borderRightColor: isDarkMode ? '#2E3F5C' : '#CBD5E1' }]}>
                    <Text style={[styles.tableLabelText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
                      Course & Section:
                    </Text>
                  </View>
                  <View style={styles.tableInfoValueCol}>
                    <Text style={[styles.tableValueText, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]} numberOfLines={1}>
                      {studentCourseSection}
                    </Text>
                  </View>
                </View>

                {/* Row 3: Table Column Headers */}
                <View style={[styles.tableHeaderRow, { borderBottomColor: isDarkMode ? '#3B4E70' : '#94A3B8' }]}>
                  <View style={[styles.colBorrowDate, { borderRightColor: isDarkMode ? '#2E3F5C' : '#CBD5E1' }]}>
                    <Text style={[styles.colHeaderText, { color: isDarkMode ? '#E2E8F0' : '#1E293B' }]}>
                      Borrow{"\n"}Date:
                    </Text>
                  </View>

                  <View style={[styles.colDueDate, { borderRightColor: isDarkMode ? '#2E3F5C' : '#CBD5E1' }]}>
                    <Text style={[styles.colHeaderText, { color: isDarkMode ? '#E2E8F0' : '#1E293B' }]}>
                      Due Return{"\n"}Date:
                    </Text>
                  </View>

                  <View style={styles.colBookTitle}>
                    <Text style={[styles.colHeaderText, { color: isDarkMode ? '#E2E8F0' : '#1E293B' }]}>
                      Book Title
                    </Text>
                  </View>
                </View>

                {/* Table Data / Lined Grid Rows */}
                {cardTableRows.map((row, idx) => (
                  <View
                    key={row.id}
                    style={[
                      styles.tableDataRow,
                      {
                        borderBottomColor: isDarkMode ? '#273752' : '#E2E8F0',
                        borderBottomWidth: idx === cardTableRows.length - 1 ? 0 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.colBorrowDate, { borderRightColor: isDarkMode ? '#273752' : '#E2E8F0' }]}>
                      <Text style={[styles.cellDataText, { color: isDarkMode ? '#CBD5E1' : '#334155' }]} numberOfLines={1}>
                        {row.borrowDate}
                      </Text>
                    </View>

                    <View style={[styles.colDueDate, { borderRightColor: isDarkMode ? '#273752' : '#E2E8F0' }]}>
                      <Text style={[styles.cellDataText, { color: isDarkMode ? '#CBD5E1' : '#334155' }]} numberOfLines={1}>
                        {row.dueReturnDate}
                      </Text>
                    </View>

                    <View style={styles.colBookTitle}>
                      <Text style={[styles.cellDataTitleText, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]} numberOfLines={1}>
                        {row.bookTitle}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* SECTION 2: VIOLATION RECORD */}
            <View style={styles.violationSectionContainer}>
              <View style={styles.violationHeaderRow}>
                <MaterialCommunityIcons name="shield-alert-outline" size={20} color="#EF4444" />
                <Text style={styles.violationSectionTitle}>
                  VIOLATION RECORD
                </Text>
              </View>

              {violations.length === 0 ? (
                <View style={[styles.clearViolationCard, { backgroundColor: isDarkMode ? '#111A2E' : '#FFFFFF', borderColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
                  <Ionicons name="checkmark-circle-outline" size={42} color="#10B981" />
                  <Text style={[styles.clearStatusTitle, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                    No Active Violations
                  </Text>
                  <Text style={[styles.clearStatusSubtitle, { color: theme.textSecondary }]}>
                    Student account is in good standing with zero overdue penalties or disciplinary records.
                  </Text>
                </View>
              ) : (
                violations.map((v) => (
                  <View key={v.id} style={[styles.violationItemCard, { backgroundColor: isDarkMode ? '#1F1417' : '#FEF2F2', borderColor: isDarkMode ? '#3F1B22' : '#FEE2E2' }]}>
                    <View style={styles.violationTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.violationItemType}>
                          {v.violationType}
                        </Text>
                        {v.bookTitle ? (
                          <Text style={[styles.violationBookTitle, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]}>
                            Book: {v.bookTitle}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.penaltyBadge}>
                        <Text style={styles.penaltyBadgeText}>
                          {v.penaltyAmount > 0 ? `₱${v.penaltyAmount.toFixed(2)} Fine` : v.status}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.violationRemarks, { color: isDarkMode ? '#FCA5A5' : '#991B1B' }]}>
                      {v.remarks}
                    </Text>

                    {v.date ? (
                      <Text style={[styles.violationDate, { color: theme.textMuted }]}>
                        Recorded Date: {v.date}
                      </Text>
                    ) : null}
                  </View>
                ))
              )}
            </View>

            {/* FOOTER NOTICE */}
            <View style={styles.footerNotice}>
              <Text style={[styles.footerNoticeText, { color: theme.textMuted }]}>
                OFFICIAL BOOKHIVE VERIFICATION SYSTEM • ALL RIGHTS RESERVED
              </Text>
            </View>
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
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#111A2E',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 1.1,
  },
  readOnlyBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderColor: '#EAB308',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  readOnlyBadgeText: {
    color: '#EAB308',
    fontSize: 10,
    fontWeight: '800',
  },
  centerBox: {
    paddingVertical: 80,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
  retryBtn: {
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryBtnText: {
    fontWeight: '700',
    fontSize: 13,
  },

  /* LIBRARY CARD */
  libraryCardContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    elevation: 3,
  },
  cardTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  cardMainTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1.4,
    textAlign: 'center',
  },

  /* DATA TABLE */
  cardTable: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableInfoRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    minHeight: 28,
    alignItems: 'center',
  },
  tableInfoLabelCol: {
    width: '34%',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRightWidth: 1,
  },
  tableLabelText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tableInfoValueCol: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tableValueText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* TABLE COLUMN HEADERS */
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    minHeight: 34,
    alignItems: 'center',
  },
  colBorrowDate: {
    width: '26%',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    justifyContent: 'center',
  },
  colDueDate: {
    width: '28%',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    justifyContent: 'center',
  },
  colBookTitle: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  colHeaderText: {
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },

  /* TABLE DATA ROWS */
  tableDataRow: {
    flexDirection: 'row',
    minHeight: 25,
    alignItems: 'center',
  },
  cellDataText: {
    fontSize: 10,
    fontWeight: '500',
  },
  cellDataTitleText: {
    fontSize: 11,
    fontWeight: '600',
  },

  /* VIOLATION SECTION */
  violationSectionContainer: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  violationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  violationSectionTitle: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  clearViolationCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearStatusTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
  },
  clearStatusSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  violationItemCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  violationTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  violationItemType: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  violationBookTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  penaltyBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  penaltyBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  violationRemarks: {
    fontSize: 12,
    marginTop: 4,
  },
  violationDate: {
    fontSize: 10,
    marginTop: 6,
  },
  footerNotice: {
    marginTop: 32,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  footerNoticeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
});
