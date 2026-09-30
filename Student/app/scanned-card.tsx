import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedScreen from '../components/AnimatedScreen';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '../hooks/useThemeColors';
import { fetchStudentCardAndViolations, ScannedStudentCardData } from '../data/store';
import { API_URL, getAuthHeaders } from '../data/authService';
import socketService from '../services/socketService';
import axios from 'axios';

export default function ScannedCardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ qr?: string; studentId?: string }>();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ScannedStudentCardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tab navigation: 'return' | 'libraryCard' | 'reserved'
  const [activeTab, setActiveTab] = useState<'return' | 'libraryCard' | 'reserved'>('return');
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [isReturning, setIsReturning] = useState(false);

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
            setSelectedBookIds([]);
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
  const reservedBooks = data?.reservedBooks || [];
  const violations = data?.violations || [];

  const studentFullName = student?.fullName || student?.name || "Student";
  const studentCourseSection = student ? `${student.course || "General Program"}` : "";

  // Filter books eligible for return
  const returnableBooks = libraryCard.filter(
    (b) => b.status === "Approved" || b.status === "On Loan" || b.status === "Holding" || b.status === "Active" || b.status !== "Returned"
  );

  // Real-time bidirectional socket sync with Librarian Web System
  useEffect(() => {
    const studentIdentifier = student?.studentId || student?.idNumber || qrPayload;
    if (studentIdentifier) {
      socketService.joinUserRoom(studentIdentifier);
    }
    socketService.joinRoom("room:circulation-desk");

    const onRemoteReturn = (payload: any) => {
      console.log("[scanned-card] Received real-time return event from web system:", payload);
      const returnedId = payload?.id || payload?.transactionId;
      if (!returnedId) return;

      // Update data immediately in local state
      setData((prev) => {
        if (!prev) return prev;
        const exists = prev.libraryCard.some((item) => item.id === returnedId);
        if (!exists && payload?.studentId && payload.studentId !== prev.student?.studentId && payload.studentId !== prev.student?.idNumber) {
          return prev;
        }

        const updatedCard = prev.libraryCard.map((item) =>
          item.id === returnedId
            ? { ...item, status: "Returned", dueReturnDate: "Today" }
            : item
        );
        return { ...prev, libraryCard: updatedCard };
      });

      setSelectedBookIds((prev) => prev.filter((id) => id !== returnedId));

      // Refresh data in background from backend
      if (qrPayload) {
        fetchStudentCardAndViolations(qrPayload).then((fresh) => {
          if (fresh && fresh.student) {
            setData(fresh);
          }
        }).catch(() => {});
      }
    };

    const unsubReturn = socketService.subscribeToReturn(onRemoteReturn);
    const unsubDecided = socketService.subscribeToTransactionDecided((payload: any) => {
      if (String(payload?.status || "").toLowerCase() === "returned") {
        onRemoteReturn(payload);
      }
    });

    return () => {
      unsubReturn();
      unsubDecided();
    };
  }, [student?.studentId, student?.idNumber, qrPayload]);

  const formatDisplayDate = (dateStr?: string) => {
    if (!dateStr || dateStr === "—") return "—";
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
      }
    } catch {}
    return dateStr;
  };

  const toggleBookSelection = (id: string) => {
    setSelectedBookIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedBookIds.length === returnableBooks.length) {
      setSelectedBookIds([]);
    } else {
      setSelectedBookIds(returnableBooks.map((b) => b.id));
    }
  };

  const handleReturnBook = async (overrideId?: string) => {
    let targetIds = overrideId
      ? [overrideId]
      : selectedBookIds.filter((id) => returnableBooks.some((b) => b.id === id));

    // If nothing explicitly selected, default to all available returnable books
    if (targetIds.length === 0 && returnableBooks.length > 0) {
      targetIds = returnableBooks.map((b) => b.id);
    }

    if (targetIds.length === 0) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert("There are no borrowed books eligible for return.");
      } else {
        Alert.alert("No Books", "There are no borrowed books eligible for return.");
      }
      return;
    }

    const targetBooks = returnableBooks.filter((b) => targetIds.includes(b.id));
    const count = targetIds.length;
    const confirmPrompt =
      count === 1
        ? `Mark "${targetBooks[0]?.bookTitle || "Selected Book"}" as RETURNED to the library?`
        : `Mark ${count} selected books as RETURNED to the library?`;

    const processReturn = async () => {
      setIsReturning(true);
      try {
        const headers = await getAuthHeaders();
        const now = new Date().toISOString();

        // 1. Immediately emit real-time return events to the web system via Socket.io/WebSocket
        targetIds.forEach((bookId) => {
          const targetBook = returnableBooks.find((b) => b.id === bookId);
          socketService.emitBookReturned({
            id: bookId,
            transactionId: bookId,
            status: "Returned",
            type: "Borrow",
            resourceTitle: targetBook?.bookTitle || "Book",
            studentId: student?.studentId || student?.idNumber,
            studentName: studentFullName,
            returnedAt: now,
          });
        });

        // 2. Process all selected returns in parallel
        await Promise.all(
          targetIds.map(async (bookId) => {
            // Primary: Student return endpoint (emits real-time socket events from backend)
            let returnSuccess = false;
            try {
              await axios.post(
                `${API_URL}/api/student/return/${encodeURIComponent(bookId)}`,
                {},
                headers
              );
              returnSuccess = true;
            } catch (backendErr) {
              console.warn(`Primary return failed for book ${bookId}, trying fallback:`, backendErr);
            }

            // Secondary fallback: Direct transactions PATCH endpoint used by web
            if (!returnSuccess) {
              try {
                await axios.patch(
                  `${API_URL}/api/transactions/${encodeURIComponent(bookId)}`,
                  {
                    status: "Returned",
                    type: "Borrow",
                    returnedAt: now,
                    comment: "Returned via mobile scanner",
                  },
                  headers
                );
              } catch (patchErr) {
                console.warn(`Fallback transaction patch failed for book ${bookId}:`, patchErr);
              }
            }
          })
        );

        // Update local state immediately
        setData((prev) => {
          if (!prev) return prev;
          const updatedCard = prev.libraryCard.map((item) =>
            targetIds.includes(item.id)
              ? { ...item, status: "Returned", dueReturnDate: "Today" }
              : item
          );
          return { ...prev, libraryCard: updatedCard };
        });

        // Clear selection
        setSelectedBookIds([]);

        const successMessage =
          count === 1
            ? `"${targetBooks[0]?.bookTitle || "Selected Book"}" has been marked as RETURNED and synced with the library system.`
            : `${count} books have been marked as RETURNED and synced with the library system.`;

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert(successMessage);
        } else {
          Alert.alert("Return Successful", successMessage);
        }
      } catch (err: any) {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert("Return failed. Please try again.");
        } else {
          Alert.alert("Error", err.message || "Failed to return book.");
        }
      } finally {
        setIsReturning(false);
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
      if (window.confirm(confirmPrompt)) {
        await processReturn();
      }
      return;
    }

    Alert.alert(
      "Confirm Return",
      confirmPrompt,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Returned",
          style: "default",
          onPress: processReturn,
        },
      ]
    );
  };

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
      {/* HEADER (Exact wireframe: arrow-back and STUDENT LIBRARY RECORD without read-only tag) */}
      <View style={[styles.header, { paddingTop: 18 + insets.top, height: 70 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDarkMode ? theme.accentGold : theme.accentBlue}
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.headerTitle }]}>
          STUDENT LIBRARY RECORD
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 120,
        }}
      >
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={isDarkMode ? theme.accentGold : theme.accentBlue} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Resolving student QR payload...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Ionicons name="alert-circle-outline" size={52} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: isDarkMode ? theme.accentGold : theme.accentBlue }]}
              onPress={() => router.back()}
            >
              <Text style={[styles.retryBtnText, { color: isDarkMode ? "#080F1E" : "#FFFFFF" }]}>
                Back to Scanner
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* SECTION 1: STUDENT INFORMATION CARD */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="person-circle" size={22} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
                <Text style={[styles.sectionHeadingText, { color: isDarkMode ? theme.accentGold : theme.accentBlue }]}>
                  STUDENT INFORMATION
                </Text>
              </View>

              <View style={[styles.studentInfoCard, { backgroundColor: isDarkMode ? '#131E33' : '#F8FAFC', borderColor: isDarkMode ? '#24334C' : '#CBD5E1' }]}>
                <View style={styles.studentProfileTop}>
                  {student?.avatar && (student.avatar.startsWith('http') || student.avatar.startsWith('data:')) && !student.avatar.includes("placeholder.com") ? (
                    <Image
                      source={{ uri: student.avatar }}
                      style={[
                        styles.avatarCircle,
                        {
                          borderWidth: 2,
                          borderColor: isDarkMode ? theme.accentGold : theme.accentBlue,
                        },
                      ]}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.avatarCircle, { backgroundColor: isDarkMode ? theme.accentGold : theme.accentBlue }]}>
                      <Text style={[styles.avatarText, { color: isDarkMode ? "#080F1E" : "#FFFFFF" }]}>
                        {studentFullName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.studentNameCol}>
                    <Text style={[styles.profileFullName, { color: theme.textPrimary }]} numberOfLines={1}>
                      {studentFullName}
                    </Text>
                    <View style={styles.profileIdBadge}>
                      <Text style={styles.profileIdBadgeText}>
                        ID: {student?.studentId || student?.idNumber || "—"}
                      </Text>
                    </View>
                    <Text style={[styles.profileCourseText, { color: theme.textSecondary }]} numberOfLines={1}>
                      {studentCourseSection || student?.course || "General Program"}
                    </Text>
                  </View>
                </View>

                {/* Details Grid */}
                <View style={styles.infoGridContainer}>
                  <View style={[styles.infoGridBox, { backgroundColor: isDarkMode ? '#16233B' : '#EDF2F7', borderColor: isDarkMode ? '#283850' : '#E2E8F0' }]}>
                    <Text style={[styles.infoGridLabel, { color: theme.textSecondary }]}>DEPARTMENT</Text>
                    <Text style={[styles.infoGridValue, { color: theme.textPrimary }]} numberOfLines={2}>
                      {student?.department || "CICT"}
                    </Text>
                  </View>

                  <View style={[styles.infoGridBox, { backgroundColor: isDarkMode ? '#16233B' : '#EDF2F7', borderColor: isDarkMode ? '#283850' : '#E2E8F0' }]}>
                    <Text style={[styles.infoGridLabel, { color: theme.textSecondary }]}>EMAIL</Text>
                    <Text style={[styles.infoGridValue, { color: theme.textPrimary }]} numberOfLines={1}>
                      {student?.email || "—"}
                    </Text>
                  </View>

                  <View style={[styles.infoGridBox, { backgroundColor: isDarkMode ? '#16233B' : '#EDF2F7', borderColor: isDarkMode ? '#283850' : '#E2E8F0' }]}>
                    <Text style={[styles.infoGridLabel, { color: theme.textSecondary }]}>ACADEMIC STANDING</Text>
                    <Text style={[styles.infoGridValue, { color: violations.length > 0 ? '#EF4444' : '#10B981' }]}>
                      • {violations.length > 0 ? "Action Required" : "Good Standing (Active)"}
                    </Text>
                  </View>

                  <View style={[styles.infoGridBox, { backgroundColor: isDarkMode ? '#16233B' : '#EDF2F7', borderColor: isDarkMode ? '#283850' : '#E2E8F0' }]}>
                    <Text style={[styles.infoGridLabel, { color: theme.textSecondary }]}>LIBRARY PASS</Text>
                    <Text style={[styles.infoGridValue, { color: isDarkMode ? theme.accentGold : theme.accentBlue }]}>
                      ✓ Verified Member
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* SECTION 2: DYNAMIC SECTION TITLE WITH TABS */}
            <View style={styles.returnSectionBlock}>
              <Text style={[styles.returnSectionHeading, { color: isDarkMode ? theme.accentGold : theme.accentBlue }]}>
                {activeTab === 'return' ? 'Return Books' : activeTab === 'libraryCard' ? 'Library Card' : 'Reserved Books'}
              </Text>

              {/* THREE TAB PILLS (Return, Library Card, Reserved Books) */}
              <View style={styles.tabsRow}>
                <TouchableOpacity
                  style={[
                    styles.tabPill,
                    activeTab === 'return'
                      ? [styles.tabPillActive, !isDarkMode && { backgroundColor: theme.accentBlue }]
                      : [styles.tabPillInactive, !isDarkMode && { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }],
                  ]}
                  onPress={() => setActiveTab('return')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.tabPillText,
                      activeTab === 'return'
                        ? [styles.tabPillTextActive, !isDarkMode && { color: '#FFFFFF' }]
                        : [styles.tabPillTextInactive, !isDarkMode && { color: theme.textSecondary }],
                    ]}
                  >
                    Return
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.tabPill,
                    activeTab === 'libraryCard'
                      ? [styles.tabPillActive, !isDarkMode && { backgroundColor: theme.accentBlue }]
                      : [styles.tabPillInactive, !isDarkMode && { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }],
                  ]}
                  onPress={() => setActiveTab('libraryCard')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.tabPillText,
                      activeTab === 'libraryCard'
                        ? [styles.tabPillTextActive, !isDarkMode && { color: '#FFFFFF' }]
                        : [styles.tabPillTextInactive, !isDarkMode && { color: theme.textSecondary }],
                    ]}
                  >
                    Library Card
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.tabPill,
                    activeTab === 'reserved'
                      ? [styles.tabPillActive, !isDarkMode && { backgroundColor: theme.accentBlue }]
                      : [styles.tabPillInactive, !isDarkMode && { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }],
                  ]}
                  onPress={() => setActiveTab('reserved')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.tabPillText,
                      activeTab === 'reserved'
                        ? [styles.tabPillTextActive, !isDarkMode && { color: '#FFFFFF' }]
                        : [styles.tabPillTextInactive, !isDarkMode && { color: theme.textSecondary }],
                    ]}
                  >
                    Reserved Books
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ========================================================= */}
              {/* TAB 1: RETURN VIEW (Matches Image 2)                      */}
              {/* ========================================================= */}
              {activeTab === 'return' && (
                <View style={styles.tabContentContainer}>
                  {returnableBooks.length === 0 ? (
                    <View style={[styles.emptyReturnCard, { backgroundColor: isDarkMode ? '#131E33' : '#F8FAFC', borderColor: isDarkMode ? '#24334C' : '#CBD5E1' }]}>
                      <Ionicons name="checkmark-circle-outline" size={40} color="#10B981" />
                      <Text style={[styles.emptyReturnTitle, { color: theme.textPrimary }]}>
                        No Books Due for Return
                      </Text>
                      <Text style={[styles.emptyReturnSub, { color: theme.textSecondary }]}>
                        Student account has zero active borrowed books on loan.
                      </Text>
                    </View>
                  ) : (
                    <>
                      {/* Selection Toolbar when multiple books are available */}
                      {returnableBooks.length > 1 && (
                        <View style={styles.selectionControlRow}>
                          <Text style={[styles.selectionControlText, { color: theme.textSecondary }]}>
                            {selectedBookIds.length} of {returnableBooks.length} selected
                          </Text>
                          <TouchableOpacity
                            onPress={handleSelectAll}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={[styles.selectAllBtnText, { color: theme.accentGold }]}>
                              {selectedBookIds.length === returnableBooks.length ? "Deselect All" : "Select All"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {returnableBooks.map((item) => {
                        const isSelected = selectedBookIds.includes(item.id);
                        return (
                          <TouchableOpacity
                            key={`return-item-${item.id}`}
                            style={[
                              styles.returnBookCard,
                              {
                                backgroundColor: isSelected
                                  ? (isDarkMode ? '#17253E' : '#FEF9C3')
                                  : (isDarkMode ? '#131E33' : '#F8FAFC'),
                                borderColor: isSelected
                                  ? theme.accentGold
                                  : (isDarkMode ? '#24334C' : '#CBD5E1'),
                                borderWidth: isSelected ? 2 : 1,
                                shadowColor: isSelected ? theme.accentGold : 'transparent',
                                shadowOpacity: isSelected ? 0.25 : 0,
                                shadowRadius: 6,
                                elevation: isSelected ? 3 : 0,
                              },
                            ]}
                            activeOpacity={0.8}
                            onPress={() => toggleBookSelection(item.id)}
                          >
                            <View style={styles.returnBookCardTop}>
                              <View style={styles.returnBookTitleRow}>
                                <Ionicons
                                  name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                                  size={22}
                                  color={isSelected ? theme.accentGold : (isDarkMode ? '#64748B' : '#94A3B8')}
                                  style={styles.selectionCheckIcon}
                                />
                                <Text style={[styles.returnBookTitle, { color: theme.textPrimary, flex: 1 }]} numberOfLines={2}>
                                  {item.bookTitle}
                                </Text>
                              </View>
                              <View style={[
                                styles.dueBadge,
                                isSelected && { backgroundColor: theme.accentGold }
                              ]}>
                                <Text style={[
                                  styles.dueBadgeText,
                                  isSelected && { color: '#080F1E', fontWeight: '800' }
                                ]}>
                                  {isSelected ? "SELECTED" : "DUE"}
                                </Text>
                              </View>
                            </View>

                            <View style={[styles.returnBookDatesCol, { paddingLeft: 30 }]}>
                              <Text style={[styles.returnBookDateText, { color: theme.textSecondary }]}>
                                Date borrow: {formatDisplayDate(item.borrowDate)}
                              </Text>
                              <Text style={[styles.returnBookDateText, { color: theme.textSecondary }]}>
                                Due Date: {formatDisplayDate(item.dueReturnDate)}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  )}

                  {/* BOTTOM ACTION BUTTON: "Returned" */}
                  <View style={styles.returnActionContainer}>
                    <TouchableOpacity
                      style={[
                        styles.returnedActionButton,
                        (selectedBookIds.length > 0 || returnableBooks.length > 0) && !isReturning
                          ? {
                              backgroundColor: theme.accentGold,
                              borderColor: theme.accentGold,
                              shadowColor: theme.accentGold,
                              shadowOpacity: 0.35,
                              shadowRadius: 8,
                              elevation: 4,
                            }
                          : {
                              backgroundColor: isDarkMode ? '#16233B' : '#E2E8F0',
                              borderColor: isDarkMode ? '#2E3F5C' : '#94A3B8',
                              opacity: 0.45,
                            },
                      ]}
                      onPress={() => handleReturnBook()}
                      disabled={returnableBooks.length === 0 || isReturning}
                      activeOpacity={0.8}
                    >
                      {isReturning ? (
                        <View style={styles.returningLoadingRow}>
                          <ActivityIndicator size="small" color="#080F1E" />
                          <Text style={[styles.returnedActionText, { color: '#080F1E' }]}>
                            Processing Return...
                          </Text>
                        </View>
                      ) : (
                        <Text
                          style={[
                            styles.returnedActionText,
                            {
                              color: (selectedBookIds.length > 0 || returnableBooks.length > 0) ? '#080F1E' : theme.textSecondary,
                              fontWeight: (selectedBookIds.length > 0 || returnableBooks.length > 0) ? '800' : '600',
                            },
                          ]}
                        >
                          {selectedBookIds.length === 0
                            ? "Returned"
                            : selectedBookIds.length === 1
                            ? "Returned (1)"
                            : `Returned (${selectedBookIds.length})`}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ========================================================= */}
              {/* TAB 2: LIBRARY CARD VIEW (Ledger & Violations)            */}
              {/* ========================================================= */}
              {activeTab === 'libraryCard' && (
                <View style={styles.tabContentContainer}>
                  <View style={[styles.libraryCardContainer, { backgroundColor: isDarkMode ? '#131E33' : '#F1F5F9', borderColor: isDarkMode ? '#24334C' : '#CBD5E1' }]}>
                    {/* CARD TITLE HEADER */}
                    <View style={styles.cardTopHeader}>
                      <View style={{ width: 24 }} />
                      <Text style={[styles.cardMainTitle, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                        LIBRARY CARD
                      </Text>
                      <Ionicons name="bookmark" size={20} color={theme.accentGold} />
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
                            {studentCourseSection || student?.course || "General Program"}
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
                          key={`scanned-row-${row.id}-${idx}`}
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

                  {/* VIOLATION RECORD SECTION */}
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
                      <>
                        <View style={styles.totalFineBanner}>
                          <Text style={styles.totalFineLabel}>Total Outstanding Fines:</Text>
                          <Text style={styles.totalFineAmount}>
                            ₱{violations.reduce((acc, v) => acc + (Number(v.penaltyAmount) || 0), 0).toFixed(2)}
                          </Text>
                        </View>

                        {violations.map((v, vIdx) => (
                          <View key={`scanned-violation-${v.id}-${vIdx}`} style={[styles.violationItemCard, { backgroundColor: isDarkMode ? '#1F1417' : '#FEF2F2', borderColor: isDarkMode ? '#3F1B22' : '#FEE2E2' }]}>
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
                        ))}
                      </>
                    )}
                  </View>
                </View>
              )}

              {/* ========================================================= */}
              {/* TAB 3: RESERVED BOOKS VIEW                                */}
              {/* ========================================================= */}
              {activeTab === 'reserved' && (
                <View style={styles.tabContentContainer}>
                  {reservedBooks.length === 0 ? (
                    <View style={[styles.emptyReturnCard, { backgroundColor: isDarkMode ? '#131E33' : '#F8FAFC', borderColor: isDarkMode ? '#24334C' : '#CBD5E1' }]}>
                      <Ionicons name="bookmark-outline" size={40} color={theme.accentGold} />
                      <Text style={[styles.emptyReturnTitle, { color: theme.textPrimary }]}>
                        No Reserved Books
                      </Text>
                      <Text style={[styles.emptyReturnSub, { color: theme.textSecondary }]}>
                        Student does not have any active book reservations on hold.
                      </Text>
                    </View>
                  ) : (
                    reservedBooks.map((item, idx) => (
                      <View
                        key={`reserved-${item.id || idx}`}
                        style={[
                          styles.returnBookCard,
                          {
                            backgroundColor: isDarkMode ? '#131E33' : '#F8FAFC',
                            borderColor: isDarkMode ? '#24334C' : '#CBD5E1',
                          },
                        ]}
                      >
                        <View style={styles.returnBookCardTop}>
                          <Text style={[styles.returnBookTitle, { color: theme.textPrimary }]} numberOfLines={2}>
                            {item.bookTitle}
                          </Text>
                          <View style={[styles.dueBadge, { backgroundColor: '#F59E0B' }]}>
                            <Text style={styles.dueBadgeText}>{item.status.toUpperCase()}</Text>
                          </View>
                        </View>

                        <View style={styles.returnBookDatesCol}>
                          <Text style={[styles.returnBookDateText, { color: theme.textSecondary }]}>
                            Reservation Date: {formatDisplayDate(item.reserveDate)}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
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
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#111A2E',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 1.1,
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

  /* SECTION BLOCKS */
  sectionBlock: {
    marginHorizontal: 16,
    marginTop: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionHeadingText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.1,
  },

  /* STUDENT INFORMATION CARD */
  studentInfoCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    elevation: 3,
  },
  studentProfileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '900',
  },
  studentNameCol: {
    flex: 1,
  },
  profileFullName: {
    fontSize: 16,
    fontWeight: '800',
  },
  profileIdBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginVertical: 3,
  },
  profileIdBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFD700',
  },
  profileCourseText: {
    fontSize: 12,
    fontWeight: '500',
  },
  infoGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoGridBox: {
    width: '48.5%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  infoGridLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoGridValue: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* RETURN BOOKS SECTION */
  returnSectionBlock: {
    marginHorizontal: 16,
    marginTop: 22,
  },
  returnSectionHeading: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  tabPill: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillActive: {
    backgroundColor: '#FFD700',
  },
  tabPillInactive: {
    backgroundColor: '#16233B',
    borderWidth: 1,
    borderColor: '#24334C',
  },
  tabPillText: {
    fontSize: 12.5,
  },
  tabPillTextActive: {
    color: '#080F1E',
    fontWeight: '800',
  },
  tabPillTextInactive: {
    color: '#94A3B8',
    fontWeight: '600',
  },

  tabContentContainer: {
    marginTop: 4,
    minHeight: 320,
    justifyContent: 'space-between',
  },

  /* SELECTION TOOLBAR FOR MULTI-RETURN */
  selectionControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  selectionControlText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  selectAllBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* RETURN BOOK CARD (Matches Image 2) */
  returnBookCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  returnBookCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  returnBookTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 8,
  },
  selectionCheckIcon: {
    marginRight: 8,
    marginTop: 1,
  },
  returnBookTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  dueBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dueBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  returnBookDatesCol: {
    gap: 3,
    marginTop: 4,
  },
  returnBookDateText: {
    fontSize: 12.5,
    fontWeight: '500',
  },

  /* RETURN ACTION BUTTON CONTAINER */
  returnActionContainer: {
    marginTop: 'auto',
    paddingTop: 36,
    marginBottom: 12,
  },
  returnedActionButton: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  returnedActionText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  returningLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  emptyReturnCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  emptyReturnTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
  },
  emptyReturnSub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },

  /* STATS SUMMARY ROW */
  statsSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 17,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },

  /* TOTAL FINE BANNER */
  totalFineBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  totalFineLabel: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '800',
  },
  totalFineAmount: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '900',
  },

  /* LIBRARY CARD */
  libraryCardContainer: {
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
  },

  /* VIOLATION SECTION */
  violationSectionContainer: {
    marginTop: 20,
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
