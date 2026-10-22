import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedScreen from '../components/AnimatedScreen';
import { useThemeColors } from '../hooks/useThemeColors';
import { useAuth } from '../data/AuthContext';

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  getStudentProfile,
  getSystemSettings,
  getActiveBorrowCount,
  getOverdueBooks,
  subscribe,
  syncSystemSettingsWithBackend,
  syncTransactionsWithBackend,
} from '../data/store';


export default function BorrowScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();
  const { user } = useAuth();

  const {
    title = '',
    author = '',
    isbn = '',
    department: departmentParam = '',
    action: actionParam = 'Borrow',
  } = useLocalSearchParams();

  const action =
    (actionParam as string) === 'Reserve'
      ? 'Reserve'
      : 'Borrow';

  const isBorrow = action === 'Borrow';

  const profile = getStudentProfile();

  const resolvedName = user?.fullName || profile?.name || 'Student';
  const resolvedStudentId =
    user?.studentId ||
    user?.qrCode ||
    profile?.studentId ||
    profile?.qrCode ||
    user?.id ||
    '';
  const resolvedDept = user?.course || user?.department || profile?.course || profile?.department || (departmentParam ? String(departmentParam) : 'General Program');

  const [name, setName] = useState(resolvedName);
  const [studentId, setStudentId] = useState(resolvedStudentId);
  const [department, setDepartment] = useState(resolvedDept);

  // System settings (borrow limit and loan duration) and student active borrow tracking
  const [systemSettings, setSystemSettings] = useState(() => getSystemSettings());
  const [activeBorrowCount, setActiveBorrowCount] = useState(() =>
    getActiveBorrowCount(studentId || resolvedStudentId)
  );
  const [overdueBooks, setOverdueBooks] = useState(() =>
    getOverdueBooks(studentId || resolvedStudentId)
  );

  useEffect(() => {
    void syncSystemSettingsWithBackend(true);
    void syncTransactionsWithBackend(true);

    const updateState = () => {
      setSystemSettings(getSystemSettings());
      setActiveBorrowCount(getActiveBorrowCount(studentId || resolvedStudentId));
      setOverdueBooks(getOverdueBooks(studentId || resolvedStudentId));
    };

    updateState();
    const unsub = subscribe(updateState);
    return unsub;
  }, [studentId, resolvedStudentId]);

  const borrowLimit = systemSettings.borrowLimit ?? 5;
  const borrowDurationDays = systemSettings.borrowDurationDays ?? 7;
  // Limit reached applies when the student's active borrowed books count meets or exceeds the Super Admin limit
  const isLimitReached = isBorrow && activeBorrowCount >= borrowLimit;
  const hasOverdueLoans = isBorrow && overdueBooks.length > 0;

  useEffect(() => {
    if (user?.fullName && name !== user.fullName) {
      setName(user.fullName);
    }
    if (user?.studentId && studentId !== user.studentId) {
      setStudentId(user.studentId);
    }
    if ((user?.course || user?.department) && department !== (user.course || user.department)) {
      setDepartment(user.course || user.department || 'General Program');
    }
  }, [user]);

  const getDefaultReservationDate = () => {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  };

  const [reservationDate, setReservationDate] =
    useState(() =>
      getDefaultReservationDate()
    );

  const [studentIDImage, setStudentIDImage] =
    useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 📅 AUTO RETURN DATE (Uses Super Admin loan duration)
  const computeReturnDate = (
    dateStr: string
  ) => {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return '';

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);

    const date = new Date(year, month, day);
    date.setDate(date.getDate() + (borrowDurationDays || 7));

    // If pick saturday or sunday the system will move it to monday since the school is closed
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek === 0) {
      date.setDate(date.getDate() + 1); // Sunday -> Monday
    } else if (dayOfWeek === 6) {
      date.setDate(date.getDate() + 2); // Saturday -> Monday
    }

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}`;
  };

  const formatLoanPeriod = (days: number) => {
    if (days === 7) return '1 week (7 days)';
    if (days > 0 && days % 7 === 0) {
      const weeks = days / 7;
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} (${days} days)`;
    }
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  };

  const handleBack = () => {
    if (router.canGoBack?.()) {
      router.back();
    } else {
      router.push('/reservations');
    }
  };

  // 📷 IMAGE PICKER
  const pickImage = async () => {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permission Required',
        'Please allow gallery access.'
      );

      return;
    }

    const result =
      await ImagePicker.launchImageLibraryAsync(
        {
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.4,
          base64: true,
        }
      );

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const base64Uri = `data:image/jpeg;base64,${asset.base64}`;
      setStudentIDImage(base64Uri);
    }
  };

  // 🚨 SUBMIT
  const handleSubmit = () => {
    if (isSubmitting) return;

    if (isBorrow && isLimitReached) {
      Alert.alert(
        'Borrow Limit Reached',
        `You have already borrowed ${activeBorrowCount} books, reaching the maximum allowed limit of ${borrowLimit} books. Please return a book to the library before borrowing another.`
      );
      return;
    }

    if (isBorrow && hasOverdueLoans) {
      const titles = overdueBooks.map(b => `'${b.title}'`).slice(0, 2).join(', ');
      Alert.alert(
        'Overdue Return Required',
        `You have ${overdueBooks.length} book(s) due or overdue for return (${titles}). Please return overdue books before borrowing another book.`
      );
      return;
    }

    if (
      !name ||
      !studentId ||
      !department ||
      !studentIDImage
    ) {
      Alert.alert(
        'Error',
        'Please complete all fields and upload your Student ID.'
      );

      return;
    }

    const returnDate =
      computeReturnDate(
        reservationDate
      );

    if (!returnDate) {
      Alert.alert(
        'Error',
        'Please enter a valid borrow date.'
      );

      return;
    }

    setIsSubmitting(true);
    router.push({
      pathname:
        '/request-confirmation',

      params: {
        title: String(title),
        author: String(author),
        isbn: String(isbn),
        department,
        studentName: name,
        studentId,
        reservationDate,
        returnDate,
        action,
        studentIDImage,
      },
    });
    setTimeout(() => setIsSubmitting(false), 1000);
  };


  return (
    <AnimatedScreen style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top }}>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 24) + 60,
        }}
        showsVerticalScrollIndicator={false}
      >
      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder, borderBottomWidth: 1 }]}>
        <TouchableOpacity
          onPress={handleBack}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={isDarkMode ? theme.accentGold : theme.accentBlue}
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.headerTitle }]}>
          {isBorrow
            ? 'BORROW REQUEST'
            : 'RESERVATION'}
        </Text>

        <View style={{ width: 22 }} />
      </View>

      <Text style={[styles.title, { color: theme.sectionTitle, marginBottom: isBorrow ? 20 : 8 }]}>
        {isBorrow
          ? 'Borrow Request'
          : 'Reservation Request'}
      </Text>

      {!isBorrow && (
        <View style={{
          backgroundColor: isDarkMode ? "rgba(245, 158, 11, 0.12)" : "#FEF3C7",
          borderColor: isDarkMode ? "rgba(245, 158, 11, 0.3)" : "#FDE68A",
          borderWidth: 1,
          borderRadius: 12,
          padding: 12,
          marginBottom: 18,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}>
          <Ionicons name="information-circle" size={22} color={isDarkMode ? theme.accentGold : "#D97706"} />
          <Text style={{ flex: 1, fontSize: 12.5, color: isDarkMode ? theme.accentGold : "#92400E", lineHeight: 18, fontWeight: "600" }}>
            All copies are currently unavailable. Reserve your spot in the 1st-come, 1st-served queue. When an active loan is returned, you will be notified to claim your copy.
          </Text>
        </View>
      )}

      {isBorrow && isLimitReached && (
        <View style={{
          backgroundColor: isDarkMode ? "rgba(239, 68, 68, 0.12)" : "#FEE2E2",
          borderColor: isDarkMode ? "rgba(239, 68, 68, 0.35)" : "#FCA5A5",
          borderWidth: 1,
          borderRadius: 12,
          padding: 12,
          marginBottom: 18,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}>
          <Ionicons name="alert-circle" size={22} color={isDarkMode ? "#F87171" : "#DC2626"} />
          <Text style={{ flex: 1, fontSize: 12.5, color: isDarkMode ? "#F87171" : "#991B1B", lineHeight: 18, fontWeight: "600" }}>
            Borrow limit reached ({activeBorrowCount}/{borrowLimit} books). You cannot submit further borrow requests until you return your existing books to the library.
          </Text>
        </View>
      )}

      {isBorrow && !isLimitReached && hasOverdueLoans && (
        <View style={{
          backgroundColor: isDarkMode ? "rgba(245, 158, 11, 0.12)" : "#FEF3C7",
          borderColor: isDarkMode ? "rgba(245, 158, 11, 0.35)" : "#FDE68A",
          borderWidth: 1,
          borderRadius: 12,
          padding: 12,
          marginBottom: 18,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}>
          <Ionicons name="warning" size={22} color={isDarkMode ? "#FBBF24" : "#D97706"} />
          <Text style={{ flex: 1, fontSize: 12.5, color: isDarkMode ? "#FBBF24" : "#92400E", lineHeight: 18, fontWeight: "600" }}>
            Overdue return required ({overdueBooks.length} book{overdueBooks.length > 1 ? "s" : ""}). You must return your overdue book(s) to the library before borrowing another title.
          </Text>
        </View>
      )}

      {/* BOOK INFO */}
      <View style={[
        styles.bookInfo, 
        { 
          backgroundColor: theme.cardBg, 
          borderColor: theme.cardBorder,
          borderTopWidth: !isDarkMode ? 3 : 1,
          borderTopColor: !isDarkMode ? theme.accentGold : theme.cardBorder,
        }
      ]}>
        <Text style={[styles.bookTitle, { color: theme.textPrimary }]}>
          {title}
        </Text>

        <Text style={[styles.bookAuthor, { color: theme.textSecondary }]}>
          by {author}
        </Text>

        <Text style={[styles.bookMeta, { color: theme.textSecondary }]}>
          ISBN:{' '}
          {isbn || 'Not Available'}
        </Text>
      </View>

      {/* STUDENT INFO */}
      <Text style={[styles.sectionTitle, { color: isDarkMode ? theme.accentGold : theme.accentBlue }]}>
        Student Information
      </Text>

      {/* NAME */}
      <Text style={[styles.label, { color: theme.textPrimary }]}>
        Full Name
      </Text>

      <TextInput
        style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, color: theme.textPrimary }]}
        value={name}
        onChangeText={setName}
        placeholder="Enter your full name"
        placeholderTextColor={isDarkMode ? "#64748B" : "#94A3B8"}
      />

      {/* STUDENT ID */}
      <Text style={[styles.label, { color: theme.textPrimary }]}>
        Student ID
      </Text>

      <TextInput
        style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, color: theme.textPrimary }]}
        value={studentId}
        onChangeText={setStudentId}
        placeholder="Enter your student ID"
        placeholderTextColor={isDarkMode ? "#64748B" : "#94A3B8"}
      />

      {/* UPLOAD ID */}
      <Text style={[styles.label, { color: theme.textPrimary }]}>
        Upload Student ID
      </Text>

      <TouchableOpacity
        style={[styles.uploadButton, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
        onPress={pickImage}
      >
        <View style={!isDarkMode ? { backgroundColor: theme.badgeYellowBg, borderRadius: 8, padding: 6, marginRight: 8, borderWidth: 1, borderColor: theme.badgeYellowBorder } : { marginRight: 8 }}>
          <Ionicons
            name="cloud-upload-outline"
            size={20}
            color={isDarkMode ? theme.accentGold : "#0274BB"}
          />
        </View>

        <Text style={[styles.uploadText, { color: isDarkMode ? theme.accentGold : theme.accentBlue }]}>
          Upload ID Picture
        </Text>
      </TouchableOpacity>

      {studentIDImage && (
        <Image
          source={{
            uri: studentIDImage,
          }}
          style={styles.idPreview}
        />
      )}

      {/* DEPARTMENT / COURSE */}
      <View
        style={styles.departmentSection}
      >
        <Text style={[styles.label, { color: theme.textPrimary }]}>
          Course & Department
        </Text>

        <TextInput
          style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, color: theme.textPrimary }]}
          value={department}
          onChangeText={setDepartment}
          placeholder="e.g. BS in Information Technology"
          placeholderTextColor={isDarkMode ? "#64748B" : "#94A3B8"}
        />
      </View>

      {/* DATE */}
      <Text style={[styles.label, { color: theme.textPrimary }]}>
        {isBorrow ? 'Borrow Date' : 'Reservation Request Date'}
      </Text>

      <TextInput
        style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, color: theme.textPrimary }]}
        value={reservationDate}
        onChangeText={
          setReservationDate
        }
        placeholder="YYYY-MM-DD HH:MM"
        placeholderTextColor={isDarkMode ? "#64748B" : "#94A3B8"}
      />

      {/* DEADLINE */}
      <Text style={[styles.label, { color: theme.textPrimary }]}>
        {isBorrow ? 'Due Date Return' : `Estimated Loan Duration (${borrowDurationDays} Days once claimed)`}
      </Text>

      <View style={[styles.deadlineDisplay, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
        <Ionicons
          name="calendar-outline"
          size={18}
          color={isDarkMode ? theme.accentGold : theme.accentBlue}
        />
        <Text style={[styles.deadlineDisplayText, { color: theme.textPrimary }]}>
          {isBorrow
            ? (computeReturnDate(reservationDate) || 'Enter a valid borrow date')
            : `${borrowDurationDays} days from when copy is claimed`}
        </Text>
      </View>

      {/* POLICY */}
      <View style={[styles.policyCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1 }]}>
        <Text style={[styles.policyTitle, { color: isDarkMode ? theme.accentGold : theme.accentBlue }]}>
          {isBorrow ? '📚 Borrowing Policy' : '📌 Reservation (Waitlist) Policy'}
        </Text>

        {isBorrow ? (
          <>
            <Text style={[styles.policyText, { color: theme.textSecondary }]}>
              • Maximum borrowing period: {formatLoanPeriod(borrowDurationDays)}
            </Text>
            <Text style={[styles.policyText, { color: theme.textSecondary }]}>
              • Maximum {borrowLimit} books per student
            </Text>
            <Text style={[styles.policyText, { color: theme.textSecondary }]}>
              • Late returns: ₱50.00/day fine
            </Text>
            <Text style={[styles.policyText, { color: theme.textSecondary }]}>
              • Request will be processed by the library system
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.policyText, { color: theme.textSecondary }]}>
              • 1st-come, 1st-served queue: reservations are prioritized in order of request.
            </Text>
            <Text style={[styles.policyText, { color: theme.textSecondary }]}>
              • When a currently borrowed copy is returned, the next student in the queue is promoted.
            </Text>
            <Text style={[styles.policyText, { color: theme.textSecondary }]}>
              • 24-hour claim window: once notified that a copy is ready, you have 24 hours to borrow it.
            </Text>
            <Text style={[styles.policyText, { color: theme.textSecondary }]}>
              • No penalty for cancelling a reservation at any time.
            </Text>
          </>
        )}
      </View>

      {/* BORROW LIMIT REACHED BANNER */}
      {isBorrow && isLimitReached && (
        <View style={{
          backgroundColor: isDarkMode ? "rgba(239, 68, 68, 0.14)" : "#FEF2F2",
          borderColor: isDarkMode ? "rgba(239, 68, 68, 0.45)" : "#FCA5A5",
          borderWidth: 1.2,
          borderRadius: 14,
          padding: 14,
          marginTop: 18,
          marginBottom: 4,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}>
          <Ionicons name="alert-circle" size={24} color={isDarkMode ? "#F87171" : "#DC2626"} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13.5, fontWeight: "800", color: isDarkMode ? "#F87171" : "#991B1B", marginBottom: 2 }}>
              Borrow Limit Reached ({activeBorrowCount}/{borrowLimit})
            </Text>
            <Text style={{ fontSize: 12, color: isDarkMode ? "#FCA5A5" : "#B91C1C", lineHeight: 17 }}>
              You currently have {activeBorrowCount} books borrowed, matching the set limit of {borrowLimit} books per student. Please return a book to borrow again.
            </Text>
          </View>
        </View>
      )}

      {/* OVERDUE RETURN REQUIRED BANNER */}
      {isBorrow && !isLimitReached && hasOverdueLoans && (
        <View style={{
          backgroundColor: isDarkMode ? "rgba(245, 158, 11, 0.14)" : "#FEF3C7",
          borderColor: isDarkMode ? "rgba(245, 158, 11, 0.45)" : "#FDE68A",
          borderWidth: 1.2,
          borderRadius: 14,
          padding: 14,
          marginTop: 18,
          marginBottom: 4,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}>
          <Ionicons name="warning" size={24} color={isDarkMode ? "#FBBF24" : "#D97706"} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13.5, fontWeight: "800", color: isDarkMode ? "#FBBF24" : "#B45309", marginBottom: 2 }}>
              Overdue Return Required ({overdueBooks.length})
            </Text>
            <Text style={{ fontSize: 12, color: isDarkMode ? "#FDE68A" : "#92400E", lineHeight: 17 }}>
              You have {overdueBooks.length} book(s) due or overdue for return. Please return your overdue books before submitting new borrow requests.
            </Text>
          </View>
        </View>
      )}

      {/* SUBMIT BUTTON */}
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: isLimitReached
              ? (isDarkMode ? "rgba(239, 68, 68, 0.18)" : "#FEE2E2")
              : (hasOverdueLoans
                  ? (isDarkMode ? "rgba(245, 158, 11, 0.18)" : "#FEF3C7")
                  : theme.buttonPrimaryBg),
            borderColor: isLimitReached
              ? (isDarkMode ? "#EF4444" : "#F87171")
              : (hasOverdueLoans
                  ? (isDarkMode ? "#F59E0B" : "#FBBF24")
                  : (isDarkMode ? theme.buttonPrimaryBorder : "rgba(2, 116, 187, 0.25)")),
            borderWidth: 1.5,
            minHeight: 56,
            borderRadius: 14,
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            elevation: (isLimitReached || hasOverdueLoans) ? 2 : 6,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: (isLimitReached || hasOverdueLoans) ? 0.15 : 0.25,
            shadowRadius: 6,
            marginTop: (isLimitReached || hasOverdueLoans) ? 14 : 22,
            marginBottom: 10,
          },
          isSubmitting && { opacity: 0.6 }
        ]}
        disabled={isSubmitting}
        onPress={handleSubmit}
        activeOpacity={0.85}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color={isLimitReached ? (isDarkMode ? "#F87171" : "#DC2626") : (hasOverdueLoans ? (isDarkMode ? "#FBBF24" : "#D97706") : theme.buttonPrimaryText)} />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
            <Ionicons
              name={
                isBorrow
                  ? (isLimitReached ? "alert-circle" : (hasOverdueLoans ? "warning" : "paper-plane"))
                  : "bookmark"
              }
              size={19}
              color={
                isLimitReached
                  ? (isDarkMode ? "#F87171" : "#DC2626")
                  : (hasOverdueLoans
                      ? (isDarkMode ? "#FBBF24" : "#D97706")
                      : theme.buttonPrimaryText)
              }
              style={{ marginRight: 8 }}
            />
            <Text
              style={{
                color: isLimitReached
                  ? (isDarkMode ? "#F87171" : "#DC2626")
                  : (hasOverdueLoans
                      ? (isDarkMode ? "#FBBF24" : "#D97706")
                      : theme.buttonPrimaryText),
                fontWeight: '900',
                fontSize: 16,
                letterSpacing: 0.4,
              }}
            >
              {isBorrow
                ? (isLimitReached
                    ? `Borrow Limit Reached (${activeBorrowCount}/${borrowLimit})`
                    : (hasOverdueLoans
                        ? `Overdue Return Required (${overdueBooks.length})`
                        : 'Submit Borrow Request'))
                : 'Reserve Book (Join Queue)'}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={{ height: Math.max(insets.bottom, 24) + 60 }} />
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F4F6F8',
  },

  header: {
    backgroundColor: '#0B1F3A',
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },

  headerTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.4,
  },

  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 20,
  },

  bookInfo: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  bookTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 4,
  },

  bookAuthor: {
    color: '#64748B',
    fontSize: 14,
    marginBottom: 8,
  },

  bookMeta: {
    color: '#94A3B8',
    fontSize: 12,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 16,
  },

  label: {
    marginTop: 16,
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },

  input: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 14,
  },

  uploadButton: {
    height: 55,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 12,
    marginTop: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },

  uploadText: {
    marginLeft: 8,
    color: '#0B5A8E',
    fontWeight: '600',
  },

  idPreview: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    marginTop: 14,
    resizeMode: 'cover',
  },

  departmentSection: {
    marginTop: 16,
    marginBottom: 8,
  },

  departmentDisplay: {
    backgroundColor: '#DBEAFE',
    padding: 14,
    borderRadius: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#1D4ED8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  departmentDisplayText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0B5A8E',
  },

  departmentBadge: {
    backgroundColor: '#1D4ED8',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  policyCard: {
    backgroundColor: '#EEF4F8',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 24,
  },

  policyTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0B5A8E',
    marginBottom: 8,
  },

  policyText: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },

  button: {
    backgroundColor: '#0B5A8E',
    marginTop: 25,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },

  deadlineDisplay: {
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderRadius: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#0B5A8E',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  deadlineDisplayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0B5A8E',
  },
});