import React, { useEffect, useRef, useState } from "react";
import { Tabs, useRouter } from "expo-router";
import { View, Text, TouchableOpacity, Animated, StyleSheet, Platform, Alert, Modal, Image } from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../hooks/useThemeColors";
import TermsAgreementModal from "../../components/TermsAgreementModal";
import QRCode from "react-native-qrcode-svg";
import { useAuth } from "../../data/AuthContext";
import { API_URL, getBackendUrl } from "../../data/authService";
import {
  getStudentProfile,
  hasAllFourIdPhotos,
  loadStudentIdCardsForUser,
  subscribe,
} from "../../data/store";

interface TabConfig {
  name: string;
  title: string;
  icon: string;
  iconOutline: string;
}

const TAB_CONFIGS: Record<string, TabConfig> = {
  index: {
    name: "index",
    title: "Home",
    icon: "home",
    iconOutline: "home-outline",
  },
  search: {
    name: "search",
    title: "Search",
    icon: "magnify",
    iconOutline: "magnify",
  },
  books: {
    name: "books",
    title: "My Books",
    icon: "book-open-page-variant",
    iconOutline: "book-open-page-variant-outline",
  },
  reservations: {
    name: "reservations",
    title: "Library Card",
    icon: "card-bulleted",
    iconOutline: "card-bulleted-outline",
  },
  profile: {
    name: "profile",
    title: "Profile",
    icon: "account-circle",
    iconOutline: "account-circle-outline",
  },
};

