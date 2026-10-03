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
import { getStudentProfile } from '../data/store';


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
  const resolvedStudentId = user?.studentId || profile?.studentId || '';
  const resolvedDept = user?.course || user?.department || profile?.course || profile?.department || (departmentParam ? String(departmentParam) : 'General Program');

  const [name, setName] = useState(resolvedName);
  const [studentId, setStudentId] = useState(resolvedStudentId);
  const [department, setDepartment] = useState(resolvedDept);

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

  // 📅 AUTO RETURN DATE
  const computeReturnDate = (
    dateStr: string
  ) => {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return '';

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);

    const date = new Date(year, month, day);
    date.setDate(date.getDate() + 7);

    // If pick saturday or sunday the system will moved it to monday since the school is closed
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
        'Please enter a valid reservation date.'
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

      <Text style={[styles.title, { color: theme.sectionTitle }]}>
        {isBorrow
          ? 'Borrow Request'
          : 'Reservation Request'}
      </Text>

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
        Reservation Date
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
        Return Deadline (7 days)
      </Text>

      <View style={[styles.deadlineDisplay, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
        <Ionicons
          name="calendar-outline"
          size={18}
          color={isDarkMode ? theme.accentGold : theme.accentBlue}
        />
        <Text style={[styles.deadlineDisplayText, { color: theme.textPrimary }]}>
          {computeReturnDate(reservationDate) || 'Enter a valid reservation date'}
        </Text>
      </View>

      {/* POLICY */}
      <View style={[styles.policyCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1 }]}>
        <Text style={[styles.policyTitle, { color: isDarkMode ? theme.accentGold : theme.accentBlue }]}>
          📚 Borrowing Policy
        </Text>

        <Text style={[styles.policyText, { color: theme.textSecondary }]}>
          • Maximum borrowing period:
          1 week (7 days)
        </Text>

        <Text style={[styles.policyText, { color: theme.textSecondary }]}>
          • Maximum 5 books per
          student
        </Text>

        <Text style={[styles.policyText, { color: theme.textSecondary }]}>
          • Late returns:
          ₱50.00/day fine
        </Text>

        <Text style={[styles.policyText, { color: theme.textSecondary }]}>
          • Request will be
          processed by the library
          system
        </Text>
      </View>

      {/* SUBMIT BUTTON */}
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: theme.buttonPrimaryBg,
            borderColor: isDarkMode ? theme.buttonPrimaryBorder : "rgba(2, 116, 187, 0.25)",
            borderWidth: 1.5,
            minHeight: 56,
            borderRadius: 14,
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            elevation: 6,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 6,
            marginTop: 22,
            marginBottom: 10,
          },
          isSubmitting && { opacity: 0.6 }
        ]}
        disabled={isSubmitting}
        onPress={handleSubmit}
        activeOpacity={0.85}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
            <Ionicons
              name={isBorrow ? "paper-plane" : "bookmark"}
              size={19}
              color={theme.buttonPrimaryText}
              style={{ marginRight: 8 }}
            />
            <Text
              style={{
                color: theme.buttonPrimaryText,
                fontWeight: '900',
                fontSize: 16,
                letterSpacing: 0.4,
              }}
            >
              {isBorrow
                ? 'Submit Borrow Request'
                : 'Submit Reservation'}
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