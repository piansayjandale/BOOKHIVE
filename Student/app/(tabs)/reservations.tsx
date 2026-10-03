import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedScreen from '../../components/AnimatedScreen';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useAuth } from '../../data/AuthContext';
import { getBackendUrl } from '../../data/authService';
import QRCode from 'react-native-qrcode-svg';
import socketService from '../../services/socketService';
import {
  getUpcomingReservations,
  getLibraryCardHistory,
  getStudentProfile,
  subscribe,
  ReservationBook,
  getNotifications,
  NotificationItem,
} from '../../data/store';

export default function ReservationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isDarkMode, theme } = useThemeColors();
  
  const [activeTab, setActiveTab] = useState<'card' | 'reserved'>('card');
  const [showQrModal, setShowQrModal] = useState(false);
  const [activeReservations, setActiveReservations] = useState<ReservationBook[]>(
    getUpcomingReservations()
  );
  const [libraryCardBooks, setLibraryCardBooks] = useState<ReservationBook[]>(
    getLibraryCardHistory()
  );
  const [profile, setProfile] = useState(getStudentProfile());
  const [notifications, setNotifications] = useState<NotificationItem[]>(getNotifications());
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
    const isUrgent = diff < 2 * 60 * 60 * 1000; // Under 2 hours remaining
    return { text, isUrgent, isExpired: false };
  };

  useEffect(() => {
    setActiveReservations(getUpcomingReservations());
    setLibraryCardBooks(getLibraryCardHistory());
    setProfile(getStudentProfile());
    setNotifications(getNotifications());

    const unsubStore = subscribe(() => {
      setActiveReservations(getUpcomingReservations());
      setLibraryCardBooks(getLibraryCardHistory());
      setProfile(getStudentProfile());
      setNotifications(getNotifications());
    });

    const unsubReturn = socketService.subscribeToReturn(() => {
      setLibraryCardBooks(getLibraryCardHistory());
    });

    return () => {
      unsubStore();
      unsubReturn();
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      setActiveReservations(getUpcomingReservations());
      setLibraryCardBooks(getLibraryCardHistory());
      setProfile(getStudentProfile());
      setNotifications(getNotifications());
    }, [])
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const reservedBooks = activeReservations.filter(
    (book) => book.action === 'Reserve' || (book.status === 'Pending' && book.action !== 'Borrow') || book.status === 'Waitlisted'
  );

  const studentFullName = user?.fullName || profile.name || "Student";
  const studentCourseSection = `${user?.course || profile.course || "General Program"}${profile.yearlevel ? ` - ${profile.yearlevel}` : ""}`;
  const studentIdentifier = user?.studentId || user?.qrCode || profile.studentId || profile.qrCode || user?.id || "23-1111-111";
  const backendBase = getBackendUrl();
  const studentQrPayload = `${backendBase}/verify/${encodeURIComponent(studentIdentifier)}`;

  const openCardRecords = () => {
    setShowQrModal(false);
    router.push({
      pathname: "/scanned-card",
      params: { qr: studentIdentifier },
    });
  };

  const navigateToDetails = (book: ReservationBook, isReadyToBorrow = false) => {
    if (isReadyToBorrow) {
      const studentDept = user?.course || user?.department || profile?.course || profile?.department || 'BS in Information Technology';
      router.push({
        pathname: "/borrow",
        params: {
          title: book.title,
          author: book.author,
          isbn: book.isbn || "",
          department: studentDept,
          action: "Borrow",
        },
      });
      return;
    }

    router.push({
      pathname: "/book-details",
      params: {
        from: "reservations",
        id: book.id,
        title: book.title,
        author: book.author,
        isbn: book.isbn || "",
        description: book.description || "No description available.",
        year: String(book.year || "2024"),
        pages: String(book.pages || "320"),
        language: book.language || "EN",
        available: book.available !== undefined ? String(book.available) : 'true',
        copies: (book as any).copies ? String((book as any).copies) : undefined,
      },
    });
  };

  // Build rows for the Library Card table (minimum 16 rows to match the reference design visual)
  // All borrowed books (active + returned history) are preserved here and never disappear
  const TOTAL_CARD_ROWS = Math.max(16, libraryCardBooks.length);
  const cardTableRows = Array.from({ length: TOTAL_CARD_ROWS }, (_, index) => {
    const item = libraryCardBooks[index];
    const isReturned = !!(item?.isReturned || item?.status === 'Completed' || item?.date === 'Returned');
    return {
      id: item?.id || `empty-row-${index}`,
      borrowDate: item?.pickupDate || (item?.date !== 'Returned' ? item?.date : "") || "",
      dueReturnDate: item?.returnDate || (item?.date !== 'Returned' ? item?.date : "") || "",
      bookTitle: item?.title || "",
      hasData: !!item,
      isReturned,
    };
  });

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      {/* GLOBAL SCREEN HEADER */}
      <View style={[styles.header, { paddingTop: 18 + insets.top, height: 70 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
        <TouchableOpacity onPress={() => router.push("/")} activeOpacity={0.7}>
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDarkMode ? theme.accentGold : theme.accentBlue}
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.headerTitle }]}>
          CARD & RESERVATIONS
        </Text>

        <TouchableOpacity
          style={styles.notificationButtonRelative}
          onPress={() => router.push('/notifications')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="notifications-outline"
            size={24}
            color={isDarkMode ? theme.accentGold : theme.accentBlue}
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
              activeTab === 'card'
                ? [styles.activePill, !isDarkMode && { backgroundColor: theme.accentBlue }]
                : [
                    styles.inactivePill,
                    {
                      backgroundColor: isDarkMode ? '#111A2E' : '#E2E8F0',
                      borderColor: isDarkMode ? '#1E293B' : '#CBD5E1',
                    },
                  ],
            ]}
            onPress={() => setActiveTab('card')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.pillText,
                activeTab === 'card'
                  ? [styles.activePillText, !isDarkMode && { color: '#FFFFFF' }]
                  : [styles.inactivePillText, { color: isDarkMode ? '#94A3B8' : '#475569' }],
              ]}
            >
              Library Card
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.pillButton,
              activeTab === 'reserved'
                ? [styles.activePill, !isDarkMode && { backgroundColor: theme.accentBlue }]
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
                  ? [styles.activePillText, !isDarkMode && { color: '#FFFFFF' }]
                  : [styles.inactivePillText, { color: isDarkMode ? '#94A3B8' : '#475569' }],
              ]}
            >
              Reserved Books
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Section Content rendering based on activeTab */}
        {activeTab === 'card' ? (
          /* TAB 1: LIBRARY CARD VIEW (Matches image_1adceb.png) */
          <View style={[styles.libraryCardContainer, { backgroundColor: isDarkMode ? '#131E33' : '#F1F5F9', borderColor: isDarkMode ? '#24334C' : theme.cardBorder }]}>
            {/* CARD TITLE & QR CODE GENERATOR TRIGGER */}
            <View style={styles.cardTopHeader}>
              <View style={{ width: 32 }} />
              <Text style={[styles.cardMainTitle, { color: isDarkMode ? '#FFFFFF' : theme.accentBlue }]}>
                LIBRARY CARD
              </Text>
              <TouchableOpacity
                style={[
                  styles.qrScanIconBtn,
                  !isDarkMode && {
                    backgroundColor: theme.badgeYellowBg,
                    borderColor: theme.badgeYellowBorder,
                    borderWidth: 1,
                    borderRadius: 10,
                    padding: 5,
                  }
                ]}
                onPress={() => setShowQrModal(true)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name="qrcode-scan"
                  size={24}
                  color={isDarkMode ? '#FFFFFF' : '#0274BB'}
                />
              </TouchableOpacity>
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
                    Borrow Date{"\n"}& Time:
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
                  key={`card-row-${row.id}-${idx}`}
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

                  <View
                    style={[
                      styles.colDueDate,
                      { borderRightColor: isDarkMode ? '#273752' : '#E2E8F0' },
                      row.hasData && !row.isReturned && {
                        backgroundColor: isDarkMode ? 'rgba(74, 222, 128, 0.22)' : '#86EFAC',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.cellDataText,
                        row.hasData && !row.isReturned
                          ? {
                              color: isDarkMode ? '#86EFAC' : '#064E3B',
                              fontWeight: '700',
                            }
                          : {
                              color: isDarkMode ? '#CBD5E1' : '#334155',
                            },
                      ]}
                      numberOfLines={1}
                    >
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
        ) : (
          /* TAB 2: PRESERVED RESERVED BOOKS TAB (Completely untouched layout & logic) */
          <>
            {/* SECTION HEADING: RESERVED BOOKS */}
            <View style={styles.sectionHeaderContainer}>
              <Text style={[styles.sectionTitle, { color: isDarkMode ? theme.accentGold : theme.accentBlue }]}>
                Reserved Books
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Books currently you reserved
              </Text>
            </View>

            {/* STATE 3 or STATE 4 */}
            {reservedBooks.length > 0 ? (
              reservedBooks.map((book, bIdx) => {
                const isReadyToBorrow = book.available === "true" || book.available === "Available";
                const countdown = isReadyToBorrow ? getReservationCountdown(book) : null;

                return (
                  <View
                    key={`reserved-book-${book.id}-${bIdx}`}
                    style={[
                      styles.cardContainer,
                      {
                        backgroundColor: theme.cardBg,
                        borderColor: isReadyToBorrow ? "#10B981" : theme.cardBorder,
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
                        {isReadyToBorrow ? (
                          <Text style={{ color: "#10B981", fontSize: 12, fontWeight: "700", marginTop: 4 }}>
                            ✓ 1 Copy Available · Ready to Borrow!
                          </Text>
                        ) : (
                          <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 4 }}>
                            Waitlist Queue #{book.queuePosition || 1} {book.estimatedWait ? `· Est. ${book.estimatedWait}` : ""}
                          </Text>
                        )}
                      </View>

                      <View style={styles.cardRightColumn}>
                        <View style={[
                          styles.reservedBadge,
                          isReadyToBorrow
                            ? { backgroundColor: "rgba(16, 185, 129, 0.15)", borderColor: "#10B981" }
                            : { backgroundColor: "rgba(168, 85, 247, 0.15)", borderColor: "#A855F7" }
                        ]}>
                          <Text style={[
                            styles.reservedBadgeText,
                            isReadyToBorrow ? { color: "#10B981" } : { color: "#C084FC" }
                          ]}>
                            {isReadyToBorrow ? "AVAILABLE (1 DAY)" : "WAITLISTED"}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {isReadyToBorrow && countdown && (
                      <View style={{
                        marginTop: 10,
                        marginBottom: 10,
                        padding: 10,
                        borderRadius: 12,
                        backgroundColor: countdown.isUrgent ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)",
                        borderWidth: 1,
                        borderColor: countdown.isUrgent ? "#EF4444" : "#10B981",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}>
                        <Ionicons name="timer-outline" size={18} color={countdown.isUrgent ? "#EF4444" : "#10B981"} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: "800", color: countdown.isUrgent ? "#EF4444" : "#10B981" }}>
                            Claim Window: {countdown.text}
                          </Text>
                          <Text style={{ fontSize: 10.5, color: theme.textSecondary, marginTop: 2 }}>
                            {countdown.isExpired
                              ? "The 24-hour pickup window has expired. Reservation is being voided."
                              : "Pick up or borrow within 24 hours. If unclaimed, this hold is automatically voided."}
                          </Text>
                        </View>
                      </View>
                    )}

                    {isReadyToBorrow ? (
                      <TouchableOpacity
                        style={[
                          styles.fullWidthActionBtn,
                          {
                            backgroundColor: countdown?.isExpired ? "#64748B" : "#10B981",
                            borderColor: countdown?.isExpired ? "#64748B" : "#10B981",
                          },
                        ]}
                        disabled={countdown?.isExpired}
                        onPress={() => navigateToDetails(book, true)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.actionBtnText, { color: "#FFFFFF", fontWeight: "700" }]}>
                          {countdown?.isExpired ? "Reservation Expired" : "Borrow Now (Claim Copy)"}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.fullWidthActionBtn,
                          {
                            backgroundColor: isDarkMode ? '#1E293B' : theme.accentBlue,
                            borderColor: isDarkMode ? '#334155' : theme.accentBlue,
                          },
                        ]}
                        onPress={() => navigateToDetails(book, false)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>View Details</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
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

      {/* STUDENT QR CODE DISPLAY MODAL */}
      <Modal
        visible={showQrModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQrModal(false)}
      >
        <View style={styles.qrModalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowQrModal(false)}
          />

          <View style={[styles.qrModalCard, { backgroundColor: isDarkMode ? '#111A2E' : '#FFFFFF', borderColor: isDarkMode ? '#24334C' : '#CBD5E1' }]}>
            {/* Modal Top Header */}
            <View style={styles.qrModalHeader}>
              <View style={styles.qrModalHeaderLeft}>
                <View style={[styles.qrBadgeCircle, !isDarkMode && { backgroundColor: "rgba(2, 116, 187, 0.1)" }]}>
                  <MaterialCommunityIcons name="qrcode" size={20} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
                </View>
                <View>
                  <Text style={[styles.qrModalTitle, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                    STUDENT QR CODE
                  </Text>
                  <Text style={[styles.qrModalSubtitle, { color: theme.textSecondary }]}>
                    Official BookHive Library Pass
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.qrCloseBtn, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}
                onPress={() => setShowQrModal(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={isDarkMode ? '#94A3B8' : '#475569'} />
              </TouchableOpacity>
            </View>

            {/* QR Code Container (Interactive) */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={openCardRecords}
              style={styles.qrCodeWrapper}
            >
              <View style={styles.qrCodeBox}>
                <QRCode
                  value={studentQrPayload}
                  size={190}
                  color="#0F172A"
                  backgroundColor="#FFFFFF"
                />
              </View>
              <View style={styles.qrTapHint}>
                <Ionicons name="eye-outline" size={13} color="#64748B" />
                <Text style={styles.qrTapHintText}>Tap QR to preview card & violations</Text>
              </View>
            </TouchableOpacity>

            {/* Student Information */}
            <View style={[styles.qrStudentInfoBox, { backgroundColor: isDarkMode ? '#16233B' : '#F8FAFC', borderColor: isDarkMode ? '#283850' : '#E2E8F0' }]}>
              {((user?.avatar || profile.avatar) && ((user?.avatar || profile.avatar).startsWith('http') || (user?.avatar || profile.avatar).startsWith('data:')) && !(user?.avatar || profile.avatar).includes('placeholder.com')) ? (
                <Image
                  source={{ uri: user?.avatar || profile.avatar }}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    borderWidth: 2,
                    borderColor: isDarkMode ? theme.accentGold : theme.accentBlue,
                    marginBottom: 8,
                  }}
                  resizeMode="cover"
                />
              ) : (
                <View style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: isDarkMode ? 'rgba(255, 215, 0, 0.15)' : 'rgba(2, 116, 187, 0.12)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 1.5,
                  borderColor: isDarkMode ? theme.accentGold : theme.accentBlue,
                  marginBottom: 8,
                }}>
                  <Ionicons name="person" size={26} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
                </View>
              )}
              <Text style={[styles.qrStudentName, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]} numberOfLines={1}>
                {studentFullName}
              </Text>
              <View style={styles.qrIdBadgeRow}>
                <Text style={styles.qrStudentID}>
                  ID: {user?.studentId || profile.studentId || "23-1111-111"}
                </Text>
              </View>
              <Text style={[styles.qrStudentCourse, { color: theme.textSecondary }]} numberOfLines={1}>
                {studentCourseSection}
              </Text>
            </View>

            <Text style={[styles.qrInstructionText, { color: theme.textMuted }]}>
              Present this QR code to the librarian or scan via mobile to verify your Library Card and borrowing records.
            </Text>

            {/* Primary Action Button: View Library Card & Violations */}
            <TouchableOpacity
              style={[styles.qrViewRecordBtn, { backgroundColor: isDarkMode ? theme.accentGold : theme.accentBlue }]}
              onPress={openCardRecords}
              activeOpacity={0.8}
            >
              <Ionicons name="open-outline" size={17} color={isDarkMode ? '#080F1E' : '#FFFFFF'} style={{ marginRight: 6 }} />
              <Text style={[styles.qrViewRecordBtnText, { color: isDarkMode ? '#080F1E' : '#FFFFFF' }]}>
                View Library Card & Violations
              </Text>
            </TouchableOpacity>

            {/* Dismiss Button */}
            <TouchableOpacity
              style={[
                styles.qrDismissBtn,
                {
                  backgroundColor: isDarkMode ? '#1E293B' : '#E2E8F0',
                  borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                  borderWidth: 1,
                  marginTop: 8,
                },
              ]}
              onPress={() => setShowQrModal(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.qrDismissBtnText, { color: theme.textPrimary }]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
    paddingHorizontal: 16,
    marginTop: 18,
    gap: 12,
    alignItems: 'center',
  },
  pillButton: {
    paddingVertical: 10,
    paddingHorizontal: 22,
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

  /* LIBRARY CARD CONTAINER (image_1adceb.png) */
  libraryCardContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
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
  qrScanIconBtn: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
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
    width: '36%',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    justifyContent: 'center',
  },
  colDueDate: {
    width: '26%',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  colBookTitle: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  colHeaderText: {
    fontSize: 9.5,
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
    fontSize: 9,
    fontWeight: '500',
  },
  cellDataTitleText: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
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

  /* QR CODE DISPLAY MODAL STYLES */
  qrModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  qrModalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  qrModalHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  qrModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qrBadgeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  qrModalSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  qrCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrCodeWrapper: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCodeBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrStudentInfoBox: {
    width: '100%',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 4,
  },
  qrStudentName: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  qrIdBadgeRow: {
    marginTop: 4,
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  qrStudentID: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFD700',
    letterSpacing: 0.5,
  },
  qrStudentCourse: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  qrInstructionText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
    lineHeight: 15,
    paddingHorizontal: 6,
  },
  qrTapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  qrTapHintText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  qrViewRecordBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 4,
  },
  qrViewRecordBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  qrDismissBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrDismissBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
});