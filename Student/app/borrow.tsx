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
import { apiClient, getBackendUrl } from '../services/api';
import {
  getStudentProfile,
  getSystemSettings,
  getActiveBorrowCount,
  getOverdueBooks,
  subscribe,
  syncSystemSettingsWithBackend,
  syncTransactionsWithBackend,
  loadStudentIdCardsForUser,
} from '../data/store';

/**
 * Client-side credential matching against OCR-scanned Library ID contents
 */
/**
 * Calculate Levenshtein edit distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  if (!a) return b ? b.length : 0;
  if (!b) return a ? a.length : 0;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function isFuzzyWordMatch(targetWord: string, textWords: string[], maxDist = 1): boolean {
  if (!targetWord || targetWord.length < 3) return false;
  return textWords.some((w) => {
    if (w === targetWord) return true;
    if (Math.abs(w.length - targetWord.length) <= maxDist) {
      return levenshteinDistance(targetWord, w) <= maxDist;
    }
    return false;
  });
}

function evaluateClientMatch(ocrText: string, enteredName: string, enteredId: string) {
  if (!ocrText || !ocrText.trim()) {
    return { success: false, nameMatched: false, idNumberMatched: false, message: "No Library Card text scanned yet." };
  }
  const normOcr = ocrText.toUpperCase().replace(/[^A-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const ocrWords = normOcr.split(" ").filter(Boolean);
  const normOcrNoSpace = ocrText.replace(/[^A-Z0-9]/g, "").toUpperCase();

  // Helper: disambiguate digit-like characters in specific candidate strings
  const disambiguateCandidate = (str: string) =>
    (str || "")
      .replace(/[OoQqDd]/g, "0")
      .replace(/[Il|/!tj\]\[]/g, "1")
      .replace(/[Zz]/g, "2")
      .replace(/[E]/g, "3")
      .replace(/[A]/g, "4")
      .replace(/[Ss$]/g, "5")
      .replace(/[Gb]/g, "6")
      .replace(/[T]/g, "7")
      .replace(/[B&]/g, "8")
      .replace(/[gq]/g, "9")
      .replace(/[^0-9]/g, "");

  // 1. Name Match
  const normName = (enteredName || "").toUpperCase().replace(/[^A-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const nameParts = normName.split(" ").filter((p) => p.length >= 2);
  let nameMatched = false;
  if (!normName) {
    nameMatched = false;
  } else if (normOcr.includes(normName)) {
    nameMatched = true;
  } else if (nameParts.length > 0) {
    const reversed = [...nameParts].reverse().join(" ");
    if (normOcr.includes(reversed)) {
      nameMatched = true;
    } else {
      const matchedParts = nameParts.filter((part) =>
        normOcr.includes(part) || isFuzzyWordMatch(part, ocrWords, part.length > 5 ? 2 : 1)
      );
      const required = Math.max(1, Math.min(nameParts.length, Math.ceil(nameParts.length * 0.6)));
      if (matchedParts.length >= required && matchedParts.some((p) => p.length >= 3)) {
        nameMatched = true;
      }
    }
  }

  // 2. ID Number Match (Intelligent multi-tier verification with disambiguation & name cross-assurance)
  const cleanId = (enteredId || "").trim().toUpperCase();
  const idDigits = cleanId.replace(/[^0-9]/g, "");
  const idSegments = cleanId.split(/[^A-Z0-9]+/).map((s) => s.trim()).filter((s) => s.length >= 2);

  let idNumberMatched = false;

  if (!cleanId) {
    idNumberMatched = false;
  } else if (
    normOcr.includes(cleanId) ||
    normOcr.includes(cleanId.replace(/[-_.]/g, " ")) ||
    normOcr.includes(cleanId.replace(/[-_.]/g, "")) ||
    normOcrNoSpace.includes(idDigits)
  ) {
    idNumberMatched = true;
  }

  // Tier 1: Targeted "ID No." line extraction
  if (!idNumberMatched) {
    const idLineRegex = /(?:id\s*(?:no\.?|number|#)?[\s:;*=\-–—!?,.]{0,3})\s*([^\n\r,;]+)/i;
    const idLineMatch = ocrText.match(idLineRegex);
    if (idLineMatch && idLineMatch[1]) {
      const candidateDigits = disambiguateCandidate(idLineMatch[1]);
      if (
        candidateDigits.includes(idDigits) ||
        (candidateDigits.length >= idDigits.length - 1 &&
          levenshteinDistance(candidateDigits.slice(0, idDigits.length), idDigits) <= 2)
      ) {
        idNumberMatched = true;
      }
    }
  }

  // Tier 2: Extract STI ID format pattern (e.g. 23-1653-705 or 23 1653 705)
  if (!idNumberMatched) {
    const stiPattern = /\b([0-9A-Za-z]{2}[\s\-_.]+[0-9A-Za-z]{3,5}[\s\-_.]+[0-9A-Za-z]{2,4})\b/i;
    const stiMatch = ocrText.match(stiPattern);
    if (stiMatch && stiMatch[1]) {
      const stiDigits = disambiguateCandidate(stiMatch[1]);
      if (
        stiDigits === idDigits ||
        levenshteinDistance(stiDigits, idDigits) <= 2
      ) {
        idNumberMatched = true;
      }
    }
  }

  // Tier 3: Segment matching (Prefix: 23, Core: 1653, Campus: 705)
  if (!idNumberMatched && idSegments.length > 0) {
    const coreSegment = idSegments.find((s) => s.length >= 4) || idSegments[1];
    const prefixSegment = idSegments[0];
    const campusSegment = idSegments[idSegments.length - 1];

    let segmentsFound = 0;
    if (prefixSegment && normOcrNoSpace.includes(prefixSegment)) segmentsFound++;
    if (coreSegment && (normOcrNoSpace.includes(coreSegment) || normOcrNoSpace.includes(disambiguateCandidate(coreSegment)))) segmentsFound++;
    if (campusSegment && (normOcrNoSpace.includes(campusSegment) || normOcrNoSpace.includes(disambiguateCandidate(campusSegment)))) segmentsFound++;

    if (segmentsFound >= 2 || (coreSegment && normOcrNoSpace.includes(coreSegment))) {
      idNumberMatched = true;
    }
  }

  // Tier 4: Glare / Stroke Ambiguity Tolerance with Levenshtein on alphanumeric tokens
  if (!idNumberMatched && idDigits.length >= 5) {
    const tokens = ocrText.split(/[\s,;:\n\r]+/).filter((t) => t.length >= 5);
    for (const tok of tokens) {
      const tokDigits = disambiguateCandidate(tok);
      if (tokDigits.length >= idDigits.length - 2) {
        const dist = levenshteinDistance(idDigits, tokDigits.slice(0, idDigits.length));
        if (dist <= 2) {
          idNumberMatched = true;
          break;
        }
      }
    }
  }

  // Tier 5: Name-Verified Cross-Assurance (Crucial Safety Net)
  // If the student's full name is matched and verified on the card:
  if (!idNumberMatched && nameMatched) {
    const isLibraryCard = /LIBRARY\s*CARD|STI/i.test(ocrText);
    const hasCoreDigits = idDigits.length >= 4 && (
      normOcrNoSpace.includes(idDigits.slice(0, 4)) ||
      normOcrNoSpace.includes(idDigits.slice(2, 6)) ||
      normOcrNoSpace.includes(idDigits.slice(-4)) ||
      normOcrNoSpace.includes(idDigits.slice(-3))
    );
    if (isLibraryCard || hasCoreDigits) {
      idNumberMatched = true;
    }
  }

  // Cross-assurance: If ID matched, and at least 1 significant name part matches
  if (!nameMatched && idNumberMatched && nameParts.length > 0) {
    const hasAnyName = nameParts.some(
      (part) => part.length >= 3 && (normOcr.includes(part) || ocrWords.some((w) => levenshteinDistance(part, w) <= 1))
    );
    if (hasAnyName) {
      nameMatched = true;
    }
  }

  const success = nameMatched && idNumberMatched;
  let message = "Student identity verified successfully based on Library Card.";
  if (!success) {
    if (!nameMatched && !idNumberMatched) {
      message = `Both your Name ("${enteredName || "Not entered"}") and Student ID ("${enteredId || "Not entered"}") failed to match the uploaded Library Card.`;
    } else if (!nameMatched) {
      message = `The entered Name ("${enteredName}") does not match the name on your uploaded Library Card.`;
    } else {
      message = `The entered Student ID ("${enteredId}") does not match the ID number on your uploaded Library Card.`;
    }
  }

  return { success, nameMatched, idNumberMatched, message };
}


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

  // OCR ID verification state (Localhost only)
  const [ocrVerifying, setOcrVerifying] = useState(false);
  const [ocrVerified, setOcrVerified] = useState(false);
  const [ocrSuccess, setOcrSuccess] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [ocrScannedText, setOcrScannedText] = useState("");
  const [detectedIdNumber, setDetectedIdNumber] = useState<string | null>(null);
  const [detectedName, setDetectedName] = useState<string | null>(null);
  const [hasSavedLibraryId, setHasSavedLibraryId] = useState(false);

  const isLocalhost =
    __DEV__ ||
    getBackendUrl().includes('localhost') ||
    getBackendUrl().includes('127.0.0.1') ||
    getBackendUrl().includes('192.168.') ||
    getBackendUrl().includes('10.') ||
    getBackendUrl().includes('172.');

  // Strict verification mode: ID card must directly match credentials via OCR
  const isAccountOwnerCard = false;

  // Manual ID upload required: Auto-load removed so student manually uploads School ID

  // Trigger auto-scan once credentials and ID image are ready
  useEffect(() => {
    if (studentIDImage && name && studentId && !ocrVerified && !ocrVerifying) {
      void triggerAutoOcrScan(studentIDImage, name, studentId);
    }
  }, [name, studentId, studentIDImage]);

  /**
   * Automatic background OCR scan & matching on localhost
   */
  const triggerAutoOcrScan = async (
    imageOverride?: string | null,
    currentNameOverride?: string,
    currentIdOverride?: string
  ) => {
    const img = imageOverride !== undefined ? imageOverride : studentIDImage;
    if (!img) return;

    const checkName = (currentNameOverride ?? name).trim();
    const checkId = (currentIdOverride ?? studentId).trim();

    setOcrVerifying(true);
    setOcrError("");

    try {
      const response = await apiClient.post(
        "/api/student/ocr/verify-id",
        {
          schoolIdFront: img,
          libraryIdFront: img,
          expectedName: checkName,
          expectedIdNumber: checkId,
        },
        { timeout: 35000 }
      );

      const data = response.data;
      const combined =
        data?.extracted?.combined ||
        data?.extracted?.schoolId?.rawText ||
        data?.extracted?.libraryId?.rawText ||
        "";
      if (combined) {
        setOcrScannedText(combined);
      }
      if (data?.detectedIdNumber) {
        setDetectedIdNumber(data.detectedIdNumber);
      }
      if (data?.detectedName) {
        setDetectedName(data.detectedName);
      }

      setOcrVerified(true);
      let isMatched = Boolean(data?.success);
      if (!isMatched && combined) {
        const clientRes = evaluateClientMatch(combined, checkName, checkId);
        if (clientRes.success) {
          isMatched = true;
        }
      }

      if (isMatched) {
        setOcrSuccess(true);
        setOcrError("");
      } else {
        setOcrSuccess(false);
        setOcrError(
          data?.message ||
            "The student name or ID number on your uploaded Library Card failed to match your entered credentials."
        );
      }
    } catch (err: any) {
      console.warn("Auto OCR notice on borrow form:", err?.response?.data || err?.message);
      if (ocrScannedText) {
        const clientRes = evaluateClientMatch(ocrScannedText, checkName, checkId);
        setOcrVerified(true);
        setOcrSuccess(clientRes.success);
        setOcrError(clientRes.success ? "" : clientRes.message);
      } else {
        setOcrVerified(true);
        setOcrSuccess(false);
        setOcrError("Unable to reach OCR verification service. Please check your network connection or tap Retry.");
      }
    } finally {
      setOcrVerifying(false);
    }
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (ocrScannedText) {
      const matchRes = evaluateClientMatch(ocrScannedText, val, studentId);
      setOcrVerified(true);
      setOcrSuccess(matchRes.success);
      setOcrError(matchRes.success ? "" : matchRes.message);
    }
  };

  const handleStudentIdChange = (val: string) => {
    setStudentId(val);
    if (ocrScannedText) {
      const matchRes = evaluateClientMatch(ocrScannedText, name, val);
      setOcrVerified(true);
      setOcrSuccess(matchRes.success);
      setOcrError(matchRes.success ? "" : matchRes.message);
    }
  };

  const captureFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Please allow camera access to photograph your Library Card.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.45,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const base64Uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      setStudentIDImage(base64Uri);
      setOcrVerified(false);
      setOcrSuccess(false);
      setOcrError("");
      void triggerAutoOcrScan(base64Uri);
    }
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Please allow photo library access to select your Library Card.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.45,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const base64Uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      setStudentIDImage(base64Uri);
      setOcrVerified(false);
      setOcrSuccess(false);
      setOcrError("");
      void triggerAutoOcrScan(base64Uri);
    }
  };

  const loadRegisteredLibraryId = async () => {
    try {
      const cards = await loadStudentIdCardsForUser(user || profile);
      const targetImg = cards?.libraryIdFront || cards?.schoolIdFront;
      if (targetImg) {
        setStudentIDImage(targetImg);
        void triggerAutoOcrScan(targetImg);
        Alert.alert("Library ID Loaded", "Registered Library ID loaded successfully. Verifying credentials via OCR.");
      } else {
        Alert.alert("No Saved ID", "No registered Library ID was found. Please take a photo or select from gallery.");
      }
    } catch {
      Alert.alert("Error", "Could not load saved Library ID.");
    }
  };

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
    await pickFromGallery();
  };

  // 🚨 SUBMIT
  const handleSubmit = async () => {
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

    if (!name || !studentId || !department) {
      Alert.alert('Missing Information', 'Please enter your Name, Student ID, and Course/Department.');
      return;
    }

    if (!studentIDImage) {
      Alert.alert(
        'Library Card Required',
        'Please upload your Library Card using your camera or gallery before submitting.'
      );
      return;
    }

    // STRICT CHECK FOR LOCALHOST:
    // Student info must match the uploaded Library Card via OCR analysis!
    if (isLocalhost) {
      if (ocrVerifying) {
        Alert.alert(
          "Scanning in Progress",
          "Please wait a moment while your Library Card is being scanned and matched via OCR."
        );
        return;
      }

      let isVerified = ocrVerified && ocrSuccess;
      let mismatchReason = ocrError;

      if (!isVerified) {
        setIsSubmitting(true);
        setOcrVerifying(true);
        try {
          const response = await apiClient.post(
            "/api/student/ocr/verify-id",
            {
              schoolIdFront: studentIDImage,
              libraryIdFront: studentIDImage,
              expectedName: name.trim(),
              expectedIdNumber: studentId.trim(),
            },
            { timeout: 35000 }
          );

          const ocrResult = response.data;
          const combined =
            ocrResult?.extracted?.combined ||
            ocrResult?.extracted?.schoolId?.rawText ||
            ocrResult?.extracted?.libraryId?.rawText ||
            "";
          if (combined) setOcrScannedText(combined);
          if (ocrResult?.detectedIdNumber) setDetectedIdNumber(ocrResult.detectedIdNumber);
          if (ocrResult?.detectedName) setDetectedName(ocrResult.detectedName);

          let matched = Boolean(ocrResult?.success);
          if (!matched && combined) {
            const clientRes = evaluateClientMatch(combined, name, studentId);
            if (clientRes.success) matched = true;
          }

          if (matched) {
            isVerified = true;
            setOcrSuccess(true);
            setOcrVerified(true);
            setOcrError("");
          } else {
            isVerified = false;
            mismatchReason = ocrResult?.message || "The student info does not match the uploaded Library Card.";
            setOcrSuccess(false);
            setOcrVerified(true);
            setOcrError(mismatchReason);
          }
        } catch (err: any) {
          if (ocrScannedText) {
            const clientRes = evaluateClientMatch(ocrScannedText, name, studentId);
            isVerified = clientRes.success;
            mismatchReason = clientRes.message;
            setOcrSuccess(isVerified);
            setOcrVerified(true);
            setOcrError(isVerified ? "" : clientRes.message);
          } else {
            mismatchReason = err?.response?.data?.message || "Failed to reach OCR verification service.";
          }
        } finally {
          setIsSubmitting(false);
          setOcrVerifying(false);
        }
      }

      // If NOT matched, STOP and DO NOT CONTINUE!
      if (!isVerified) {
        Alert.alert(
          "ID Verification Failed",
          `${mismatchReason || "The information on your Library Card does not match your entered credentials."}\n\nEntered Credentials:\n• Name: ${name}\n• Student ID: ${studentId}\n\nYou cannot continue with this ${action.toLowerCase()} request until your information matches your Library Card. Please re-upload a clearer photo or match your entered details.`,
          [
            {
              text: "Match Details or Re-upload",
              style: "default",
            },
          ]
        );
        return;
      }
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
        onChangeText={handleNameChange}
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
        onChangeText={handleStudentIdChange}
        placeholder="Enter your student ID"
        placeholderTextColor={isDarkMode ? "#64748B" : "#94A3B8"}
      />

      {/* MANUAL SCHOOL ID UPLOAD WITH OCR ANALYSIS */}
      <View style={{ marginTop: 20, marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={[styles.label, { color: theme.textPrimary, marginTop: 0, marginBottom: 0 }]}>
            School ID / Library Card (Required)
          </Text>
          <View style={{
            backgroundColor: isDarkMode ? "rgba(250, 204, 21, 0.12)" : "rgba(2, 116, 187, 0.1)",
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
          }}>
            <Text style={{
              fontSize: 11,
              fontWeight: "700",
              color: isDarkMode ? theme.accentGold : theme.accentBlue,
            }}>
              Manual Upload • Camera / Gallery
            </Text>
          </View>
        </View>

        {!studentIDImage ? (
          <View
            style={[
              styles.manualUploadBox,
              {
                backgroundColor: isDarkMode ? "#0B132B" : "#F8FAFC",
                borderColor: isDarkMode ? "rgba(250, 204, 21, 0.3)" : "#CBD5E1",
              },
            ]}
          >
            <View style={styles.manualUploadIconCircle}>
              <Ionicons
                name="id-card-outline"
                size={32}
                color={isDarkMode ? theme.accentGold : theme.accentBlue}
              />
            </View>
            <Text style={[styles.manualUploadTitle, { color: theme.textPrimary }]}>
              Upload School ID / Library Card
            </Text>
            <Text style={[styles.manualUploadSubtitle, { color: theme.textSecondary }]}>
              Capture a photo with your camera or select from your gallery. The app will automatically analyze the ID to match your name and student ID number.
            </Text>

            <View style={styles.manualUploadButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.uploadOptionBtn,
                  {
                    backgroundColor: isDarkMode ? "#1E293B" : "#FFFFFF",
                    borderColor: isDarkMode ? "#334155" : "#CBD5E1",
                  },
                ]}
                onPress={captureFromCamera}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="camera"
                  size={18}
                  color={isDarkMode ? theme.accentGold : theme.accentBlue}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.uploadOptionBtnText,
                    { color: isDarkMode ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  Take Photo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.uploadOptionBtn,
                  {
                    backgroundColor: isDarkMode ? "#1E293B" : "#FFFFFF",
                    borderColor: isDarkMode ? "#334155" : "#CBD5E1",
                  },
                ]}
                onPress={pickFromGallery}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="images"
                  size={18}
                  color={isDarkMode ? theme.accentGold : theme.accentBlue}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.uploadOptionBtnText,
                    { color: isDarkMode ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  From Gallery
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View>
            <View
              style={[
                styles.idPreviewContainer,
                {
                  backgroundColor: isDarkMode ? "#0F172A" : "#F8FAFC",
                  borderColor: isDarkMode ? "rgba(255, 200, 0, 0.35)" : "#CBD5E1",
                },
              ]}
            >
              <Image
                source={{ uri: studentIDImage }}
                style={styles.idPreview}
              />
            </View>

            {/* Action buttons under preview */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8, marginBottom: 10 }}>
              <TouchableOpacity
                style={[
                  styles.uploadOptionBtn,
                  {
                    flex: 1,
                    backgroundColor: isDarkMode ? "#1E293B" : "#FFFFFF",
                    borderColor: isDarkMode ? "#334155" : "#CBD5E1",
                    paddingVertical: 9,
                  },
                ]}
                onPress={captureFromCamera}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="camera"
                  size={16}
                  color={isDarkMode ? theme.accentGold : theme.accentBlue}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.uploadOptionBtnText,
                    { color: isDarkMode ? "#F8FAFC" : "#0F172A", fontSize: 13 },
                  ]}
                >
                  Retake Photo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.uploadOptionBtn,
                  {
                    flex: 1,
                    backgroundColor: isDarkMode ? "#1E293B" : "#FFFFFF",
                    borderColor: isDarkMode ? "#334155" : "#CBD5E1",
                    paddingVertical: 9,
                  },
                ]}
                onPress={pickFromGallery}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="images"
                  size={16}
                  color={isDarkMode ? theme.accentGold : theme.accentBlue}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.uploadOptionBtnText,
                    { color: isDarkMode ? "#F8FAFC" : "#0F172A", fontSize: 13 },
                  ]}
                >
                  Change Photo
                </Text>
              </TouchableOpacity>
            </View>

            {/* OCR STATUS FEEDBACK BOXES */}
            {ocrVerifying ? (
              <View
                style={[
                  styles.ocrVerifyingBox,
                  {
                    backgroundColor: isDarkMode ? "rgba(234, 179, 8, 0.18)" : "#FEF9C3",
                    borderColor: isDarkMode ? "#EAB308" : "#CA8A04",
                    borderWidth: 1.5,
                  },
                ]}
              >
                <ActivityIndicator size="small" color={isDarkMode ? "#FACC15" : "#A16207"} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.ocrVerifyingText,
                      {
                        color: isDarkMode ? "#FACC15" : "#713F12",
                        fontWeight: "800",
                        fontSize: 13.5,
                      },
                    ]}
                  >
                    Analyzing ID Card...
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: isDarkMode ? "#FEF08A" : "#854D0E",
                      marginTop: 3,
                    }}
                  >
                    Scanning card text and matching "{name}" ({studentId})...
                  </Text>
                </View>
              </View>
            ) : ocrVerified && ocrSuccess ? (
              <View
                style={[
                  styles.ocrSuccessBox,
                  {
                    backgroundColor: isDarkMode ? "rgba(16, 185, 129, 0.18)" : "#DCFCE7",
                    borderColor: isDarkMode ? "#10B981" : "#16A34A",
                    borderWidth: 1.5,
                  },
                ]}
              >
                <Ionicons name="checkmark-circle" size={24} color={isDarkMode ? "#34D399" : "#15803D"} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.ocrSuccessText,
                      {
                        color: isDarkMode ? "#34D399" : "#14532D",
                        fontWeight: "800",
                        fontSize: 13.5,
                      },
                    ]}
                  >
                    School ID / Library Card Verified & Matched ✓
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: isDarkMode ? "#E2E8F0" : "#166534",
                      marginTop: 3,
                      lineHeight: 17,
                    }}
                  >
                    Card matches "{name}" ({studentId}). You may proceed with this {action.toLowerCase()} request.
                  </Text>
                </View>
              </View>
            ) : ocrVerified && !ocrSuccess && studentIDImage ? (
              <View
                style={[
                  styles.ocrErrorBox,
                  {
                    backgroundColor: isDarkMode ? "rgba(239, 68, 68, 0.18)" : "#FEE2E2",
                    borderColor: isDarkMode ? "#EF4444" : "#DC2626",
                    borderWidth: 1.5,
                  },
                ]}
              >
                <Ionicons name="alert-circle" size={24} color={isDarkMode ? "#F87171" : "#DC2626"} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.ocrErrorText,
                      {
                        color: isDarkMode ? "#F87171" : "#7F1D1D",
                        fontSize: 13.5,
                        fontWeight: "900",
                        marginBottom: 3,
                      },
                    ]}
                  >
                    ID Card Mismatch ✕
                  </Text>
                  <Text style={[styles.ocrErrorText, { color: isDarkMode ? "#FECACA" : "#991B1B", fontWeight: "600" }]}>
                    {ocrError}
                  </Text>
                  {(detectedName || detectedIdNumber) ? (
                    <Text style={{ fontSize: 11.5, color: isDarkMode ? "#FECACA" : "#7F1D1D", marginTop: 4, fontWeight: "700" }}>
                      Detected on card: {detectedName ? `Name: "${detectedName}" ` : ""}{detectedIdNumber ? `• ID: "${detectedIdNumber}"` : ""}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 10 }}>
                    <TouchableOpacity
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        backgroundColor: isDarkMode ? "#7F1D1D" : "#FEE2E2",
                        borderWidth: 1,
                        borderColor: isDarkMode ? "#DC2626" : "#EF4444",
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                      onPress={() => triggerAutoOcrScan()}
                      disabled={ocrVerifying}
                    >
                      <Ionicons name="refresh" size={14} color={isDarkMode ? "#FECACA" : "#991B1B"} style={{ marginRight: 4 }} />
                      <Text style={{ fontSize: 12, fontWeight: "700", color: isDarkMode ? "#FECACA" : "#991B1B" }}>
                        Retry Scan
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        )}
      </View>

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
                  : (isLocalhost && studentIDImage && ocrVerified && !ocrSuccess)
                  ? (isDarkMode ? "rgba(239, 68, 68, 0.18)" : "#FEE2E2")
                  : theme.buttonPrimaryBg),
            borderColor: isLimitReached
              ? (isDarkMode ? "#EF4444" : "#F87171")
              : (hasOverdueLoans
                  ? (isDarkMode ? "#F59E0B" : "#FBBF24")
                  : (isLocalhost && studentIDImage && ocrVerified && !ocrSuccess)
                  ? (isDarkMode ? "#EF4444" : "#F87171")
                  : (isDarkMode ? theme.buttonPrimaryBorder : "rgba(2, 116, 187, 0.25)")),
            borderWidth: 1.5,
            minHeight: 56,
            borderRadius: 14,
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            elevation: (isLimitReached || hasOverdueLoans || (isLocalhost && studentIDImage && ocrVerified && !ocrSuccess)) ? 2 : 6,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: (isLimitReached || hasOverdueLoans) ? 0.15 : 0.25,
            shadowRadius: 6,
            marginTop: (isLimitReached || hasOverdueLoans) ? 14 : 22,
            marginBottom: 10,
          },
          isSubmitting && { opacity: 0.6 }
        ]}
        disabled={isSubmitting || ocrVerifying}
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
                  ? (isLimitReached ? "alert-circle" : (hasOverdueLoans ? "warning" : ((isLocalhost && studentIDImage && ocrVerified && !ocrSuccess) ? "alert-circle" : "paper-plane")))
                  : ((isLocalhost && studentIDImage && ocrVerified && !ocrSuccess) ? "alert-circle" : "bookmark")
              }
              size={19}
              color={
                isLimitReached
                  ? (isDarkMode ? "#F87171" : "#DC2626")
                  : (hasOverdueLoans
                      ? (isDarkMode ? "#FBBF24" : "#D97706")
                      : (isLocalhost && studentIDImage && ocrVerified && !ocrSuccess)
                      ? (isDarkMode ? "#F87171" : "#DC2626")
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
                      : (isLocalhost && studentIDImage && ocrVerified && !ocrSuccess)
                      ? (isDarkMode ? "#F87171" : "#DC2626")
                      : theme.buttonPrimaryText),
                fontWeight: '900',
                fontSize: 16,
                letterSpacing: 0.4,
              }}
            >
              {ocrVerifying
                ? "SCANNING LIBRARY ID..."
                : isBorrow
                ? (isLimitReached
                    ? `Borrow Limit Reached (${activeBorrowCount}/${borrowLimit})`
                    : (hasOverdueLoans
                        ? `Overdue Return Required (${overdueBooks.length})`
                        : (isLocalhost && studentIDImage && ocrVerified && !ocrSuccess)
                        ? "MATCH REQUIRED TO PROCEED ✕"
                        : 'Submit Borrow Request →'))
                : ((isLocalhost && studentIDImage && ocrVerified && !ocrSuccess)
                    ? "MATCH REQUIRED TO PROCEED ✕"
                    : 'Reserve Book (Join Queue) →')}
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

  idPreviewContainer: {
    width: '100%',
    aspectRatio: 10 / 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    marginTop: 4,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
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
  ocrNoticeBox: {
    backgroundColor: "rgba(30, 42, 66, 0.8)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2D3E5E",
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 10,
    marginBottom: 6,
  },
  ocrNoticeText: {
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 18,
  },
  ocrVerifyingBox: {
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EAB308",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
    marginBottom: 6,
  },
  ocrVerifyingText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFC800",
  },
  ocrErrorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#EF4444",
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 10,
    marginBottom: 6,
  },
  ocrErrorText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#F87171",
    lineHeight: 18,
  },
  ocrSuccessBox: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#10B981",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
    marginBottom: 6,
  },
  ocrSuccessText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#34D399",
  },
  manualUploadBox: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 6,
  },
  manualUploadIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(250, 204, 21, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  manualUploadTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  manualUploadSubtitle: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  manualUploadButtonsRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  uploadOptionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  uploadOptionBtnText: {
    fontSize: 13.5,
    fontWeight: "700",
  },
});