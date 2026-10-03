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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimatedScreen from "../../components/AnimatedScreen";

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
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
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();
  const { user, logout, updateUser } = useAuth();

  const [imageLoadError, setImageLoadError] = useState(false);
  const [photoOptionsVisible, setPhotoOptionsVisible] = useState(false);
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);

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

  useFocusEffect(
    React.useCallback(() => {
      loadViolations();
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
          <Text style={[styles.headerTitle, { color: theme.headerTitle }]}>
            BOOKHIVE PROFILE
          </Text>

          <TouchableOpacity
            style={styles.notificationButtonRelative}
            onPress={() => router.push("/notifications")}
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
                  borderTopColor: isDarkMode ? theme.cardBorder : theme.accentBlue,
                  borderTopWidth: isDarkMode ? 1 : 2.5,
                  shadowColor: theme.shadowColor,
                  shadowOpacity: isDarkMode ? 0.3 : 0.05,
                }
              ]}>
                <Text style={[styles.statNumber, { color: isDarkMode ? theme.accentGold : theme.accentBlue }]}>
                  {reservations.filter((book) => book.status === 'Approved').length}
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

            {/* SETTINGS SECTION */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: isDarkMode ? theme.accentGold : theme.accentBlue }]}>
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
                  color={isDarkMode ? theme.accentGold : theme.accentBlue}
                />

                <Text style={[styles.settingText, { color: theme.textPrimary }]}>
                  System Settings
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.settingItem, { borderBottomColor: theme.cardBorder }]}
                onPress={() => router.push('/terms-agreement')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color={isDarkMode ? theme.accentGold : theme.accentBlue}
                />

                <Text style={[styles.settingText, { color: theme.textPrimary }]}>
                  Terms & Agreement
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.settingItem, { borderBottomColor: theme.cardBorder }]}
                onPress={() => router.push('/help')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="help-circle-outline"
                  size={20}
                  color={isDarkMode ? theme.accentGold : theme.accentBlue}
                />

                <Text style={[styles.settingText, { color: theme.textPrimary }]}>
                  Help & Support
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
                  color={isDarkMode ? theme.accentGold : theme.accentBlue}
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
});