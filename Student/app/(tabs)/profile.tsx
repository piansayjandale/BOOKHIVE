import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  Modal,
  Dimensions,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimatedScreen from "../../components/AnimatedScreen";

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../data/AuthContext";
import { useThemeColors } from "../../hooks/useThemeColors";
import {
  getReservations,
  getStudentProfile,
  subscribe,
  getNotifications,
  NotificationItem,
  ReservationBook,
  COURSE_DATA,
  getCourseLabel,
  saveStudentProfile,
  fetchStudentCardAndViolations,
  hasAllFourIdPhotos,
  loadStudentIdCardsForUser,
  saveStudentIdCardsToStorage,
  rotateIdCardSlot,
  toggleIdCardsOrientation,
  StudentIdCardsData,
} from "../../data/store";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const getDepartmentFullName = (deptCode?: string) => {
  if (!deptCode) return "Not specified";
  const found = COURSE_DATA.find((g) => g.department.toLowerCase() === deptCode.toLowerCase());
  if (found) return `${found.department} - ${found.fullName}`;
  return deptCode;
};

const getCourseDisplay = (courseCode?: string) => {
  if (!courseCode) return "Not specified";
  const label = getCourseLabel(courseCode);
  return label || courseCode;
};

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ requireIdUpload?: string }>();
  const insets = useSafeAreaInsets();
  const { isDarkMode, toggleTheme, theme } = useThemeColors();
  const { user, logout, updateUser } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [imageLoadError, setImageLoadError] = useState(false);
  const [photoOptionsVisible, setPhotoOptionsVisible] = useState(false);
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);

  const [reservations, setReservations] = useState(getReservations());
  const [profile, setProfile] = useState(getStudentProfile());
  const [notifications, setNotifications] = useState<NotificationItem[]>(getNotifications());

  // 4 ID Cards state (School ID Front & Back, Library ID Front & Back)
  const [uploadedIdCards, setUploadedIdCards] = useState<StudentIdCardsData | null>(null);
  const [idCardsChecked, setIdCardsChecked] = useState(false);
  const [idUploadModalVisible, setIdUploadModalVisible] = useState(false);
  const [idViewerModalVisible, setIdViewerModalVisible] = useState(false);
  const [showIdCards, setShowIdCards] = useState(false);
  const [enlargedIdPhoto, setEnlargedIdPhoto] = useState<{
    title: string;
    uri: string;
    slotKey?: string;
    rotation?: number;
    orientation?: "portrait" | "landscape";
  } | null>(null);
  const [savingIdCards, setSavingIdCards] = useState(false);

  // Draft slots for uploading the 4 ID photos
  const [draftSchoolFront, setDraftSchoolFront] = useState<string>("");
  const [draftSchoolBack, setDraftSchoolBack] = useState<string>("");
  const [draftLibraryFront, setDraftLibraryFront] = useState<string>("");
  const [draftLibraryBack, setDraftLibraryBack] = useState<string>("");
  const [idCaptureOrientation, setIdCaptureOrientation] = useState<"portrait" | "landscape">("portrait");
  const draftBase64Ref = React.useRef<{
    schoolFront?: string;
    schoolBack?: string;
    libraryFront?: string;
    libraryBack?: string;
  }>({});

  const refreshIdCardsState = React.useCallback(async () => {
    const currentProf = getStudentProfile();
    const stored = await loadStudentIdCardsForUser(user || currentProf);

    let baseCards: StudentIdCardsData | null = null;
    if (hasAllFourIdPhotos(user)) {
      baseCards = {
        schoolIdFront: String(user!.schoolIdFront),
        schoolIdBack: String(user!.schoolIdBack),
        libraryIdFront: String(user!.libraryIdFront),
        libraryIdBack: String(user!.libraryIdBack),
        ownerEmail: user?.email,
        ownerStudentId: user?.studentId,
      };
    } else if (hasAllFourIdPhotos(currentProf)) {
      baseCards = {
        schoolIdFront: String(currentProf.schoolIdFront),
        schoolIdBack: String(currentProf.schoolIdBack),
        libraryIdFront: String(currentProf.libraryIdFront),
        libraryIdBack: String(currentProf.libraryIdBack),
        ownerEmail: currentProf.email,
        ownerStudentId: currentProf.studentId,
      };
    }

    const mergedCards: StudentIdCardsData | null =
      baseCards || stored
        ? {
            ...(baseCards || {}),
            ...(stored || {}),
            schoolIdFront: stored?.schoolIdFront || baseCards?.schoolIdFront,
            schoolIdBack: stored?.schoolIdBack || baseCards?.schoolIdBack,
            libraryIdFront: stored?.libraryIdFront || baseCards?.libraryIdFront,
            libraryIdBack: stored?.libraryIdBack || baseCards?.libraryIdBack,
            orientation: stored?.orientation || (baseCards as any)?.orientation || "portrait",
            rotations: { ...(baseCards?.rotations || {}), ...(stored?.rotations || {}) },
          }
        : null;

    if (mergedCards?.orientation) {
      setIdCaptureOrientation(mergedCards.orientation);
    }
    setUploadedIdCards(mergedCards);
    setIdCardsChecked(true);
  }, [user]);

  useEffect(() => {
    setReservations(getReservations());
    setProfile(getStudentProfile());
    setNotifications(getNotifications());
    void refreshIdCardsState();
    return subscribe(() => {
      setReservations(getReservations());
      setProfile(getStudentProfile());
      setNotifications(getNotifications());
      void refreshIdCardsState();
    });
  }, [refreshIdCardsState]);

  useFocusEffect(
    React.useCallback(() => {
      setReservations(getReservations());
      setProfile(getStudentProfile());
      setNotifications(getNotifications());
      void refreshIdCardsState();
    }, [refreshIdCardsState])
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const borrowedBooks = React.useMemo(() => {
    return reservations.filter((book) => {
      const isRes =
        book.action === 'Reserve' ||
        (book as any).type === 'Reservation' ||
        book.status === 'Reserved' ||
        book.status === 'Reservation';
      if (isRes) return false;
      const isReturned = !!(book.isReturned || book.status === 'Completed' || book.status === 'Returned' || book.date === 'Returned');
      if (isReturned) return false;
      if (book.status === 'Declined' || book.status === 'Cancelled' || book.status === 'Rejected') return false;
      return (
        book.status === 'Approved' ||
        book.status === 'Picked Up' ||
        book.status === 'On Loan' ||
        book.status === 'Active' ||
        book.status === 'Active Loan' ||
        book.status === 'Due to Return' ||
        book.status === 'Overdue' ||
        book.status === 'Due' ||
        Boolean(book.isPickedUp || book.pickedUpAt)
      );
    });
  }, [reservations]);

  const activeReservationsCount = React.useMemo(() => {
    return reservations.filter((book) => {
      const isRes =
        book.action === 'Reserve' ||
        (book as any).type === 'Reservation' ||
        book.status === 'Reserved' ||
        book.status === 'Reservation' ||
        (book as any).dueReturnDate === 'Reservation';
      if (!isRes) return false;
      const isReturned = !!(book.isReturned || book.status === 'Completed' || book.status === 'Returned' || book.date === 'Returned');
      if (isReturned) return false;
      if (book.status === 'Declined' || book.status === 'Cancelled' || book.status === 'Rejected') return false;
      return true;
    }).length;
  }, [reservations]);

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
      penaltyAmount: 50.0,
      remarks: `Overdue loan beyond agreed due date (${b.date}). Standard fine ₱50/day applied.`,
      status: "Active Penalty",
      date: b.date,
    }));

  const [serverViolations, setServerViolations] = useState<any[]>([]);
  const [loadingViolations, setLoadingViolations] = useState(false);
  const [violationTab, setViolationTab] = useState<"active" | "all">("active");

  const loadViolations = React.useCallback(async () => {
    const targetId = user?.studentId || profile.studentId || (user as any)?.idNumber || user?.qrCode;
    if (!targetId) return;
    try {
      setLoadingViolations(true);
      const data = await fetchStudentCardAndViolations(targetId);
      if (data?.violations) {
        setServerViolations(data.violations);
      }
    } catch (err) {
      console.warn("Failed to fetch violations in profile:", err);
    } finally {
      setLoadingViolations(false);
    }
  }, [user, profile.studentId]);

  useEffect(() => {
    loadViolations();
  }, [loadViolations]);

  const lastViolationsFetchTimeRef = React.useRef<number>(0);
  useFocusEffect(
    React.useCallback(() => {
      const now = Date.now();
      if (now - lastViolationsFetchTimeRef.current > 15000) {
        lastViolationsFetchTimeRef.current = now;
        loadViolations();
      }
    }, [loadViolations])
  );

  const allViolations = React.useMemo(() => {
    const list: any[] = [];
    const seenTitles = new Set<string>();

    serverViolations.forEach((v) => {
      list.push(v);
      if (v.bookTitle) seenTitles.add(v.bookTitle.toLowerCase().trim());
    });

    violations.forEach((v) => {
      if (!v.bookTitle || !seenTitles.has(v.bookTitle.toLowerCase().trim())) {
        list.push(v);
        if (v.bookTitle) seenTitles.add(v.bookTitle.toLowerCase().trim());
      }
    });

    return list;
  }, [serverViolations, violations]);

  const activeViolations = React.useMemo(() => {
    return allViolations.filter((v) => {
      const s = (v.status || "").toLowerCase();
      return !s.includes("settled") && !s.includes("cleared") && !s.includes("resolved") && !s.includes("paid");
    });
  }, [allViolations]);

  const displayedViolations = violationTab === "active" ? activeViolations : allViolations;
  const totalPenalty = activeViolations.reduce((acc, v) => acc + (Number(v.penaltyAmount) || 0), 0);

  const studentFullName = user?.fullName || profile.name || "Student";
  const studentIdNumber = user?.studentId || profile.studentId || "N/A";
  const studentEmail = user?.email || profile.email || "N/A";
  const studentDepartment = user?.department || profile.department || "CICT";
  const studentCourse = user?.course || profile.course || "BSIT";
  const studentYearLevel = user?.yearLevel || profile.yearlevel || profile.yearLevel || "Not specified";
  const studentSection = user?.section || profile.section || "";
  const studentStatus = user?.status || profile.status || "Active";
  const studentRole = user?.role || profile.role || "Student";

  const studentCourseSection = `${studentCourse}${profile.yearlevel ? ` - ${profile.yearlevel}` : ""}`;
  const studentYearSection =
    studentYearLevel !== "Not specified"
      ? `${studentYearLevel}${studentSection ? ` • Section ${studentSection}` : ""}`
      : studentSection
      ? `Section ${studentSection}`
      : "Not specified";

  // Avatar scoping: only use profile.avatar if it matches the current logged-in user
  const profileMatchesUser = !user || !user.studentId || profile.studentId === user.studentId || profile.email === user.email;
  const currentAvatar = (user?.avatar || (profileMatchesUser ? profile.avatar : "") || "").trim();
  const hasValidAvatar = Boolean(
    currentAvatar &&
    (currentAvatar.startsWith("http") || currentAvatar.startsWith("data:")) &&
    !currentAvatar.includes("placeholder.com")
  );

  const applyProfilePhoto = async (asset: ImagePicker.ImagePickerAsset | null) => {
    try {
      const base64Uri = asset ? (asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri) : "";
      setImageLoadError(false);
      setProfile((prev) => ({ ...prev, avatar: base64Uri }));
      if (updateUser) {
        updateUser({ avatar: base64Uri });
      }

      await saveStudentProfile({
        ...profile,
        name: studentFullName,
        studentId: studentIdNumber,
        department: studentDepartment,
        course: studentCourse,
        avatar: base64Uri,
      });

      Alert.alert(
        "Profile Picture Updated",
        asset
          ? "Your new profile picture has been saved! It will now be visible to librarians and other students when scanning your Library Card QR code."
          : "Profile photo removed."
      );
    } catch (err) {
      console.warn("Error applying profile photo:", err);
      Alert.alert("Error", "Could not save profile picture. Please try again.");
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Camera permission is required to capture your profile photo.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        await applyProfilePhoto(result.assets[0]);
      }
    } catch (err) {
      console.log("Error taking photo:", err);
      Alert.alert("Error", "Could not capture photo.");
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Gallery permission is required to choose a profile photo.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        await applyProfilePhoto(result.assets[0]);
      }
    } catch (err) {
      console.log("Error choosing photo:", err);
      Alert.alert("Error", "Could not select photo.");
    }
  };

  const handlePickProfilePicture = () => {
    setPhotoOptionsVisible(true);
  };

  const hasUploadedSchoolId = Boolean(
    (uploadedIdCards?.schoolIdFront || profile?.schoolIdFront || user?.schoolIdFront) &&
    (uploadedIdCards?.schoolIdBack || profile?.schoolIdBack || user?.schoolIdBack)
  );
  const hasUploadedAllFour = hasUploadedSchoolId;
  const isProfileIdPortrait = (uploadedIdCards?.orientation || idCaptureOrientation || "portrait") === "portrait";

  const openIdUploadModal = () => {
    setDraftSchoolFront(uploadedIdCards?.schoolIdFront || "");
    setDraftSchoolBack(uploadedIdCards?.schoolIdBack || "");
    setDraftLibraryFront(uploadedIdCards?.libraryIdFront || "");
    setDraftLibraryBack(uploadedIdCards?.libraryIdBack || "");
    draftBase64Ref.current = {
      schoolFront: uploadedIdCards?.schoolIdFront || "",
      schoolBack: uploadedIdCards?.schoolIdBack || "",
      libraryFront: uploadedIdCards?.libraryIdFront || "",
      libraryBack: uploadedIdCards?.libraryIdBack || "",
    };
    setIdUploadModalVisible(true);
  };

  const pickSingleIdImage = async (
    mode: "camera" | "gallery",
    slotLabel: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
    orientationOverride?: "portrait" | "landscape",
    slotKey?: "schoolFront" | "schoolBack" | "libraryFront" | "libraryBack"
  ): Promise<boolean> => {
    const activeOrientation = orientationOverride || idCaptureOrientation;
    const cropAspect: [number, number] =
      activeOrientation === "portrait" ? [10, 16] : [16, 10];

    try {
      if (mode === "camera") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Camera Permission Required",
            `Please enable camera access to capture your ${slotLabel}.`
          );
          return false;
        }
        const res = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: cropAspect,
          quality: 0.35,
          base64: true,
        });
        if (!res.canceled && res.assets && res.assets.length > 0) {
          const asset = res.assets[0];
          const base64Uri = asset.base64
            ? `data:image/jpeg;base64,${asset.base64}`
            : asset.uri;
          const localUri =
            Platform.OS === "web" ? base64Uri : asset.uri || base64Uri;
          if (slotKey) {
            draftBase64Ref.current[slotKey] = base64Uri;
          }
          setter(localUri);
          return true;
        }
        return false;
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Gallery Permission Required",
            `Please enable gallery access to upload your ${slotLabel}.`
          );
          return false;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: cropAspect,
          quality: 0.35,
          base64: true,
        });
        if (!res.canceled && res.assets && res.assets.length > 0) {
          const asset = res.assets[0];
          const base64Uri = asset.base64
            ? `data:image/jpeg;base64,${asset.base64}`
            : asset.uri;
          const localUri =
            Platform.OS === "web" ? base64Uri : asset.uri || base64Uri;
          if (slotKey) {
            draftBase64Ref.current[slotKey] = base64Uri;
          }
          setter(localUri);
          return true;
        }
        return false;
      }
    } catch (err) {
      console.warn(`Failed to pick ${slotLabel}:`, err);
      Alert.alert("Upload Error", `Could not load ${slotLabel}. Please try again.`);
      return false;
    }
  };

  const promptOrientationAndPick = (
    mode: "camera" | "gallery",
    slotLabel: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
    slotKey: "schoolFront" | "schoolBack" | "libraryFront" | "libraryBack"
  ) => {
    if (Platform.OS === "web") {
      void pickSingleIdImage(mode, slotLabel, setter, idCaptureOrientation, slotKey);
      return;
    }
    Alert.alert(
      `${slotLabel} Orientation`,
      `Choose Portrait (vertical ID) or Landscape (horizontal ID) before ${
        mode === "camera" ? "capturing" : "cropping"
      }:`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Portrait (Vertical)",
          onPress: () => {
            setIdCaptureOrientation("portrait");
            void pickSingleIdImage(mode, slotLabel, setter, "portrait", slotKey);
          },
        },
        {
          text: "Landscape (Horizontal)",
          onPress: () => {
            setIdCaptureOrientation("landscape");
            void pickSingleIdImage(mode, slotLabel, setter, "landscape", slotKey);
          },
        },
      ]
    );
  };

  const promptSlotSource = (
    slotLabel: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
    slotKey: "schoolFront" | "schoolBack" | "libraryFront" | "libraryBack"
  ) => {
    if (Platform.OS === "web") {
      void pickSingleIdImage("gallery", slotLabel, setter, idCaptureOrientation, slotKey);
      return;
    }
    Alert.alert(
      slotLabel,
      `How would you like to provide your ${slotLabel}?`,
      [
        {
          text: "Take Photo (Camera)",
          onPress: () => promptOrientationAndPick("camera", slotLabel, setter, slotKey),
        },
        {
          text: "Choose from Gallery",
          onPress: () => promptOrientationAndPick("gallery", slotLabel, setter, slotKey),
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handleSaveFourIdPhotos = async () => {
    if (!draftSchoolFront || !draftSchoolBack) {
      Alert.alert(
        "School ID Required",
        "Please upload both the Front and Back of your School ID."
      );
      return;
    }

    try {
      setSavingIdCards(true);

      const targetEmail = studentEmail !== "N/A" ? studentEmail : user?.email;
      const targetStudentId = studentIdNumber !== "N/A" ? studentIdNumber : user?.studentId;

      const currentLibraryFront = draftLibraryFront || uploadedIdCards?.libraryIdFront || "";
      const currentLibraryBack = draftLibraryBack || uploadedIdCards?.libraryIdBack || "";

      // Local payload uses lightweight file:// URIs on native devices to prevent Android SQLite_FULL
      const cardsPayload: StudentIdCardsData = {
        schoolIdFront: draftSchoolFront,
        schoolIdBack: draftSchoolBack,
        libraryIdFront: currentLibraryFront,
        libraryIdBack: currentLibraryBack,
        verifiedAt: new Date().toISOString(),
        ownerEmail: targetEmail,
        ownerStudentId: targetStudentId,
        orientation: idCaptureOrientation,
        rotations: uploadedIdCards?.rotations || {},
      };

      await saveStudentIdCardsToStorage(
        cardsPayload,
        targetEmail,
        targetStudentId
      );

      setUploadedIdCards(cardsPayload);

      if (updateUser) {
        updateUser({
          schoolIdFront: draftSchoolFront,
          schoolIdBack: draftSchoolBack,
          libraryIdFront: currentLibraryFront,
          libraryIdBack: currentLibraryBack,
        });
      }

      // Sync to backend using compressed base64 when available
      await saveStudentProfile({
        ...profile,
        name: studentFullName,
        studentId: studentIdNumber,
        email: studentEmail !== "N/A" ? studentEmail : profile.email,
        department: studentDepartment,
        course: studentCourse,
        schoolIdFront: draftBase64Ref.current.schoolFront || draftSchoolFront,
        schoolIdBack: draftBase64Ref.current.schoolBack || draftSchoolBack,
        libraryIdFront: draftBase64Ref.current.libraryFront || currentLibraryFront,
        libraryIdBack: draftBase64Ref.current.libraryBack || currentLibraryBack,
      });

      setIdUploadModalVisible(false);

      Alert.alert(
        "School ID Uploaded!",
        "Your School ID (Front & Back) has been saved successfully. Tap the School ID icon anytime to view your ID pictures!"
      );
    } catch (err) {
      console.warn("Error saving School ID cards:", err);
      Alert.alert("Error", "Could not save your ID pictures. Please try again.");
    } finally {
      setSavingIdCards(false);
    }
  };

  const handleRotateEnlargedPhoto = async () => {
    if (!enlargedIdPhoto) return;
    const targetSlot = enlargedIdPhoto.slotKey;
    const currentRot = (enlargedIdPhoto.rotation || 0) + 90;
    const nextRot = currentRot % 360;

    setEnlargedIdPhoto((prev) => (prev ? { ...prev, rotation: nextRot } : null));

    if (targetSlot) {
      setUploadedIdCards((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rotations: {
            ...(prev.rotations || {}),
            [targetSlot]: nextRot,
          },
        };
      });

      const targetEmail = studentEmail !== "N/A" ? studentEmail : user?.email;
      const targetStudentId = studentIdNumber !== "N/A" ? studentIdNumber : user?.studentId;
      await rotateIdCardSlot(targetSlot, targetEmail, targetStudentId, 90);
    }
  };

  const handleToggleOrientationEnlargedPhoto = async () => {
    const currentOri = enlargedIdPhoto?.orientation || uploadedIdCards?.orientation || idCaptureOrientation || "portrait";
    const nextOri = currentOri === "portrait" ? "landscape" : "portrait";

    setIdCaptureOrientation(nextOri);
    setEnlargedIdPhoto((prev) => (prev ? { ...prev, orientation: nextOri } : null));
    setUploadedIdCards((prev) => {
      if (!prev) return prev;
      return { ...prev, orientation: nextOri };
    });

    const targetEmail = studentEmail !== "N/A" ? studentEmail : user?.email;
    const targetStudentId = studentIdNumber !== "N/A" ? studentIdNumber : user?.studentId;
    await toggleIdCardsOrientation(targetEmail, targetStudentId);
  };

  const TOTAL_CARD_ROWS = Math.max(14, borrowedBooks.length);
  const cardTableRows = Array.from({ length: TOTAL_CARD_ROWS }, (_, index) => {
    const item = borrowedBooks[index];
    return {
      id: item?.id || `empty-row-${index}`,
      borrowDate: item?.pickupDate || item?.date || "",
      dueReturnDate: item?.returnDate || item?.date || "",
      bookTitle: item?.title || "",
      hasData: !!item,
    };
  });

  const handleLogout = async () => {
    if (Platform.OS === "web") {
      const confirmed = typeof window !== "undefined" && window.confirm
        ? window.confirm("Are you sure you want to sign out?")
        : true;
      if (confirmed) {
        try {
          await logout();
        } catch (e) {
          console.warn("Logout error:", e);
        }
        router.replace("/login");
      }
      return;
    }

    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              await logout();
            } catch (e) {
              console.warn("Logout error:", e);
            }
            router.replace("/login");
          },
        },
      ]
    );
  };

  const handleGuardedHeaderNav = (
    targetRoute:
      | "/notifications"
      | "/privacy-security"
      | "/terms-agreement"
      | "/help"
      | "/(tabs)"
  ) => {
    if (idCardsChecked && !hasUploadedSchoolId) {
      Alert.alert(
        "School ID Required",
        "Please click the button below your profile picture to upload your School ID (Front & Back) first.",
        [
          {
            text: "Upload School ID Now",
            onPress: openIdUploadModal,
          },
          {
            text: "Sign Out",
            style: "destructive",
            onPress: handleLogout,
          },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }
    router.push(targetRoute as any);
  };

  const systemSettingsOptions = [
    {
      id: "opt-1",
      title: "Notifications",
      detail: "Manage alerts and reminders",
      icon: "bell-outline",
      onPress: () => handleGuardedHeaderNav("/notifications"),
    },
    {
      id: "opt-2",
      title: "Privacy & Security",
      detail: "Library account privacy controls",
      icon: "lock-outline",
      onPress: () => handleGuardedHeaderNav("/privacy-security"),
    },
    {
      id: "opt-3",
      title: "Terms & Agreement",
      detail: "Policies, library rules & obligations",
      icon: "file-document-outline",
      onPress: () => handleGuardedHeaderNav("/terms-agreement"),
    },
    {
      id: "opt-4",
      title: "Help & Support",
      detail: "FAQs, user guides & assistant contact",
      icon: "help-circle-outline",
      onPress: () => handleGuardedHeaderNav("/help"),
    },
  ];

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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TouchableOpacity
              style={styles.notificationButtonRelative}
              onPress={() => handleGuardedHeaderNav("/(tabs)")}
              activeOpacity={0.7}
              accessibilityLabel="Back to Home"
            >
              <Ionicons
                name="arrow-back"
                size={22}
                color={isDarkMode ? theme.accentGold : theme.accentBlue}
              />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.headerTitle }]}>
              BOOKHIVE PROFILE
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TouchableOpacity
              style={styles.notificationButtonRelative}
              onPress={() => handleGuardedHeaderNav("/notifications")}
              activeOpacity={0.7}
            >
              <Ionicons
                name="notifications-outline"
                size={22}
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
        </View>

        {/* REQUIRED ID UPLOAD NOTICE FOR EXISTING ACCOUNTS WITHOUT SCHOOL ID */}
        {idCardsChecked && !hasUploadedSchoolId && (
          <View
            style={[
              styles.requiredIdBanner,
              {
                backgroundColor: isDarkMode ? "rgba(234, 179, 8, 0.14)" : "#FEF9C3",
                borderColor: isDarkMode ? "#FACC15" : "#EAB308",
              },
            ]}
          >
            <View style={styles.requiredIdBannerIconWrap}>
              <Ionicons
                name="alert-circle"
                size={22}
                color={isDarkMode ? "#FACC15" : "#B45309"}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.requiredIdBannerTitle,
                  { color: isDarkMode ? "#FACC15" : "#92400E" },
                ]}
              >
                Action Required: Upload Your School ID
              </Text>
              <Text
                style={[
                  styles.requiredIdBannerSub,
                  { color: isDarkMode ? "#E2E8F0" : "#78350F" },
                ]}
              >
                Your existing student account does not have your School ID pictures on file yet. Please click the button below your profile picture to upload your School ID (Front & Back).
              </Text>
            </View>
          </View>
        )}

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
              <TouchableOpacity
                onPress={() => {
                  if (hasValidAvatar) {
                    setPhotoViewerVisible(true);
                  } else {
                    setPhotoOptionsVisible(true);
                  }
                }}
                activeOpacity={0.85}
                style={styles.avatarTouchable}
              >
                {hasValidAvatar && !imageLoadError ? (
                  <Image
                    source={{
                      uri: currentAvatar,
                    }}
                    style={[
                      styles.avatar,
                      {
                        borderColor: isDarkMode ? theme.accentGold : "#0274BB",
                        borderWidth: 2.5,
                      }
                    ] as any}
                    onError={() => setImageLoadError(true)}
                  />
                ) : (
                  <View style={[
                    styles.avatar,
                    styles.avatarPlaceholder,
                    {
                      borderColor: isDarkMode ? theme.cardBorder : theme.badgeYellowBorder,
                      backgroundColor: isDarkMode ? "#172339" : theme.badgeYellowBg
                    }
                  ]}>
                    <Text style={{
                      fontSize: 34,
                      fontWeight: "900",
                      color: isDarkMode ? theme.accentGold : "#0274BB",
                    }}>
                      {studentFullName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}

                {/* Camera Badge Overlay */}
                <TouchableOpacity
                  onPress={() => setPhotoOptionsVisible(true)}
                  activeOpacity={0.8}
                  style={[
                    styles.cameraBadge,
                    {
                      backgroundColor: isDarkMode ? theme.accentGold : "#0274BB",
                      borderColor: theme.cardBg,
                    }
                  ]}
                >
                  <Ionicons
                    name="camera"
                    size={14}
                    color={isDarkMode ? "#080F1E" : "#FFFFFF"}
                  />
                </TouchableOpacity>
              </TouchableOpacity>

              {/* Tappable Text to Change Profile Picture */}
              <TouchableOpacity
                onPress={() => setPhotoOptionsVisible(true)}
                activeOpacity={0.7}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 14,
                  backgroundColor: isDarkMode ? "rgba(255, 215, 0, 0.12)" : "rgba(2, 116, 187, 0.08)",
                }}
              >
                <Ionicons
                  name={hasValidAvatar ? "camera-outline" : "add-circle-outline"}
                  size={14}
                  color={isDarkMode ? theme.accentGold : theme.accentBlue}
                  style={{ marginRight: 4 }}
                />
                <Text style={{
                  fontSize: 11.5,
                  fontWeight: "700",
                  color: isDarkMode ? theme.accentGold : theme.accentBlue,
                }}>
                  {hasValidAvatar ? "Change Photo" : "Add Profile Photo"}
                </Text>
              </TouchableOpacity>

              {/* BUTTON BELOW PROFILE PICTURE:
                  - For existing student accounts without School ID: Upload School ID (Front & Back) button
                  - After uploading: Shows School ID verified status */}
              {idCardsChecked && !hasUploadedSchoolId ? (
                <TouchableOpacity
                  onPress={openIdUploadModal}
                  activeOpacity={0.85}
                  style={[
                    styles.uploadIdButtonBelowAvatar,
                    {
                      backgroundColor: isDarkMode ? "#FACC15" : "#0274BB",
                      shadowColor: isDarkMode ? "#FACC15" : "#0274BB",
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Upload School ID Front and Back"
                >
                  <Ionicons
                    name="cloud-upload"
                    size={18}
                    color={isDarkMode ? "#080F1E" : "#FFFFFF"}
                  />
                  <View style={{ marginLeft: 8, alignItems: "flex-start" }}>
                    <Text
                      style={[
                        styles.uploadIdButtonText,
                        { color: isDarkMode ? "#080F1E" : "#FFFFFF" },
                      ]}
                    >
                      Upload School ID
                    </Text>
                    <Text
                      style={[
                        styles.uploadIdButtonSubtext,
                        {
                          color: isDarkMode
                            ? "rgba(8, 15, 30, 0.78)"
                            : "rgba(255, 255, 255, 0.88)",
                        },
                      ]}
                    >
                      Required • Front & Back (2 Photos)
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.uploadIdReqBadge,
                      {
                        backgroundColor: isDarkMode ? "#080F1E" : "#FACC15",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 9.5,
                        fontWeight: "900",
                        color: isDarkMode ? "#FACC15" : "#080F1E",
                      }}
                    >
                      REQUIRED
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : null}

              <Text style={[styles.name, { color: theme.textPrimary }]}>
                {studentFullName}
              </Text>

              <Text style={[styles.course, { color: theme.textSecondary }]}>
                {studentCourse}
              </Text>

              <View style={[styles.idBadge, { backgroundColor: isDarkMode ? theme.background : theme.badgeYellowBg, borderColor: isDarkMode ? theme.cardBorder : theme.badgeYellowBorder }]}>
                <Text style={[styles.idText, { color: isDarkMode ? theme.accentGold : theme.badgeYellowText, fontWeight: "800" }]}>
                  STUDENT ID: {studentIdNumber}
                </Text>
              </View>

              {/* COLLAPSIBLE 4-ID DISPLAY SECTION (SHOWS WHEN ID ICON CLICKED, DISAPPEARS WHEN CLICKED AGAIN) */}
              {showIdCards && (
                <View
                  style={[
                    styles.inlineIdSection,
                    {
                      backgroundColor: isDarkMode ? "#0B132B" : "#F8FAFC",
                      borderColor: isDarkMode ? "#1E2A42" : "#CBD5E1",
                    },
                  ]}
                >
                  <View style={styles.inlineIdHeader}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons
                        name="id-card"
                        size={19}
                        color={isDarkMode ? theme.accentGold : "#0274BB"}
                      />
                      <Text style={[styles.inlineIdTitle, { color: theme.textPrimary }]}>
                        Official Student & Library IDs
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setShowIdCards(false)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      accessibilityLabel="Close ID section"
                    >
                      <Ionicons name="close-circle" size={22} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.inlineIdSubtext, { color: theme.textSecondary }]}>
                    Tap any ID photo to view full size. Click the ID icon above or the close button to hide this section.
                  </Text>

                  {/* 1. SCHOOL ID (FRONT & BACK) */}
                  <View style={styles.inlineIdGroup}>
                    <View style={styles.inlineIdGroupHeader}>
                      <Ionicons
                        name="school"
                        size={15}
                        color={isDarkMode ? theme.accentGold : "#0274BB"}
                      />
                      <Text
                        style={[
                          styles.inlineIdGroupTitle,
                          { color: isDarkMode ? theme.accentGold : "#0274BB" },
                        ]}
                      >
                        SCHOOL ID (FRONT & BACK)
                      </Text>
                    </View>

                    <View style={styles.inlineIdPhotosRow}>
                      {/* School ID Front */}
                      <TouchableOpacity
                        style={[
                          styles.inlineIdPhotoCard,
                          {
                            height: isProfileIdPortrait ? 200 : 125,
                            borderColor: isDarkMode ? "#1E2A42" : "#E2E8F0",
                          },
                        ]}
                        activeOpacity={0.85}
                        onPress={() => {
                          if (uploadedIdCards?.schoolIdFront) {
                            setEnlargedIdPhoto({
                              title: "School ID — Front",
                              uri: uploadedIdCards.schoolIdFront,
                              slotKey: "schoolIdFront",
                              rotation: uploadedIdCards?.rotations?.schoolIdFront || 0,
                              orientation: uploadedIdCards?.orientation || idCaptureOrientation || "portrait",
                            });
                          }
                        }}
                      >
                        {uploadedIdCards?.schoolIdFront ? (
                          <Image
                            source={{ uri: uploadedIdCards.schoolIdFront }}
                            style={[
                              styles.inlineIdImage,
                              Boolean(uploadedIdCards?.rotations?.schoolIdFront)
                                ? { transform: [{ rotate: `${uploadedIdCards?.rotations?.schoolIdFront}deg` }] }
                                : null,
                            ]}
                            resizeMode="contain"
                          />
                        ) : (
                          <View style={styles.inlineIdEmptySlot}>
                            <Ionicons name="image-outline" size={24} color="#94A3B8" />
                            <Text style={styles.inlineIdEmptyText}>Front Missing</Text>
                          </View>
                        )}
                        <View style={styles.inlineIdBadgePill}>
                          <Text style={styles.inlineIdBadgeText}>FRONT</Text>
                        </View>
                      </TouchableOpacity>

                      {/* School ID Back */}
                      <TouchableOpacity
                        style={[
                          styles.inlineIdPhotoCard,
                          {
                            height: isProfileIdPortrait ? 200 : 125,
                            borderColor: isDarkMode ? "#1E2A42" : "#E2E8F0",
                          },
                        ]}
                        activeOpacity={0.85}
                        onPress={() => {
                          if (uploadedIdCards?.schoolIdBack) {
                            setEnlargedIdPhoto({
                              title: "School ID — Back",
                              uri: uploadedIdCards.schoolIdBack,
                              slotKey: "schoolIdBack",
                              rotation: uploadedIdCards?.rotations?.schoolIdBack || 0,
                              orientation: uploadedIdCards?.orientation || idCaptureOrientation || "portrait",
                            });
                          }
                        }}
                      >
                        {uploadedIdCards?.schoolIdBack ? (
                          <Image
                            source={{ uri: uploadedIdCards.schoolIdBack }}
                            style={[
                              styles.inlineIdImage,
                              Boolean(uploadedIdCards?.rotations?.schoolIdBack)
                                ? { transform: [{ rotate: `${uploadedIdCards?.rotations?.schoolIdBack}deg` }] }
                                : null,
                            ]}
                            resizeMode="contain"
                          />
                        ) : (
                          <View style={styles.inlineIdEmptySlot}>
                            <Ionicons name="image-outline" size={24} color="#94A3B8" />
                            <Text style={styles.inlineIdEmptyText}>Back Missing</Text>
                          </View>
                        )}
                        <View style={styles.inlineIdBadgePill}>
                          <Text style={styles.inlineIdBadgeText}>BACK</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* ACTION BUTTON TO RETAKE / UPDATE */}
                  <TouchableOpacity
                    style={[
                      styles.inlineIdRetakeBtn,
                      {
                        backgroundColor: isDarkMode
                          ? "rgba(255, 200, 0, 0.12)"
                          : "rgba(2, 116, 187, 0.08)",
                        borderColor: isDarkMode ? theme.accentGold : "#0274BB",
                      },
                    ]}
                    onPress={openIdUploadModal}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="refresh"
                      size={15}
                      color={isDarkMode ? theme.accentGold : "#0274BB"}
                    />
                    <Text
                      style={[
                        styles.inlineIdRetakeText,
                        { color: isDarkMode ? theme.accentGold : "#0274BB" },
                      ]}
                    >
                      Update / Retake ID Photos
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* STATS SUMMARY CARDS */}
            <View style={styles.statsRow}>
              <View style={[
                styles.statCard,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: theme.cardBorder,
                  borderTopColor: isDarkMode ? theme.cardBorder : theme.accentGold,
                  borderTopWidth: isDarkMode ? 1 : 2.5,
                  shadowColor: theme.shadowColor,
                  shadowOpacity: isDarkMode ? 0.3 : 0.05,
                }
              ]}>
                <Text style={[styles.statNumber, { color: isDarkMode ? theme.accentGold : theme.accentBlue }]}>
                  {activeReservationsCount}
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
                  borderTopColor: isDarkMode ? theme.cardBorder : theme.accentBlue,
                  borderTopWidth: isDarkMode ? 1 : 2.5,
                  shadowColor: theme.shadowColor,
                  shadowOpacity: isDarkMode ? 0.3 : 0.05,
                }
              ]}>
                <Text style={[styles.statNumber, { color: isDarkMode ? theme.accentGold : theme.accentBlue }]}>
                  {borrowedBooks.length}
                </Text>

                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Borrowed Books
                </Text>
              </View>
            </View>

            {/* ACCOUNT INFORMATION SECTION */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: isDarkMode ? theme.accentGold : theme.accentBlue }]}>
                Account Information
              </Text>
            </View>

            <View style={[
              styles.accountInfoCard,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.cardBorder,
                shadowColor: theme.shadowColor,
                shadowOpacity: isDarkMode ? 0.3 : 0.05,
              }
            ]}>
              {/* RESTRICTED / SUPER ADMIN BADGE */}
              <View style={[
                styles.adminNoticeBanner,
                {
                  backgroundColor: isDarkMode ? "rgba(234, 179, 8, 0.08)" : theme.badgeYellowBg,
                  borderColor: isDarkMode ? "rgba(234, 179, 8, 0.25)" : theme.badgeYellowBorder,
                }
              ]}>
                <Ionicons name="lock-closed" size={15} color={isDarkMode ? theme.accentGold : theme.badgeYellowText} />
                <Text style={[styles.adminNoticeText, { color: isDarkMode ? theme.textSecondary : theme.badgeYellowText, fontWeight: "700" }]}>
                  Official student record. Only Super Admin has authority to edit account details.
                </Text>
              </View>

              {/* 1. Full Name */}
              <View style={[styles.infoRow, { borderBottomColor: theme.cardBorder }]}>
                <View style={[styles.infoIconWrapper, { backgroundColor: isDarkMode ? "#0E1726" : "rgba(2, 116, 187, 0.08)" }]}>
                  <Ionicons name="person-outline" size={18} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Full Name</Text>
                  <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{studentFullName}</Text>
                </View>
              </View>

              {/* 2. Student ID */}
              <View style={[styles.infoRow, { borderBottomColor: theme.cardBorder }]}>
                <View style={[styles.infoIconWrapper, { backgroundColor: isDarkMode ? "#0E1726" : "rgba(2, 116, 187, 0.08)" }]}>
                  <Ionicons name="card-outline" size={18} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Student ID</Text>
                  <Text style={[styles.infoValue, { color: isDarkMode ? theme.accentGold : theme.accentBlue, fontWeight: "700" }]}>{studentIdNumber}</Text>
                </View>
              </View>

              {/* 3. University Email */}
              <View style={[styles.infoRow, { borderBottomColor: theme.cardBorder }]}>
                <View style={[styles.infoIconWrapper, { backgroundColor: isDarkMode ? "#0E1726" : "rgba(2, 116, 187, 0.08)" }]}>
                  <Ionicons name="mail-outline" size={18} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>University Email</Text>
                  <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{studentEmail}</Text>
                </View>
              </View>

              {/* 4. Department */}
              <View style={[styles.infoRow, { borderBottomColor: theme.cardBorder }]}>
                <View style={[styles.infoIconWrapper, { backgroundColor: isDarkMode ? "#0E1726" : "rgba(2, 116, 187, 0.08)" }]}>
                  <Ionicons name="business-outline" size={18} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Department</Text>
                  <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{getDepartmentFullName(studentDepartment)}</Text>
                </View>
              </View>

              {/* 5. Course / Program */}
              <View style={[styles.infoRow, { borderBottomColor: theme.cardBorder }]}>
                <View style={[styles.infoIconWrapper, { backgroundColor: isDarkMode ? "#0E1726" : "rgba(2, 116, 187, 0.08)" }]}>
                  <Ionicons name="school-outline" size={18} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Course / Program</Text>
                  <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{getCourseDisplay(studentCourse)}</Text>
                </View>
              </View>

              {/* 6. Year Level & Section */}
              <View style={[styles.infoRow, { borderBottomColor: theme.cardBorder }]}>
                <View style={[styles.infoIconWrapper, { backgroundColor: isDarkMode ? "#0E1726" : "rgba(2, 116, 187, 0.08)" }]}>
                  <Ionicons name="layers-outline" size={18} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Year Level & Section</Text>
                  <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{studentYearSection}</Text>
                </View>
              </View>

              {/* 7. Status & Role */}
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <View style={[styles.infoIconWrapper, { backgroundColor: isDarkMode ? "#0E1726" : "rgba(2, 116, 187, 0.08)" }]}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#10B981" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Account Status & Role</Text>
                  <View style={styles.statusBadge}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>{studentStatus} • {studentRole}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* LIBRARY VIOLATIONS SECTION */}
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={[styles.sectionTitle, { color: isDarkMode ? theme.accentGold : theme.accentBlue }]}>
                  Library Violations
                </Text>
                {allViolations.length > 0 ? (
                  <View style={[styles.violationCountBadge, { backgroundColor: theme.statusDanger }]}>
                    <Text style={styles.violationCountText}>
                      {activeViolations.length > 0 ? `${activeViolations.length} Active` : `${allViolations.length} Total`}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.violationCountBadge, { backgroundColor: theme.statusSuccessBg, borderWidth: 1, borderColor: theme.statusSuccess }]}>
                    <Text style={[styles.violationCountText, { color: theme.statusSuccess }]}>
                      Clear
                    </Text>
                  </View>
                )}
              </View>

              {activeViolations.length > 0 && totalPenalty > 0 && (
                <Text style={{ fontSize: 13, fontWeight: "800", color: theme.statusDanger }}>
                  Fine: ₱{totalPenalty.toFixed(2)}
                </Text>
              )}
            </View>

            <View style={[
              styles.accountInfoCard,
              {
                backgroundColor: theme.cardBg,
                borderColor: activeViolations.length > 0
                  ? (isDarkMode ? "rgba(239, 68, 68, 0.35)" : "rgba(239, 68, 68, 0.25)")
                  : theme.cardBorder,
                shadowColor: theme.shadowColor,
                shadowOpacity: isDarkMode ? 0.3 : 0.05,
              }
            ]}>
              {allViolations.length > 0 ? (
                <>
                  {/* Tab Selector: Active Penalties vs All Records */}
                  <View style={[styles.tabSelectorContainer, { backgroundColor: isDarkMode ? "#0B1528" : "#F1F5F9", borderColor: theme.cardBorder }]}>
                    <TouchableOpacity
                      style={[
                        styles.tabSelectorButton,
                        violationTab === "active" && [
                          styles.tabSelectorButtonActive,
                          { backgroundColor: isDarkMode ? "#EF4444" : "#DC2626" }
                        ]
                      ]}
                      onPress={() => setViolationTab("active")}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="alert-circle"
                        size={14}
                        color={violationTab === "active" ? "#FFFFFF" : (isDarkMode ? theme.textSecondary : "#64748B")}
                      />
                      <Text
                        style={[
                          styles.tabSelectorText,
                          { color: violationTab === "active" ? "#FFFFFF" : (isDarkMode ? theme.textSecondary : "#64748B") },
                          violationTab === "active" && { fontWeight: "700" }
                        ]}
                      >
                        Active ({activeViolations.length})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.tabSelectorButton,
                        violationTab === "all" && [
                          styles.tabSelectorButtonActive,
                          { backgroundColor: isDarkMode ? theme.accentGold : theme.accentBlue }
                        ]
                      ]}
                      onPress={() => setViolationTab("all")}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="list-outline"
                        size={14}
                        color={violationTab === "all" ? (isDarkMode ? "#0B1A2C" : "#FFFFFF") : (isDarkMode ? theme.textSecondary : "#64748B")}
                      />
                      <Text
                        style={[
                          styles.tabSelectorText,
                          { color: violationTab === "all" ? (isDarkMode ? "#0B1A2C" : "#FFFFFF") : (isDarkMode ? theme.textSecondary : "#64748B") },
                          violationTab === "all" && { fontWeight: "700" }
                        ]}
                      >
                        All History ({allViolations.length})
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Warning Notice Banner */}
                  {activeViolations.length > 0 && (
                    <View style={[
                      styles.adminNoticeBanner,
                      {
                        backgroundColor: isDarkMode ? "rgba(239, 68, 68, 0.12)" : "#FEF2F2",
                        borderColor: isDarkMode ? "rgba(239, 68, 68, 0.3)" : "#FCA5A5",
                      }
                    ]}>
                      <Ionicons name="alert-circle" size={16} color="#EF4444" />
                      <Text style={[styles.adminNoticeText, { color: isDarkMode ? "#FCA5A5" : "#B91C1C", fontWeight: "600" }]}>
                        {activeViolations.length === 1
                          ? "You have 1 active overdue loan. Please settle your record at the circulation desk."
                          : `You have ${activeViolations.length} active violations. Please settle your records at the circulation desk.`}
                      </Text>
                    </View>
                  )}

                  {/* Violation Items List */}
                  {displayedViolations.length === 0 ? (
                    <View style={{ paddingVertical: 18, alignItems: "center" }}>
                      <Text style={{ fontSize: 13, color: theme.textSecondary, fontWeight: "500" }}>
                        No records under this filter.
                      </Text>
                    </View>
                  ) : (
                    displayedViolations.map((v, vIdx) => {
                      const isLast = vIdx === displayedViolations.length - 1;
                      const isSettled = (v.status || "").toLowerCase().includes("settled") || (v.status || "").toLowerCase().includes("cleared");

                      return (
                        <View
                          key={v.id ? `viol-item-${v.id}` : `viol-item-${vIdx}`}
                          style={[
                            styles.violationItemCard,
                            {
                              backgroundColor: isSettled
                                ? (isDarkMode ? "#0F1A2A" : "#F8FAFC")
                                : (isDarkMode ? "rgba(239, 68, 68, 0.08)" : "#FFF5F5"),
                              borderColor: isSettled
                                ? theme.cardBorder
                                : (isDarkMode ? "rgba(239, 68, 68, 0.25)" : "#FEE2E2"),
                              marginBottom: isLast ? 0 : 10,
                            }
                          ]}
                        >
                          <View style={styles.violationTopRow}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <MaterialCommunityIcons
                                  name="shield-alert-outline"
                                  size={16}
                                  color={isSettled ? "#10B981" : "#EF4444"}
                                />
                                <Text
                                  style={[
                                    styles.violationItemType,
                                    isSettled && { color: "#10B981" }
                                  ]}
                                >
                                  {v.violationType || "Overdue Book Return"}
                                </Text>
                              </View>
                              {v.bookTitle ? (
                                <Text
                                  style={[
                                    styles.violationBookTitle,
                                    { color: theme.textPrimary }
                                  ]}
                                >
                                  Book: {v.bookTitle}
                                </Text>
                              ) : null}
                            </View>

                            <View
                              style={[
                                styles.penaltyBadge,
                                isSettled && { backgroundColor: "rgba(16, 185, 129, 0.15)", borderWidth: 1, borderColor: "rgba(16, 185, 129, 0.4)" }
                              ]}
                            >
                              <Text
                                style={[
                                  styles.penaltyBadgeText,
                                  isSettled && { color: "#10B981" }
                                ]}
                              >
                                {Number(v.penaltyAmount) > 0 ? `₱${Number(v.penaltyAmount).toFixed(2)} Fine` : v.status}
                              </Text>
                            </View>
                          </View>

                          {v.remarks ? (
                            <Text
                              style={[
                                styles.violationRemarks,
                                { color: isSettled ? theme.textSecondary : (isDarkMode ? "#FCA5A5" : "#991B1B") }
                              ]}
                            >
                              {v.remarks}
                            </Text>
                          ) : null}

                          {v.date ? (
                            <Text style={[styles.violationDate, { color: theme.textMuted }]}>
                              Due Date / Recorded: {v.date}
                            </Text>
                          ) : null}
                        </View>
                      );
                    })
                  )}
                </>
              ) : (
                /* CLEAN RECORD VIEW */
                <View style={styles.clearViolationCard}>
                  <Ionicons name="checkmark-circle-outline" size={42} color="#10B981" />
                  <Text style={[styles.clearStatusTitle, { color: theme.textPrimary }]}>
                    No Active Violations
                  </Text>
                  <Text style={[styles.clearStatusSubtitle, { color: theme.textSecondary }]}>
                    Your account is in good standing with zero overdue penalties or disciplinary records in the library.
                  </Text>
                  <View style={[styles.cleanRecordPill, { backgroundColor: theme.statusSuccessBg, borderColor: theme.statusSuccess }]}>
                    <Ionicons name="shield-checkmark-outline" size={13} color="#10B981" />
                    <Text style={[styles.cleanRecordPillText, { color: theme.statusSuccess }]}>
                      Clear Standing • Eligible to Borrow
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* SYSTEM SETTINGS SECTION (Moved from settings.tsx into Profile Page) */}
            <View style={styles.settingsSectionWrap}>
              <Text style={[styles.settingsGroupTitle, { color: theme.textSecondary }]}>
                GENERAL SETTINGS
              </Text>

              {systemSettingsOptions.map((option, idx) => (
                <TouchableOpacity
                  key={`opt-${option.id}-${idx}`}
                  style={[
                    styles.sysSettingsCard,
                    { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
                  ]}
                  onPress={option.onPress}
                  activeOpacity={0.85}
                >
                  <View style={styles.settingsCardLeft}>
                    <View
                      style={[
                        styles.settingsIconWrapper,
                        { backgroundColor: theme.background, borderColor: theme.cardBorder },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={option.icon as any}
                        size={20}
                        color={isDarkMode ? theme.accentGold : theme.accentBlue}
                      />
                    </View>
                    <View style={styles.settingsCardTexts}>
                      <Text style={[styles.settingsCardTitle, { color: theme.textPrimary }]}>
                        {option.title}
                      </Text>
                      <Text style={[styles.settingsCardDetail, { color: theme.textSecondary }]}>
                        {option.detail}
                      </Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              ))}

              {/* TOGGLE ROW: PUSH NOTIFICATIONS */}
              <View
                style={[
                  styles.settingsToggleCard,
                  { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
                ]}
              >
                <View style={styles.settingsCardLeft}>
                  <View
                    style={[
                      styles.settingsIconWrapper,
                      { backgroundColor: theme.background, borderColor: theme.cardBorder },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="bell-ring-outline"
                      size={20}
                      color={isDarkMode ? theme.accentGold : theme.accentBlue}
                    />
                  </View>
                  <View style={styles.settingsCardTexts}>
                    <Text style={[styles.settingsCardTitle, { color: theme.textPrimary }]}>
                      Push Notifications
                    </Text>
                    <Text style={[styles.settingsCardDetail, { color: theme.textSecondary }]}>
                      Receive real-time reservation updates
                    </Text>
                  </View>
                </View>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{
                    false: theme.cardBorder,
                    true: isDarkMode ? theme.accentGold : theme.accentBlue,
                  }}
                  thumbColor={
                    notificationsEnabled
                      ? isDarkMode
                        ? theme.accentGold
                        : theme.accentBlue
                      : "#64748B"
                  }
                  ios_backgroundColor={theme.cardBorder}
                />
              </View>

              {/* TOGGLE ROW: SYSTEM THEME (DARK MODE) */}
              <View
                style={[
                  styles.settingsToggleCard,
                  { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
                ]}
              >
                <View style={styles.settingsCardLeft}>
                  <View
                    style={[
                      styles.settingsIconWrapper,
                      { backgroundColor: theme.background, borderColor: theme.cardBorder },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="theme-light-dark"
                      size={20}
                      color={isDarkMode ? theme.accentGold : theme.accentBlue}
                    />
                  </View>
                  <View style={styles.settingsCardTexts}>
                    <Text style={[styles.settingsCardTitle, { color: theme.textPrimary }]}>
                      Dark Mode
                    </Text>
                    <Text style={[styles.settingsCardDetail, { color: theme.textSecondary }]}>
                      Toggle dark / light display appearance
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isDarkMode}
                  onValueChange={toggleTheme}
                  trackColor={{
                    false: theme.cardBorder,
                    true: isDarkMode ? theme.accentGold : theme.accentBlue,
                  }}
                  thumbColor={isDarkMode ? theme.accentGold : "#64748B"}
                  ios_backgroundColor={theme.cardBorder}
                />
              </View>

              {/* ACCOUNT & SESSION GROUP */}
              <Text
                style={[
                  styles.settingsGroupTitle,
                  { color: theme.textSecondary, marginTop: 12 },
                ]}
              >
                ACCOUNT & SESSION
              </Text>

              <TouchableOpacity
                style={[
                  styles.sysSettingsCard,
                  {
                    backgroundColor: theme.cardBg,
                    borderColor: isDarkMode ? "rgba(239, 68, 68, 0.35)" : "#FEE2E2",
                  },
                ]}
                onPress={handleLogout}
                activeOpacity={0.85}
              >
                <View style={styles.settingsCardLeft}>
                  <View
                    style={[
                      styles.settingsIconWrapper,
                      {
                        backgroundColor: isDarkMode
                          ? "rgba(239, 68, 68, 0.15)"
                          : "#FEF2F2",
                        borderColor: isDarkMode
                          ? "rgba(239, 68, 68, 0.3)"
                          : "#FCA5A5",
                      },
                    ]}
                  >
                    <MaterialCommunityIcons name="logout" size={20} color="#EF4444" />
                  </View>
                  <View style={styles.settingsCardTexts}>
                    <Text style={[styles.settingsCardTitle, { color: "#EF4444" }]}>
                      Sign Out
                    </Text>
                    <Text style={[styles.settingsCardDetail, { color: theme.textSecondary }]}>
                      Log out of your student account session
                    </Text>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
      </ScrollView>

      {/* 1. WHITE CONTAINER: PROFILE PICTURE OPTIONS MODAL */}
      <Modal
        visible={photoOptionsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoOptionsVisible(false)}
      >
        <View style={styles.whiteModalOverlay}>
          <TouchableOpacity
            style={styles.whiteModalBackdrop}
            activeOpacity={1}
            onPress={() => setPhotoOptionsVisible(false)}
          />
          <View style={styles.whiteContainerCard}>
            {/* Header: Title & Close/Back Icon */}
            <View style={styles.whiteContainerHeader}>
              <Text style={styles.whiteContainerTitle}>Profile Picture</Text>
              <TouchableOpacity
                onPress={() => setPhotoOptionsVisible(false)}
                style={styles.whiteContainerCloseIcon}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.whiteContainerDescription}>
              Update your profile photo. It is displayed on your official digital Library Card when scanned by librarians or other students.
            </Text>

            {/* Actions list */}
            <View style={styles.whiteContainerButtons}>
              {hasValidAvatar && (
                <TouchableOpacity
                  style={styles.whiteActionBtn}
                  onPress={() => {
                    setPhotoOptionsVisible(false);
                    setPhotoViewerVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="eye-outline" size={18} color="#0274BB" style={styles.whiteActionIcon} />
                  <Text style={styles.whiteActionBtnText}>VIEW PROFILE PHOTO</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.whiteActionBtn}
                onPress={() => {
                  setPhotoOptionsVisible(false);
                  handlePickFromGallery();
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="images-outline" size={18} color="#0274BB" style={styles.whiteActionIcon} />
                <Text style={styles.whiteActionBtnText}>CHOOSE FROM GALLERY</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.whiteActionBtn}
                onPress={() => {
                  setPhotoOptionsVisible(false);
                  handleTakePhoto();
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="camera-outline" size={18} color="#0274BB" style={styles.whiteActionIcon} />
                <Text style={styles.whiteActionBtnText}>TAKE PHOTO (CAMERA)</Text>
              </TouchableOpacity>

              {hasValidAvatar && (
                <TouchableOpacity
                  style={styles.whiteActionBtn}
                  onPress={() => {
                    setPhotoOptionsVisible(false);
                    Alert.alert(
                      "Remove Photo",
                      "Are you sure you want to remove your profile photo?",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Remove",
                          style: "destructive",
                          onPress: () => applyProfilePhoto(null),
                        },
                      ]
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" style={styles.whiteActionIcon} />
                  <Text style={[styles.whiteActionBtnText, { color: "#EF4444" }]}>REMOVE PHOTO</Text>
                </TouchableOpacity>
              )}

              {/* Dedicated Back Button in White Container */}
              <TouchableOpacity
                style={styles.whiteBackBtn}
                onPress={() => setPhotoOptionsVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back-outline" size={18} color="#0274BB" style={styles.whiteActionIcon} />
                <Text style={styles.whiteBackBtnText}>BACK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 2. FULLSCREEN PROFILE PICTURE VIEWER MODAL */}
      <Modal
        visible={photoViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoViewerVisible(false)}
      >
        <View style={styles.viewerBackdrop}>
          {/* Top Header */}
          <View style={[styles.viewerHeader, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity
              onPress={() => setPhotoViewerVisible(false)}
              style={styles.viewerBackBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              <Text style={styles.viewerBackBtnText}>Back</Text>
            </TouchableOpacity>

            <Text style={styles.viewerHeaderTitle}>Profile Photo</Text>

            <TouchableOpacity
              onPress={() => {
                setPhotoViewerVisible(false);
                setPhotoOptionsVisible(true);
              }}
              style={styles.viewerCameraBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="camera-outline" size={22} color={theme.accentGold} />
            </TouchableOpacity>
          </View>

          {/* Center Image Area */}
          <View style={styles.viewerBody}>
            {hasValidAvatar && !imageLoadError ? (
              <Image
                source={{ uri: currentAvatar }}
                style={styles.viewerLargeImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.viewerLargePlaceholder}>
                <Text style={styles.viewerLargePlaceholderInitial}>
                  {studentFullName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            {/* Student Card Info Below Photo */}
            <View style={styles.viewerCardInfo}>
              <Text style={styles.viewerStudentFullName}>{studentFullName}</Text>
              <Text style={styles.viewerStudentIdText}>Student ID: {studentIdNumber}</Text>
              <Text style={styles.viewerStudentCourseText}>{studentCourseSection}</Text>
              <View style={styles.viewerVerifiedRow}>
                <Ionicons name="checkmark-circle" size={15} color="#10B981" />
                <Text style={styles.viewerVerifiedText}>Official Library Card Photo</Text>
              </View>
            </View>
          </View>

          {/* Bottom Bar Buttons */}
          <View style={[styles.viewerBottomContainer, { paddingBottom: insets.bottom + 20 }]}>
            <TouchableOpacity
              style={[styles.viewerBottomActionBtn, { backgroundColor: isDarkMode ? theme.accentGold : "#0274BB" }]}
              onPress={() => {
                setPhotoViewerVisible(false);
                setPhotoOptionsVisible(true);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="camera" size={18} color={isDarkMode ? "#080F1E" : "#FFFFFF"} style={{ marginRight: 8 }} />
              <Text style={[styles.viewerBottomActionText, { color: isDarkMode ? "#080F1E" : "#FFFFFF" }]}>
                Change Photo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.viewerBottomCloseBtn}
              onPress={() => setPhotoViewerVisible(false)}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.viewerBottomCloseText}>Back to Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 3. UPLOAD SCHOOL ID (FRONT & BACK) & LIBRARY ID (FRONT & BACK) MODAL */}
      <Modal
        visible={idUploadModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIdUploadModalVisible(false)}
      >
        <View style={styles.idModalOverlay}>
          <View
            style={[
              styles.idModalContainer,
              {
                backgroundColor: isDarkMode ? "#0F172A" : "#FFFFFF",
                borderColor: isDarkMode ? "#1E293B" : "#E2E8F0",
                paddingBottom: Math.max(20, insets.bottom + 12),
              },
            ]}
          >
            {/* Modal Header */}
            <View
              style={[
                styles.idModalHeader,
                { borderBottomColor: isDarkMode ? "#1E293B" : "#E2E8F0" },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <View
                  style={[
                    styles.idModalHeaderIcon,
                    { backgroundColor: isDarkMode ? "rgba(250, 204, 21, 0.15)" : "rgba(2, 116, 187, 0.1)" },
                  ]}
                >
                  <Ionicons
                    name="id-card"
                    size={22}
                    color={isDarkMode ? "#FACC15" : "#0274BB"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.idModalTitle,
                      { color: isDarkMode ? "#F8FAFC" : "#0F172A" },
                    ]}
                  >
                    Upload School & Library ID
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: isDarkMode ? "#94A3B8" : "#64748B",
                      marginTop: 2,
                    }}
                  >
                    Upload Front & Back of both IDs (4 pictures total)
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.idProgressPill,
                  {
                    backgroundColor:
                      [draftSchoolFront, draftSchoolBack, draftLibraryFront, draftLibraryBack].filter(Boolean)
                        .length === 4
                        ? "rgba(16, 185, 129, 0.16)"
                        : isDarkMode
                        ? "rgba(250, 204, 21, 0.15)"
                        : "rgba(2, 116, 187, 0.1)",
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 11.5,
                    fontWeight: "800",
                    color:
                      [draftSchoolFront, draftSchoolBack, draftLibraryFront, draftLibraryBack].filter(Boolean)
                        .length === 4
                        ? "#10B981"
                        : isDarkMode
                        ? "#FACC15"
                        : "#0274BB",
                  }}
                >
                  {[draftSchoolFront, draftSchoolBack, draftLibraryFront, draftLibraryBack].filter(Boolean).length}/4 Ready
                </Text>
              </View>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 18, paddingBottom: 24 }}
            >
              {/* PORTRAIT / LANDSCAPE ORIENTATION SELECTOR */}
              <View
                style={{
                  backgroundColor: isDarkMode ? "#111C33" : "#F1F5F9",
                  borderRadius: 14,
                  padding: 10,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: isDarkMode ? "#263554" : "#CBD5E1",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons
                      name="crop-outline"
                      size={15}
                      color={isDarkMode ? "#FACC15" : "#0274BB"}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "800",
                        color: isDarkMode ? "#F8FAFC" : "#0F172A",
                      }}
                    >
                      ID Capture Orientation
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 10.5,
                      fontWeight: "600",
                      color: isDarkMode ? "#94A3B8" : "#64748B",
                    }}
                  >
                    {idCaptureOrientation === "portrait"
                      ? "Vertical (10:16)"
                      : "Horizontal (16:10)"}
                  </Text>
                </View>

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setIdCaptureOrientation("portrait")}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      paddingVertical: 9,
                      borderRadius: 10,
                      borderWidth: 1.5,
                      backgroundColor:
                        idCaptureOrientation === "portrait"
                          ? isDarkMode
                            ? "rgba(250, 204, 21, 0.16)"
                            : "rgba(2, 116, 187, 0.12)"
                          : isDarkMode
                          ? "#1E293B"
                          : "#FFFFFF",
                      borderColor:
                        idCaptureOrientation === "portrait"
                          ? isDarkMode
                            ? "#FACC15"
                            : "#0274BB"
                          : isDarkMode
                          ? "#334155"
                          : "#CBD5E1",
                    }}
                  >
                    <Ionicons
                      name="phone-portrait-outline"
                      size={15}
                      color={
                        idCaptureOrientation === "portrait"
                          ? isDarkMode
                            ? "#FACC15"
                            : "#0274BB"
                          : isDarkMode
                          ? "#94A3B8"
                          : "#64748B"
                      }
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "800",
                        color:
                          idCaptureOrientation === "portrait"
                            ? isDarkMode
                              ? "#FACC15"
                              : "#0274BB"
                            : isDarkMode
                            ? "#CBD5E1"
                            : "#475569",
                      }}
                    >
                      Portrait (Vertical)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setIdCaptureOrientation("landscape")}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      paddingVertical: 9,
                      borderRadius: 10,
                      borderWidth: 1.5,
                      backgroundColor:
                        idCaptureOrientation === "landscape"
                          ? isDarkMode
                            ? "rgba(250, 204, 21, 0.16)"
                            : "rgba(2, 116, 187, 0.12)"
                          : isDarkMode
                          ? "#1E293B"
                          : "#FFFFFF",
                      borderColor:
                        idCaptureOrientation === "landscape"
                          ? isDarkMode
                            ? "#FACC15"
                            : "#0274BB"
                          : isDarkMode
                          ? "#334155"
                          : "#CBD5E1",
                    }}
                  >
                    <Ionicons
                      name="phone-landscape-outline"
                      size={15}
                      color={
                        idCaptureOrientation === "landscape"
                          ? isDarkMode
                            ? "#FACC15"
                            : "#0274BB"
                          : isDarkMode
                          ? "#94A3B8"
                          : "#64748B"
                      }
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "800",
                        color:
                          idCaptureOrientation === "landscape"
                            ? isDarkMode
                              ? "#FACC15"
                              : "#0274BB"
                            : isDarkMode
                            ? "#CBD5E1"
                            : "#475569",
                      }}
                    >
                      Landscape (Horizontal)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* SECTION 1: SCHOOL ID */}
              <View style={styles.idSectionHeaderRow}>
                <Ionicons
                  name="school-outline"
                  size={17}
                  color={isDarkMode ? "#FACC15" : "#0274BB"}
                />
                <Text
                  style={[
                    styles.idSectionHeading,
                    { color: isDarkMode ? "#FACC15" : "#0274BB" },
                  ]}
                >
                  School ID (Front & Back)
                </Text>
              </View>

              <View style={styles.idSlotsGrid}>
                {/* School ID Front */}
                <View
                  style={[
                    styles.idSlotCard,
                    {
                      backgroundColor: isDarkMode ? "#111C33" : "#F8FAFC",
                      borderColor: draftSchoolFront
                        ? "#10B981"
                        : isDarkMode
                        ? "#263554"
                        : "#CBD5E1",
                    },
                  ]}
                >
                  <View style={styles.idSlotLabelRow}>
                    <Text
                      style={[
                        styles.idSlotLabel,
                        { color: isDarkMode ? "#E2E8F0" : "#1E293B" },
                      ]}
                    >
                      School ID • Front
                    </Text>
                    {draftSchoolFront ? (
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    ) : null}
                  </View>

                  {draftSchoolFront ? (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() =>
                        promptSlotSource("School ID (Front)", setDraftSchoolFront, "schoolFront")
                      }
                      style={styles.idPreviewWrap}
                    >
                      <Image
                        source={{ uri: draftSchoolFront }}
                        style={styles.idPreviewImage}
                        resizeMode="contain"
                      />
                      <View style={styles.idRetakeOverlay}>
                        <Ionicons name="camera-reverse-outline" size={14} color="#FFFFFF" />
                        <Text style={styles.idRetakeText}>Change</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.idEmptySlotBody}>
                      <Ionicons
                        name="id-card-outline"
                        size={28}
                        color={isDarkMode ? "#64748B" : "#94A3B8"}
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          color: isDarkMode ? "#94A3B8" : "#64748B",
                          marginTop: 4,
                          marginBottom: 8,
                        }}
                      >
                        Front Side
                      </Text>
                      <View style={styles.idActionMiniRow}>
                        <TouchableOpacity
                          style={[
                            styles.idMiniBtn,
                            { backgroundColor: isDarkMode ? "#1E293B" : "#E2E8F0" },
                          ]}
                          onPress={() =>
                            promptOrientationAndPick(
                              "camera",
                              "School ID (Front)",
                              setDraftSchoolFront,
                              "schoolFront"
                            )
                          }
                        >
                          <Ionicons
                            name="camera-outline"
                            size={14}
                            color={isDarkMode ? "#FACC15" : "#0274BB"}
                          />
                          <Text
                            style={[
                              styles.idMiniBtnText,
                              { color: isDarkMode ? "#F8FAFC" : "#0F172A" },
                            ]}
                          >
                            Camera
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.idMiniBtn,
                            { backgroundColor: isDarkMode ? "#1E293B" : "#E2E8F0" },
                          ]}
                          onPress={() =>
                            promptOrientationAndPick(
                              "gallery",
                              "School ID (Front)",
                              setDraftSchoolFront,
                              "schoolFront"
                            )
                          }
                        >
                          <Ionicons
                            name="images-outline"
                            size={14}
                            color={isDarkMode ? "#FACC15" : "#0274BB"}
                          />
                          <Text
                            style={[
                              styles.idMiniBtnText,
                              { color: isDarkMode ? "#F8FAFC" : "#0F172A" },
                            ]}
                          >
                            Gallery
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                {/* School ID Back */}
                <View
                  style={[
                    styles.idSlotCard,
                    {
                      backgroundColor: isDarkMode ? "#111C33" : "#F8FAFC",
                      borderColor: draftSchoolBack
                        ? "#10B981"
                        : isDarkMode
                        ? "#263554"
                        : "#CBD5E1",
                    },
                  ]}
                >
                  <View style={styles.idSlotLabelRow}>
                    <Text
                      style={[
                        styles.idSlotLabel,
                        { color: isDarkMode ? "#E2E8F0" : "#1E293B" },
                      ]}
                    >
                      School ID • Back
                    </Text>
                    {draftSchoolBack ? (
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    ) : null}
                  </View>

                  {draftSchoolBack ? (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() =>
                        promptSlotSource("School ID (Back)", setDraftSchoolBack, "schoolBack")
                      }
                      style={styles.idPreviewWrap}
                    >
                      <Image
                        source={{ uri: draftSchoolBack }}
                        style={styles.idPreviewImage}
                        resizeMode="contain"
                      />
                      <View style={styles.idRetakeOverlay}>
                        <Ionicons name="camera-reverse-outline" size={14} color="#FFFFFF" />
                        <Text style={styles.idRetakeText}>Change</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.idEmptySlotBody}>
                      <Ionicons
                        name="card-outline"
                        size={28}
                        color={isDarkMode ? "#64748B" : "#94A3B8"}
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          color: isDarkMode ? "#94A3B8" : "#64748B",
                          marginTop: 4,
                          marginBottom: 8,
                        }}
                      >
                        Back Side
                      </Text>
                      <View style={styles.idActionMiniRow}>
                        <TouchableOpacity
                          style={[
                            styles.idMiniBtn,
                            { backgroundColor: isDarkMode ? "#1E293B" : "#E2E8F0" },
                          ]}
                          onPress={() =>
                            promptOrientationAndPick(
                              "camera",
                              "School ID (Back)",
                              setDraftSchoolBack,
                              "schoolBack"
                            )
                          }
                        >
                          <Ionicons
                            name="camera-outline"
                            size={14}
                            color={isDarkMode ? "#FACC15" : "#0274BB"}
                          />
                          <Text
                            style={[
                              styles.idMiniBtnText,
                              { color: isDarkMode ? "#F8FAFC" : "#0F172A" },
                            ]}
                          >
                            Camera
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.idMiniBtn,
                            { backgroundColor: isDarkMode ? "#1E293B" : "#E2E8F0" },
                          ]}
                          onPress={() =>
                            promptOrientationAndPick(
                              "gallery",
                              "School ID (Back)",
                              setDraftSchoolBack,
                              "schoolBack"
                            )
                          }
                        >
                          <Ionicons
                            name="images-outline"
                            size={14}
                            color={isDarkMode ? "#FACC15" : "#0274BB"}
                          />
                          <Text
                            style={[
                              styles.idMiniBtnText,
                              { color: isDarkMode ? "#F8FAFC" : "#0F172A" },
                            ]}
                          >
                            Gallery
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              </ScrollView>

            {/* Footer Buttons */}
            <View
              style={[
                styles.idModalFooter,
                { borderTopColor: isDarkMode ? "#1E293B" : "#E2E8F0" },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.idCancelBtn,
                  {
                    borderColor: isDarkMode ? "#334155" : "#CBD5E1",
                    backgroundColor: isDarkMode ? "#1E293B" : "#F1F5F9",
                  },
                ]}
                onPress={() => setIdUploadModalVisible(false)}
                disabled={savingIdCards}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: isDarkMode ? "#E2E8F0" : "#475569",
                  }}
                >
                  Close
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.idSubmitBtn,
                  {
                    backgroundColor:
                      draftSchoolFront && draftSchoolBack
                        ? isDarkMode
                          ? "#FACC15"
                          : "#0274BB"
                        : isDarkMode
                        ? "#334155"
                        : "#94A3B8",
                  },
                ]}
                onPress={handleSaveFourIdPhotos}
                disabled={savingIdCards}
              >
                {savingIdCards ? (
                  <ActivityIndicator
                    size="small"
                    color={isDarkMode ? "#080F1E" : "#FFFFFF"}
                  />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-done-circle"
                      size={18}
                      color={
                        draftSchoolFront && draftSchoolBack
                          ? isDarkMode
                            ? "#080F1E"
                            : "#FFFFFF"
                          : "#CBD5E1"
                      }
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "800",
                        color:
                          draftSchoolFront && draftSchoolBack
                            ? isDarkMode
                              ? "#080F1E"
                              : "#FFFFFF"
                            : "#CBD5E1",
                      }}
                    >
                      Save School ID Photos
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 4. VIEW 4 ID PICTURES MODAL (OPENED BY CLICKING THE ID ICON BELOW PROFILE PICTURE) */}
      <Modal
        visible={idViewerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIdViewerModalVisible(false)}
      >
        <View style={styles.idModalOverlay}>
          <View
            style={[
              styles.idModalContainer,
              {
                backgroundColor: isDarkMode ? "#0F172A" : "#FFFFFF",
                borderColor: isDarkMode ? "#1E293B" : "#E2E8F0",
                paddingBottom: Math.max(20, insets.bottom + 12),
              },
            ]}
          >
            {/* Header */}
            <View
              style={[
                styles.idModalHeader,
                { borderBottomColor: isDarkMode ? "#1E293B" : "#E2E8F0" },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <View
                  style={[
                    styles.idModalHeaderIcon,
                    { backgroundColor: "rgba(16, 185, 129, 0.15)" },
                  ]}
                >
                  <Ionicons name="id-card" size={22} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.idModalTitle,
                      { color: isDarkMode ? "#F8FAFC" : "#0F172A" },
                    ]}
                  >
                    Verified School ID
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: isDarkMode ? "#94A3B8" : "#64748B",
                      marginTop: 2,
                    }}
                  >
                    {studentFullName} • {studentIdNumber}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setIdViewerModalVisible(false)}
                style={styles.whiteContainerCloseIcon}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={isDarkMode ? "#94A3B8" : "#64748B"}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 18, paddingBottom: 24 }}
            >
              {/* School ID Front & Back */}
              <View style={styles.idSectionHeaderRow}>
                <Ionicons
                  name="school-outline"
                  size={17}
                  color={isDarkMode ? "#FACC15" : "#0274BB"}
                />
                <Text
                  style={[
                    styles.idSectionHeading,
                    { color: isDarkMode ? "#FACC15" : "#0274BB" },
                  ]}
                >
                  School ID (Front & Back)
                </Text>
              </View>

              <View style={styles.idSlotsGrid}>
                {/* 1. School ID Front */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() =>
                    uploadedIdCards?.schoolIdFront &&
                    setEnlargedIdPhoto({
                      title: "School ID • Front",
                      uri: uploadedIdCards.schoolIdFront,
                      slotKey: "schoolIdFront",
                      rotation: uploadedIdCards?.rotations?.schoolIdFront || 0,
                      orientation: uploadedIdCards?.orientation || idCaptureOrientation || "portrait",
                    })
                  }
                  style={[
                    styles.idSlotCard,
                    {
                      backgroundColor: isDarkMode ? "#111C33" : "#F8FAFC",
                      borderColor: isDarkMode ? "#263554" : "#CBD5E1",
                    },
                  ]}
                >
                  <View style={styles.idSlotLabelRow}>
                    <Text
                      style={[
                        styles.idSlotLabel,
                        { color: isDarkMode ? "#E2E8F0" : "#1E293B" },
                      ]}
                    >
                      School ID • Front
                    </Text>
                    <Ionicons
                      name="expand-outline"
                      size={14}
                      color={isDarkMode ? "#94A3B8" : "#64748B"}
                    />
                  </View>
                  {uploadedIdCards?.schoolIdFront ? (
                    <View style={[styles.idPreviewWrap, { height: isProfileIdPortrait ? 175 : 104 }]}>
                      <Image
                        source={{ uri: uploadedIdCards.schoolIdFront }}
                        style={[
                          styles.idPreviewImage,
                          Boolean(uploadedIdCards?.rotations?.schoolIdFront)
                            ? { transform: [{ rotate: `${uploadedIdCards?.rotations?.schoolIdFront}deg` }] }
                            : null,
                        ]}
                        resizeMode="contain"
                      />
                    </View>
                  ) : null}
                </TouchableOpacity>

                {/* 2. School ID Back */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() =>
                    uploadedIdCards?.schoolIdBack &&
                    setEnlargedIdPhoto({
                      title: "School ID • Back",
                      uri: uploadedIdCards.schoolIdBack,
                      slotKey: "schoolIdBack",
                      rotation: uploadedIdCards?.rotations?.schoolIdBack || 0,
                      orientation: uploadedIdCards?.orientation || idCaptureOrientation || "portrait",
                    })
                  }
                  style={[
                    styles.idSlotCard,
                    {
                      backgroundColor: isDarkMode ? "#111C33" : "#F8FAFC",
                      borderColor: isDarkMode ? "#263554" : "#CBD5E1",
                    },
                  ]}
                >
                  <View style={styles.idSlotLabelRow}>
                    <Text
                      style={[
                        styles.idSlotLabel,
                        { color: isDarkMode ? "#E2E8F0" : "#1E293B" },
                      ]}
                    >
                      School ID • Back
                    </Text>
                    <Ionicons
                      name="expand-outline"
                      size={14}
                      color={isDarkMode ? "#94A3B8" : "#64748B"}
                    />
                  </View>
                  {uploadedIdCards?.schoolIdBack ? (
                    <View style={[styles.idPreviewWrap, { height: isProfileIdPortrait ? 175 : 104 }]}>
                      <Image
                        source={{ uri: uploadedIdCards.schoolIdBack }}
                        style={[
                          styles.idPreviewImage,
                          Boolean(uploadedIdCards?.rotations?.schoolIdBack)
                            ? { transform: [{ rotate: `${uploadedIdCards?.rotations?.schoolIdBack}deg` }] }
                            : null,
                        ]}
                        resizeMode="contain"
                      />
                    </View>
                  ) : null}
                </TouchableOpacity>
              </View>

              <Text
                style={{
                  fontSize: 11.5,
                  color: isDarkMode ? "#94A3B8" : "#64748B",
                  textAlign: "center",
                  marginTop: 14,
                }}
              >
                Tap any ID picture above to view full screen.
              </Text>
            </ScrollView>

            {/* Footer Close */}
            <View
              style={[
                styles.idModalFooter,
                { borderTopColor: isDarkMode ? "#1E293B" : "#E2E8F0" },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.idSubmitBtn,
                  { backgroundColor: isDarkMode ? "#FFC800" : "#0274BB", flex: 1 },
                ]}
                onPress={() => setIdViewerModalVisible(false)}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "800",
                    color: isDarkMode ? "#080F1E" : "#FFFFFF",
                  }}
                >
                  Close Viewer
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 5. FULL-SCREEN SINGLE ID CARD ZOOM MODAL */}
      <Modal
        visible={Boolean(enlargedIdPhoto)}
        transparent
        animationType="fade"
        onRequestClose={() => setEnlargedIdPhoto(null)}
      >
        <View style={styles.viewerBackdrop}>
          <View style={[styles.viewerHeader, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity
              onPress={() => setEnlargedIdPhoto(null)}
              style={styles.viewerBackBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              <Text style={styles.viewerBackBtnText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.viewerHeaderTitle}>
              {enlargedIdPhoto?.title || "ID Card"}
            </Text>
            <TouchableOpacity
              onPress={handleRotateEnlargedPhoto}
              style={styles.viewerHeaderRotateBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={18} color="#FACC15" />
              <Text style={styles.viewerHeaderRotateBtnText}>Rotate</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.viewerBody}>
            {enlargedIdPhoto?.uri ? (
              <Image
                source={{ uri: enlargedIdPhoto.uri }}
                style={{
                  width:
                    (enlargedIdPhoto.orientation ||
                      uploadedIdCards?.orientation ||
                      idCaptureOrientation ||
                      "portrait") === "portrait"
                      ? Math.min(SCREEN_WIDTH - 48, 290)
                      : SCREEN_WIDTH - 32,
                  height:
                    (enlargedIdPhoto.orientation ||
                      uploadedIdCards?.orientation ||
                      idCaptureOrientation ||
                      "portrait") === "portrait"
                      ? Math.min(SCREEN_WIDTH - 48, 290) * 1.48
                      : (SCREEN_WIDTH - 32) * 0.65,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: "#FACC15",
                  transform: [{ rotate: `${enlargedIdPhoto.rotation || 0}deg` }],
                }}
                resizeMode="contain"
              />
            ) : null}
          </View>

          <View style={[styles.viewerBottomContainer, { paddingBottom: insets.bottom + 16, flexDirection: "column", gap: 10 }]}>
            <View style={{ flexDirection: "row", gap: 10, width: "100%" }}>
              <TouchableOpacity
                style={styles.viewerRotateActionBtn}
                onPress={handleRotateEnlargedPhoto}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={18} color="#080F1E" style={{ marginRight: 6 }} />
                <Text style={styles.viewerRotateActionText}>Rotate 90°</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.viewerOrientationActionBtn}
                onPress={handleToggleOrientationEnlargedPhoto}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={
                    (enlargedIdPhoto?.orientation ||
                      uploadedIdCards?.orientation ||
                      idCaptureOrientation ||
                      "portrait") === "portrait"
                      ? "phone-portrait"
                      : "phone-landscape"
                  }
                  size={18}
                  color="#FACC15"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.viewerOrientationActionText}>
                  {(enlargedIdPhoto?.orientation ||
                    uploadedIdCards?.orientation ||
                    idCaptureOrientation ||
                    "portrait") === "portrait"
                    ? "Portrait Frame"
                    : "Landscape Frame"}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.viewerBottomCloseBtn}
              onPress={() => setEnlargedIdPhoto(null)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.viewerBottomCloseText}>Close Preview</Text>
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
  avatarTouchable: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: "#1E293B",
  },
  avatarPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  cameraBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
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
  accountInfoCard: {
    backgroundColor: "#111A2E",
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  adminNoticeBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 8,
    gap: 8,
  },
  adminNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  infoIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  infoContent: {
    flex: 1,
    justifyContent: "center",
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 6,
    marginTop: 3,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#10B981",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#10B981",
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
  violationCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  violationCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  tabSelectorContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
    borderWidth: 1,
  },
  tabSelectorButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 9,
    gap: 6,
  },
  tabSelectorButtonActive: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 1,
  },
  tabSelectorText: {
    fontSize: 12,
  },
  violationDate: {
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
  cleanRecordPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  cleanRecordPillText: {
    fontSize: 11,
    fontWeight: '700',
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

  /* White Container: Profile Picture Options Modal */
  whiteModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  whiteModalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  whiteContainerCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  whiteContainerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  whiteContainerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  whiteContainerCloseIcon: {
    padding: 4,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  whiteContainerDescription: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
    marginBottom: 20,
  },
  whiteContainerButtons: {
    alignItems: "flex-end",
    gap: 12,
  },
  whiteActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  whiteActionIcon: {
    marginRight: 8,
  },
  whiteActionBtnText: {
    color: "#0274BB",
    fontSize: 13.5,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  whiteBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "rgba(2, 116, 187, 0.08)",
    marginTop: 6,
  },
  whiteBackBtnText: {
    color: "#0274BB",
    fontSize: 13.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  /* Fullscreen Profile Picture Viewer Modal */
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(4, 8, 18, 0.96)",
    justifyContent: "space-between",
  },
  viewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  viewerBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  viewerBackBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  viewerHeaderTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  viewerCameraBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  viewerBody: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  viewerLargeImage: {
    width: Math.min(320, SCREEN_WIDTH - 60),
    height: Math.min(320, SCREEN_WIDTH - 60),
    borderRadius: 24,
    borderWidth: 3,
    borderColor: "#EAB308",
  },
  viewerLargePlaceholder: {
    width: Math.min(320, SCREEN_WIDTH - 60),
    height: Math.min(320, SCREEN_WIDTH - 60),
    borderRadius: 24,
    backgroundColor: "#172339",
    borderWidth: 3,
    borderColor: "#EAB308",
    justifyContent: "center",
    alignItems: "center",
  },
  viewerLargePlaceholderInitial: {
    fontSize: 80,
    fontWeight: "900",
    color: "#EAB308",
  },
  viewerCardInfo: {
    marginTop: 22,
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    width: "100%",
    maxWidth: 320,
  },
  viewerStudentFullName: {
    fontSize: 19,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },
  viewerStudentIdText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#EAB308",
    marginTop: 4,
  },
  viewerStudentCourseText: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 2,
    textAlign: "center",
  },
  viewerVerifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  viewerVerifiedText: {
    fontSize: 11.5,
    color: "#10B981",
    fontWeight: "700",
  },
  viewerBottomContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  viewerBottomActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
  },
  viewerBottomActionText: {
    fontSize: 14,
    fontWeight: "800",
  },
  viewerBottomCloseBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  viewerBottomCloseText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  viewerHeaderRotateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(250, 204, 21, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(250, 204, 21, 0.4)",
  },
  viewerHeaderRotateBtnText: {
    color: "#FACC15",
    fontSize: 12,
    fontWeight: "700",
  },
  viewerRotateActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: "#FACC15",
  },
  viewerRotateActionText: {
    color: "#080F1E",
    fontSize: 14,
    fontWeight: "800",
  },
  viewerOrientationActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(250, 204, 21, 0.4)",
  },
  viewerOrientationActionText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700",
  },

  /* Required ID Upload Banner & Button/ID Icon Below Profile Picture */
  requiredIdBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 20,
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 10,
  },
  requiredIdBannerIconWrap: {
    marginTop: 1,
  },
  requiredIdBannerTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    marginBottom: 3,
  },
  requiredIdBannerSub: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  uploadIdButtonBelowAvatar: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    elevation: 4,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  uploadIdButtonText: {
    fontSize: 12.5,
    fontWeight: "800",
  },
  uploadIdButtonSubtext: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 1,
  },
  uploadIdReqBadge: {
    marginLeft: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  idIconButtonBelowAvatar: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  idIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },

  /* Inline Collapsible ID Display Section */
  inlineIdSection: {
    width: "100%",
    marginTop: 18,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
  },
  inlineIdHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  inlineIdTitle: {
    fontSize: 14.5,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  inlineIdSubtext: {
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 14,
  },
  inlineIdGroup: {
    marginBottom: 14,
  },
  inlineIdGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  inlineIdGroupTitle: {
    fontSize: 11.5,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  inlineIdPhotosRow: {
    flexDirection: "row",
    gap: 10,
  },
  inlineIdPhotoCard: {
    flex: 1,
    height: 125,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: "hidden",
    backgroundColor: "#0A101D",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  inlineIdImage: {
    width: "100%",
    height: "100%",
  },
  inlineIdBadgePill: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(10, 16, 29, 0.85)",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  inlineIdBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  inlineIdEmptySlot: {
    alignItems: "center",
    justifyContent: "center",
  },
  inlineIdEmptyText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94A3B8",
    marginTop: 4,
  },
  inlineIdRetakeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  inlineIdRetakeText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  /* ID Upload & Viewer Modals */
  idModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(4, 8, 18, 0.82)",
    justifyContent: "flex-end",
  },
  idModalContainer: {
    maxHeight: "90%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    overflow: "hidden",
  },
  idModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  idModalHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  idModalTitle: {
    fontSize: 16.5,
    fontWeight: "800",
  },
  idProgressPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginLeft: 8,
  },
  idSectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  idSectionHeading: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  idSlotsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  idSlotCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 10,
  },
  idSlotLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  idSlotLabel: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  idPreviewWrap: {
    width: "100%",
    height: 104,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#080F1E",
  },
  idPreviewImage: {
    width: "100%",
    height: "100%",
  },
  idRetakeOverlay: {
    position: "absolute",
    bottom: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(8, 15, 30, 0.8)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  idRetakeText: {
    color: "#FFFFFF",
    fontSize: 10.5,
    fontWeight: "700",
  },
  idEmptySlotBody: {
    height: 104,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(148, 163, 184, 0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  idActionMiniRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  idMiniBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  idMiniBtnText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  idModalFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  idCancelBtn: {
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  idSubmitBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
  },
  settingsSectionWrap: {
    marginHorizontal: 20,
    marginTop: 22,
  },
  settingsGroupTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 1.5,
    marginBottom: 12,
    paddingLeft: 4,
  },
  sysSettingsCard: {
    backgroundColor: "#111A2E",
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1E293B",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settingsToggleCard: {
    backgroundColor: "#111A2E",
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1E293B",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settingsCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 8,
  },
  settingsIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#080F1E",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  settingsCardTexts: {
    flex: 1,
  },
  settingsCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  settingsCardDetail: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
});