function AnimatedTabIcon({
  focused,
  name,
  nameOutline,
  color,
  activeColor,
  pillBg,
}: {
  focused: boolean;
  name: any;
  nameOutline?: any;
  color: any;
  activeColor: any;
  pillBg: string;
}) {
  const scaleAnim = useRef(new Animated.Value(focused ? 1 : 0.95)).current;

  useEffect(() => {
    if (focused) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.15,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1.0,
          friction: 4,
          tension: 140,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 120,
        useNativeDriver: true,
      }).start();
    }
  }, [focused]);

  return (
    <Animated.View
      style={[
        focused
          ? {
              width: 44,
              height: 28,
              borderRadius: 14,
              backgroundColor: pillBg,
              justifyContent: "center",
              alignItems: "center",
            }
          : {
              width: 44,
              height: 28,
              justifyContent: "center",
              alignItems: "center",
            },
        {
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <MaterialCommunityIcons
        name={focused ? name : (nameOutline || name)}
        size={22}
        color={focused ? activeColor : color}
      />
    </Animated.View>
  );
}

function CenterQrButton({
  isDarkMode,
  theme,
  requiresIdUpload,
  user,
  profile,
}: {
  isDarkMode: boolean;
  theme: any;
  requiresIdUpload: boolean;
  user?: any;
  profile?: any;
}) {
  const router = useRouter();
  const pressScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const combinedScale = useRef(Animated.multiply(pressScale, pulseAnim)).current;

  const [qrModalMode, setQrModalMode] = useState<"none" | "choice" | "studentQr">("none");

  const studentIdentifier =
    user?.studentId ||
    user?.qrCode ||
    profile?.studentId ||
    profile?.qrCode ||
    user?.id ||
    "23-1111-111";

  const studentFullName =
    user?.fullName ||
    (user as any)?.name ||
    profile?.name ||
    (profile as any)?.fullName ||
    "Student User";

  const studentCourseSection = `${user?.course || profile?.course || "BSIT"} - ${user?.yearLevel || (user as any)?.yearlevel || profile?.yearLevel || profile?.yearlevel || "4TH"}`;

  const backendBase = typeof getBackendUrl === "function" ? getBackendUrl() : String(API_URL || "").replace(/\/api$/, "");
  const studentQrPayload = studentIdentifier
    ? (backendBase ? `${backendBase}/verify/${encodeURIComponent(studentIdentifier)}` : studentIdentifier)
    : "BOOKHIVE-STUDENT-PASS";

  const rawAvatar = user?.avatar || profile?.avatar;
  const avatarUri = typeof rawAvatar === "string" ? rawAvatar : "";
  const hasValidAvatar =
    avatarUri &&
    (avatarUri.startsWith("http") || avatarUri.startsWith("data:")) &&
    !avatarUri.includes("placeholder.com");

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 1300,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1300,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.9,
      friction: 5,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1.0,
      friction: 4,
      tension: 160,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    setQrModalMode("choice");
  };

  return (
    <View style={styles.centerButtonWrapper} pointerEvents="box-none">
      {/* Curved cradle outline arching slightly above the navigation bar */}
      <View
        style={[
          styles.cradleOutline,
          {
            backgroundColor: theme.tabBarBg,
            borderColor: theme.tabBarBorder,
            shadowColor: isDarkMode ? "#000" : "#0274BB",
          },
        ]}
      >
        <Animated.View
          style={{
            transform: [{ scale: combinedScale }],
          }}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            style={[
              styles.qrFabButton,
              {
                backgroundColor: isDarkMode ? theme.accentGold : theme.accentYellow,
                shadowColor: isDarkMode ? theme.accentGold : "#0F172A",
                borderWidth: isDarkMode ? 0 : 1,
                borderColor: isDarkMode ? "transparent" : "rgba(0, 0, 0, 0.08)",
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="QR Code and Scanner Options"
          >
            <MaterialCommunityIcons
              name="qrcode-scan"
              size={24}
              color={isDarkMode ? "#090D16" : "#0B1A2C"}
            />
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* UNIFIED QR ACTION & STUDENT QR CODE MODAL */}
      <Modal
        visible={qrModalMode !== "none"}
        transparent
        animationType="fade"
        onRequestClose={() => setQrModalMode("none")}
      >
        <View style={styles.qrActionBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setQrModalMode("none")}
          />
          {qrModalMode === "choice" ? (
            <View
              style={[
                styles.qrActionCard,
                {
                  backgroundColor: isDarkMode ? "#0F172A" : "#FFFFFF",
                  borderColor: isDarkMode ? "#24334C" : "#CBD5E1",
                },
              ]}
            >
              <View style={styles.qrActionHeader}>
                <Text
                  style={[
                    styles.qrActionTitle,
                    { color: isDarkMode ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  QR Code & Scanner
                </Text>
                <Text
                  style={[
                    styles.qrActionSubtitle,
                    { color: theme.textSecondary },
                  ]}
                >
                  Select an option to proceed
                </Text>
              </View>

              {/* Option 1: Student QR Code */}
              <TouchableOpacity
                style={[
                  styles.qrActionOptionBtn,
                  {
                    backgroundColor: isDarkMode ? "#16233B" : "#F8FAFC",
                    borderColor: isDarkMode ? "#283850" : "#E2E8F0",
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => setQrModalMode("studentQr")}
              >
                <View
                  style={[
                    styles.qrActionIconCircle,
                    {
                      backgroundColor: isDarkMode
                        ? "rgba(250, 204, 21, 0.16)"
                        : "rgba(2, 116, 187, 0.12)",
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="qrcode"
                    size={26}
                    color={isDarkMode ? theme.accentGold : theme.accentBlue}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.qrActionOptionTitle,
                      { color: isDarkMode ? "#FFFFFF" : "#0F172A" },
                    ]}
                  >
                    My Student QR Code
                  </Text>
                  <Text
                    style={[
                      styles.qrActionOptionDesc,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Show your official library pass & student ID
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>

              {/* Option 2: QR Scanner */}
              <TouchableOpacity
                style={[
                  styles.qrActionOptionBtn,
                  {
                    backgroundColor: isDarkMode ? "#16233B" : "#F8FAFC",
                    borderColor: isDarkMode ? "#283850" : "#E2E8F0",
                    marginTop: 10,
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  setQrModalMode("none");
                  if (requiresIdUpload) {
                    Alert.alert(
                      "ID Upload Required",
                      "Please upload your School ID and Library ID before using the scanner."
                    );
                    return;
                  }
                  router.push("/scanner");
                }}
              >
                <View
                  style={[
                    styles.qrActionIconCircle,
                    {
                      backgroundColor: isDarkMode
                        ? "rgba(14, 165, 233, 0.16)"
                        : "#E0F2FE",
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="qrcode-scan"
                    size={24}
                    color={isDarkMode ? "#38BDF8" : "#0274BB"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.qrActionOptionTitle,
                      { color: isDarkMode ? "#FFFFFF" : "#0F172A" },
                    ]}
                  >
                    Open QR Scanner
                  </Text>
                  <Text
                    style={[
                      styles.qrActionOptionDesc,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Scan book barcodes and library stations
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>

              {/* Cancel Button */}
              <TouchableOpacity
                style={[
                  styles.qrActionCancelBtn,
                  {
                    backgroundColor: isDarkMode ? "#1E293B" : "#F1F5F9",
                    borderColor: isDarkMode ? "#334155" : "#CBD5E1",
                  },
                ]}
                onPress={() => setQrModalMode("none")}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.qrActionCancelText,
                    { color: theme.textPrimary },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View
              style={[
                styles.qrModalCard,
                {
                  backgroundColor: isDarkMode ? "#111A2E" : "#FFFFFF",
                  borderColor: isDarkMode ? "#24334C" : "#CBD5E1",
                },
              ]}
            >
              {/* Modal Top Header */}
              <View style={styles.qrModalHeader}>
                <View style={styles.qrModalHeaderLeft}>
                  <View
                    style={[
                      styles.qrBadgeCircle,
                      !isDarkMode && { backgroundColor: "rgba(2, 116, 187, 0.1)" },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="qrcode"
                      size={20}
                      color={isDarkMode ? theme.accentGold : theme.accentBlue}
                    />
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.qrModalTitle,
                        { color: isDarkMode ? "#FFFFFF" : "#0F172A" },
                      ]}
                    >
                      STUDENT QR CODE
                    </Text>
                    <Text
                      style={[styles.qrModalSubtitle, { color: theme.textSecondary }]}
                    >
                      Official BookHive Library Pass
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.qrCloseBtn,
                    { backgroundColor: isDarkMode ? "#1E293B" : "#F1F5F9" },
                  ]}
                  onPress={() => setQrModalMode("none")}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color={isDarkMode ? "#94A3B8" : "#475569"}
                  />
                </TouchableOpacity>
              </View>

              {/* QR Code Container (Interactive) */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  setQrModalMode("none");
                  router.push({
                    pathname: "/scanned-card",
                    params: { qr: studentIdentifier },
                  });
                }}
                style={styles.qrCodeWrapper}
              >
                <View style={styles.qrCodeBox}>
                  <QRCode
                    value={studentQrPayload}
                    size={185}
                    color="#0F172A"
                    backgroundColor="#FFFFFF"
                  />
                </View>
                <View style={styles.qrTapHint}>
                  <Ionicons name="eye-outline" size={13} color="#64748B" />
                  <Text style={styles.qrTapHintText}>
                    Tap QR to preview card & violations
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Student Information */}
              <View
                style={[
                  styles.qrStudentInfoBox,
                  {
                    backgroundColor: isDarkMode ? "#16233B" : "#F8FAFC",
                    borderColor: isDarkMode ? "#283850" : "#E2E8F0",
                  },
                ]}
              >
                {hasValidAvatar ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 25,
                      borderWidth: 2,
                      borderColor: isDarkMode ? theme.accentGold : theme.accentBlue,
                      marginBottom: 8,
                    }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 25,
                      backgroundColor: isDarkMode
                        ? "rgba(255, 215, 0, 0.15)"
                        : "rgba(2, 116, 187, 0.12)",
                      justifyContent: "center",
                      alignItems: "center",
                      borderWidth: 1.5,
                      borderColor: isDarkMode ? theme.accentGold : theme.accentBlue,
                      marginBottom: 8,
                    }}
                  >
                    <Ionicons
                      name="person"
                      size={24}
                      color={isDarkMode ? theme.accentGold : theme.accentBlue}
                    />
                  </View>
                )}
                <Text
                  style={[
                    styles.qrStudentName,
                    { color: isDarkMode ? "#FFFFFF" : "#0F172A" },
                  ]}
                  numberOfLines={1}
                >
                  {studentFullName}
                </Text>
                <View style={styles.qrIdBadgeRow}>
                  <Text style={styles.qrStudentID}>
                    ID: {studentIdentifier}
                  </Text>
                </View>
                <Text
                  style={[styles.qrStudentCourse, { color: theme.textSecondary }]}
                  numberOfLines={1}
                >
                  {studentCourseSection}
                </Text>
              </View>

              <Text style={[styles.qrInstructionText, { color: theme.textMuted }]}>
                Present this QR code to the librarian or scan via mobile to verify
                your Library Card and borrowing records.
              </Text>

              {/* Primary Action Button: View Library Card & Violations */}
              <TouchableOpacity
                style={[
                  styles.qrViewRecordBtn,
                  {
                    backgroundColor: isDarkMode
                      ? theme.accentGold
                      : theme.accentBlue,
                  },
                ]}
                onPress={() => {
                  setQrModalMode("none");
                  router.push({
                    pathname: "/scanned-card",
                    params: { qr: studentIdentifier },
                  });
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="open-outline"
                  size={17}
                  color={isDarkMode ? "#080F1E" : "#FFFFFF"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.qrViewRecordBtnText,
                    { color: isDarkMode ? "#080F1E" : "#FFFFFF" },
                  ]}
                >
                  View Library Card & Violations
                </Text>
              </TouchableOpacity>

              {/* Dismiss Button */}
              <TouchableOpacity
                style={[
                  styles.qrDismissBtn,
                  {
                    backgroundColor: isDarkMode ? "#1E293B" : "#E2E8F0",
                    borderColor: isDarkMode ? "#334155" : "#CBD5E1",
                    borderWidth: 1,
                    marginTop: 8,
                  },
                ]}
                onPress={() => setQrModalMode("none")}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.qrDismissBtnText, { color: theme.textPrimary }]}
                >
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

function CustomBottomTabBar({
  state,
  descriptors,
  navigation,
  emitter,
  navigateToTab,
  insets,
  isDarkMode,
  theme,
  requiresIdUpload,
  user,
  profile,
}: any) {
  const router = useRouter();
  const activeColor = theme.tabBarActive;
  const inactiveColor = theme.tabBarInactive;

  // Split routes symmetrically around the centered QR code scanner:
  // Left side gets Home, Search; Right side gets My Books, Library Card
  const leftRouteNames = ["index", "search"];
  const rightRouteNames = ["books", "reservations"];

  const currentRouteName = state?.routes?.[state?.index]?.name;

  useEffect(() => {
    if (requiresIdUpload && currentRouteName && currentRouteName !== "profile") {
      const profileRoute = state?.routes?.find((r: any) => r.name === "profile");
      if (profileRoute && typeof navigateToTab === "function") {
        navigateToTab(profileRoute.key);
      } else {
        router.navigate("/profile");
      }
    }
  }, [requiresIdUpload, currentRouteName]);

  const renderTabItem = (routeName: string) => {
    const routeIndex = state.routes.findIndex((r: any) => r.name === routeName);
    if (routeIndex === -1) return null;

    const route = state.routes[routeIndex];
    const isFocused = state.index === routeIndex;
    const config = TAB_CONFIGS[routeName];
    if (!config) return null;

    const onPress = () => {
      if (requiresIdUpload && routeName !== "profile") {
        Alert.alert(
          "ID Upload Required",
          "Please click the button below your profile picture to upload your School ID (Front & Back) and Library ID (Front & Back) before navigating to other pages."
        );
        const profileRoute = state?.routes?.find((r: any) => r.name === "profile");
        if (profileRoute && typeof navigateToTab === "function") {
          navigateToTab(profileRoute.key);
        } else {
          router.navigate("/profile");
        }
        return;
      }

      const event = emitter
        ? emitter.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          })
        : navigation?.emit?.({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

      if (!isFocused && (!event || !event.defaultPrevented)) {
        if (typeof navigateToTab === "function") {
          navigateToTab(route.key);
        } else if (navigation?.navigate) {
          navigation.navigate(route.name);
        } else {
          router.navigate(`/(tabs)/${routeName}` as any);
        }
      }
    };

    return (
      <TouchableOpacity
        key={route.key}
        activeOpacity={0.75}
        onPress={onPress}
        style={styles.tabButton}
        accessibilityRole="tab"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={config.title}
      >
        <AnimatedTabIcon
          focused={isFocused}
          name={config.icon}
          nameOutline={config.iconOutline}
          color={inactiveColor}
          activeColor={activeColor}
          pillBg={theme.tabBarActivePill}
        />
        <Text
          numberOfLines={1}
          style={[
            styles.tabLabel,
            {
              color: isFocused ? activeColor : inactiveColor,
              fontWeight: isFocused ? "800" : "700",
            },
          ]}
        >
          {config.title}
        </Text>
      </TouchableOpacity>
    );
  };

  const barHeight = 62 + (insets.bottom > 0 ? insets.bottom : 6);

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          backgroundColor: theme.tabBarBg,
          borderTopColor: theme.tabBarBorder,
          height: barHeight,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 6,
          shadowColor: isDarkMode ? "#000" : "#0274BB",
        },
      ]}
    >
      {/* Left side tabs: Home, Search */}
      <View style={styles.tabBarSection}>
        {leftRouteNames.map(renderTabItem)}
      </View>

      {/* Center Spacer dedicated to the elevated QR code button */}
      <View style={styles.centerSpacer} />

      {/* Right side tabs: My Books, Library Card */}
      <View style={styles.tabBarSection}>
        {rightRouteNames.map(renderTabItem)}
      </View>

      {/* The Centered QR Code with round curve outline */}
      <CenterQrButton
        isDarkMode={isDarkMode}
        theme={theme}
        requiresIdUpload={requiresIdUpload}
        user={user}
        profile={profile}
      />
    </View>
  );
}

export default function Layout() {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();
  const { user, isSignedIn } = useAuth();
  const [hasIdCards, setHasIdCards] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    const checkIdStatus = async () => {
      if (!isSignedIn || !user) {
        if (mounted) setHasIdCards(true);
        return;
      }
      const role = (user.role || "").toLowerCase().trim();
      const isStaff =
        role === "librarian" ||
        role === "admin" ||
        role === "super admin" ||
        role === "staff";
      if (isStaff) {
        if (mounted) setHasIdCards(true);
        return;
      }

      const profile = getStudentProfile();
      if (hasAllFourIdPhotos(user) || hasAllFourIdPhotos(profile)) {
        if (mounted) setHasIdCards(true);
        return;
      }

      const stored = await loadStudentIdCardsForUser(user);
      if (mounted) {
        setHasIdCards(Boolean(stored));
      }
    };

    checkIdStatus();
    const unsub = subscribe(() => {
      checkIdStatus();
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, [isSignedIn, user]);

  const requiresIdUpload = Boolean(isSignedIn && user && !hasIdCards);

  return (
    <>
      <Tabs
        tabBar={(props) => (
          <CustomBottomTabBar
            {...props}
            insets={insets}
            isDarkMode={isDarkMode}
            theme={theme}
            requiresIdUpload={requiresIdUpload}
            user={user}
            profile={getStudentProfile()}
          />
        )}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: theme.background },
          lazy: true,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
          }}
        />

        <Tabs.Screen
          name="search"
          options={{
            title: "Search",
          }}
        />

        <Tabs.Screen
          name="books"
          options={{
            title: "My Books",
          }}
        />

        <Tabs.Screen
          name="reservations"
          options={{
            title: "Library Card",
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
          }}
        />

        {/* NON-TAB SCREENS (hidden from bottom bar by CustomBottomTabBar) */}
        <Tabs.Screen
          name="book-details"
        />
        <Tabs.Screen
          name="reservation-details"
        />
      </Tabs>
      <TermsAgreementModal />
    </>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 6,
    elevation: 8,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  tabBarSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  centerSpacer: {
    width: 66,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 3,
  },
  tabLabel: {
    fontSize: 10.5,
    letterSpacing: 0.1,
    marginTop: 2,
    textAlign: "center",
  },
  centerButtonWrapper: {
    position: "absolute",
    top: -22,
    left: "50%",
    marginLeft: -34,
    width: 68,
    height: 68,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 99,
  },
  cradleOutline: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  qrFabButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
  },
  qrActionBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  qrActionCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  qrActionHeader: {
    alignItems: "center",
    marginBottom: 18,
  },
  qrActionTitle: {
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  qrActionSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 3,
    textAlign: "center",
  },
  qrActionOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  qrActionIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  qrActionOptionTitle: {
    fontSize: 14.5,
    fontWeight: "800",
    marginBottom: 2,
  },
  qrActionOptionDesc: {
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 15,
  },
  qrActionCancelBtn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  qrActionCancelText: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  qrModalCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  qrModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 16,
  },
  qrModalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  qrBadgeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 215, 0, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  qrModalTitle: {
    fontSize: 14.5,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  qrModalSubtitle: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  qrCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  qrCodeWrapper: {
    alignItems: "center",
    marginBottom: 14,
  },
  qrCodeBox: {
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  qrStudentInfoBox: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  qrStudentName: {
    fontSize: 15.5,
    fontWeight: "800",
    marginBottom: 3,
    textAlign: "center",
  },
  qrIdBadgeRow: {
    backgroundColor: "rgba(255, 215, 0, 0.18)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 3,
  },
  qrStudentID: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#D97706",
    letterSpacing: 0.5,
  },
  qrStudentCourse: {
    fontSize: 11.5,
    fontWeight: "600",
    textAlign: "center",
  },
  qrInstructionText: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  qrTapHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  qrTapHintText: {
    fontSize: 10.5,
    color: "#64748B",
    fontWeight: "600",
  },
  qrViewRecordBtn: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  qrViewRecordBtnText: {
    fontSize: 13.5,
    fontWeight: "800",
  },
  qrDismissBtn: {
    width: "100%",
    paddingVertical: 11,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  qrDismissBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
