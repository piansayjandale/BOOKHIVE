import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimatedScreen from "../../components/AnimatedScreen";

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../data/AuthContext";
import { useThemeColors } from "../../hooks/useThemeColors";
import { getReservations, getStudentProfile, subscribe, getNotifications, NotificationItem, ReservationBook } from "../../data/store";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();
  const { user, logout } = useAuth();

  const [reservations, setReservations] = useState(getReservations());
  const [profile, setProfile] = useState(getStudentProfile());
  const [notifications, setNotifications] = useState<NotificationItem[]>(getNotifications());

  useEffect(() => {
    setReservations(getReservations());
    setProfile(getStudentProfile());
    setNotifications(getNotifications());
    return subscribe(() => {
      setReservations(getReservations());
      setProfile(getStudentProfile());
      setNotifications(getNotifications());
    });
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      setReservations(getReservations());
      setProfile(getStudentProfile());
      setNotifications(getNotifications());
    }, [])
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const isStaffRole =
    user?.role === "Admin" ||
    user?.role === "Circulation Librarian" ||
    user?.role === "Technical Librarian" ||
    user?.role === "Librarian";

  const borrowedBooks = reservations.filter((book) => book.status === "Approved");

  // Dynamic overdue loans / violations calculation
  const violations = borrowedBooks
    .filter((b) => {
      if (!b.date) return false;
      const dueDate = new Date(b.date);
      return !isNaN(dueDate.getTime()) && dueDate < new Date();
    })
    .map((b) => ({
      id: `viol-${b.id}`,
      bookTitle: b.title,
      violationType: "Overdue Book Return",
      penaltyAmount: 20.0,
      remarks: `Overdue loan beyond agreed due date (${b.date}). Standard fine applied.`,
      status: "Active Penalty",
    }));

  const studentFullName = user?.fullName || profile.name || "Student";
  const studentCourseSection = `${user?.course || profile.course || "General Program"}${profile.yearlevel ? ` - ${profile.yearlevel}` : ""}`;

  const TOTAL_CARD_ROWS = Math.max(14, borrowedBooks.length);
  const cardTableRows = Array.from({ length: TOTAL_CARD_ROWS }, (_, index) => {
    const item = borrowedBooks[index];
    return {
      id: item?.id || `empty-row-${index}`,
      borrowDate: item?.pickupDate || item?.date || "",
      dueReturnDate: item?.date || item?.returnDate || "",
      bookTitle: item?.title || "",
      hasData: !!item,
    };
  });

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            logout();
            router.replace("/login");
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
        <View style={[styles.header, { paddingTop: 20 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
            {isStaffRole ? "RESTRICTED STUDENT VIEW" : "BOOKHIVE PROFILE"}
          </Text>

          <TouchableOpacity
            style={styles.notificationButtonRelative}
            onPress={() => router.push("/notifications")}
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

        {isStaffRole ? (
          /* ========================================================= */
          /* RESTRICTED VIEW FOR ADMIN & CIRCULATION LIBRARIAN ROLES   */
          /* Exclusively shows: 1. Library Card  2. Violation Record   */
          /* ========================================================= */
          <View style={{ marginTop: 12 }}>
            <View style={styles.staffNoticeBanner}>
              <Ionicons name="shield-checkmark" size={18} color={theme.accentGold} />
              <Text style={[styles.staffNoticeText, { color: theme.textPrimary }]}>
                {user?.role}: Access restricted to Student Library Card & Violation Records.
              </Text>
            </View>

            {/* 1. LIBRARY CARD (BOOK CARD) */}
            <View style={[styles.libraryCardContainer, { backgroundColor: isDarkMode ? '#131E33' : '#F1F5F9', borderColor: isDarkMode ? '#24334C' : '#CBD5E1' }]}>
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

            {/* 2. VIOLATION RECORD */}
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
                        <Text style={[styles.violationBookTitle, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]}>
                          Book: {v.bookTitle}
                        </Text>
                      </View>
                      <View style={styles.penaltyBadge}>
                        <Text style={styles.penaltyBadgeText}>
                          ₱{v.penaltyAmount.toFixed(2)} Fine
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.violationRemarks, { color: isDarkMode ? '#FCA5A5' : '#991B1B' }]}>
                      {v.remarks}
                    </Text>
                  </View>
                ))
              )}
            </View>

            {/* LOGOUT BUTTON */}
            <View style={{ marginHorizontal: 20, marginTop: 24 }}>
              <TouchableOpacity
                style={[styles.staffLogoutBtn, { backgroundColor: isDarkMode ? '#1E293B' : '#FEE2E2', borderColor: isDarkMode ? '#334155' : '#FCA5A5' }]}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                <Text style={styles.staffLogoutText}>Sign Out Staff Session</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* ========================================================= */
          /* STANDARD STUDENT PROFILE VIEW                             */
          /* ========================================================= */
          <>
            {/* PROFILE CARD */}
            <View style={[
              styles.profileCard,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.cardBorder,
                shadowColor: theme.shadowColor,
                shadowOpacity: isDarkMode ? 0.3 : 0.05,
              }
            ]}>
              <Image
                source={{
                  uri: profile.avatar,
                }}
                style={[styles.avatar, { borderColor: theme.cardBorder }] as any}
              />

              <Text style={[styles.name, { color: theme.textPrimary }]}>
                {profile.name}
              </Text>

              <Text style={[styles.course, { color: theme.textSecondary }]}>
                {profile.course}
              </Text>

              <View style={[styles.idBadge, { backgroundColor: theme.background, borderColor: theme.cardBorder }]}>
                <Text style={[styles.idText, { color: theme.accentGold }]}>
                  STUDENT ID: {profile.studentId}
                </Text>
              </View>
            </View>

            {/* STATS SUMMARY CARDS */}
            <View style={styles.statsRow}>
              <View style={[
                styles.statCard,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: theme.cardBorder,
                  shadowColor: theme.shadowColor,
                  shadowOpacity: isDarkMode ? 0.3 : 0.05,
                }
              ]}>
                <Text style={[styles.statNumber, { color: theme.accentGold }]}>
                  {reservations.filter((book) => book.status === 'Pending' || book.status === 'Upcoming' || book.status === 'Reserved').length}
                </Text>

                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Reservations
                </Text>
              </View>

              <View style={[
                styles.statCard,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: theme.cardBorder,
                  shadowColor: theme.shadowColor,
                  shadowOpacity: isDarkMode ? 0.3 : 0.05,
                }
              ]}>
                <Text style={[styles.statNumber, { color: theme.accentGold }]}>
                  {reservations.filter((book) => book.status === 'Approved').length}
                </Text>

                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Borrowed Books
                </Text>
              </View>
            </View>

            {/* SETTINGS SECTION */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.accentGold }]}>
                Settings
              </Text>
            </View>

            <View style={[
              styles.settingsCard,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.cardBorder,
                shadowColor: theme.shadowColor,
                shadowOpacity: isDarkMode ? 0.3 : 0.05,
              }
            ]}>
              <TouchableOpacity
                style={[styles.settingItem, { borderBottomColor: theme.cardBorder }]}
                onPress={() => router.push('/settings')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="settings-outline"
                  size={20}
                  color={theme.accentGold}
                />

                <Text style={[styles.settingText, { color: theme.textPrimary }]}>
                  System Settings
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.settingItem, { borderBottomColor: theme.cardBorder }]}
                onPress={() => router.push('/edit-profile')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={theme.accentGold}
                />

                <Text style={[styles.settingText, { color: theme.textPrimary }]}>
                  Edit Profile
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.settingItem, { borderBottomColor: theme.cardBorder }]}
                onPress={() => router.push('/privacy-security')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={theme.accentGold}
                />

                <Text style={[styles.settingText, { color: theme.textPrimary }]}>
                  Privacy & Security
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.settingItem, styles.logoutItem]}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="log-out-outline"
                  size={20}
                  color="#EF4444"
                />

                <Text style={[styles.settingText, styles.logoutText]}>
                  Sign Out
                </Text>
              </TouchableOpacity>
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
    backgroundColor: "#080F1E",
  },
  header: {
    backgroundColor: "#080F1E",
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#111A2E",
  },
  headerTitle: {
    color: "#F8FAFC",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  profileCard: {
    backgroundColor: "#111A2E",
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1E293B",
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: "#1E293B",
  },
  name: {
    marginTop: 14,
    fontSize: 24,
    fontWeight: "800",
    color: "#F8FAFC",
  },
  course: {
    marginTop: 6,
    color: "#94A3B8",
    fontSize: 14,
  },
  idBadge: {
    marginTop: 14,
    backgroundColor: "#080F1E",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  idText: {
    color: "#FCD34D",
    fontWeight: "700",
    fontSize: 12,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: 20,
  },
  statCard: {
    backgroundColor: "#111A2E",
    width: "48%",
    borderRadius: 20,
    paddingVertical: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1E293B",
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  statNumber: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FCD34D",
  },
  statLabel: {
    marginTop: 8,
    color: "#94A3B8",
    fontSize: 13,
  },
  sectionHeader: {
    marginHorizontal: 20,
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FCD34D",
  },
  settingsCard: {
    backgroundColor: "#111A2E",
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: 22,
    paddingVertical: 6,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: "#1E293B",
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  settingText: {
    marginLeft: 14,
    fontSize: 15,
    color: "#F8FAFC",
    fontWeight: "500",
  },
  logoutItem: {
    borderBottomWidth: 0,
  },
  logoutText: {
    color: "#EF4444",
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

  /* STAFF RESTRICTED VIEW STYLES */
  staffNoticeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    borderColor: "rgba(234, 179, 8, 0.3)",
    borderWidth: 1,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 8,
  },
  staffNoticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
  },
  libraryCardContainer: {
    marginHorizontal: 16,
    marginTop: 12,
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
  violationSectionContainer: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  violationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
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
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearStatusTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
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
    padding: 12,
    marginBottom: 10,
  },
  violationTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
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
    paddingVertical: 3,
    borderRadius: 8,
  },
  penaltyBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  violationRemarks: {
    fontSize: 11,
    marginTop: 4,
  },
  staffLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  staffLogoutText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 14,
  },
});