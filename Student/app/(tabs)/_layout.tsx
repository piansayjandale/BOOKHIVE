import React, { useEffect, useRef, useState } from "react";
import { Tabs, useRouter } from "expo-router";
import { View, Text, TouchableOpacity, Animated, StyleSheet, Platform, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../hooks/useThemeColors";
import TermsAgreementModal from "../../components/TermsAgreementModal";
import { useAuth } from "../../data/AuthContext";
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
              height: 30,
              borderRadius: 15,
              backgroundColor: pillBg,
              justifyContent: "center",
              alignItems: "center",
            }
          : {
              width: 44,
              height: 30,
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
        size={21}
        color={focused ? activeColor : color}
      />
    </Animated.View>
  );
}

function CenterQrButton({
  isDarkMode,
  theme,
  requiresIdUpload,
}: {
  isDarkMode: boolean;
  theme: any;
  requiresIdUpload: boolean;
}) {
  const router = useRouter();
  const pressScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

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
  }, []);

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
    if (requiresIdUpload) {
      Alert.alert(
        "ID Upload Required",
        "Please click the button below your profile picture to upload your School ID (Front & Back) and Library ID (Front & Back) before using the app."
      );
      return;
    }
    router.push("/scanner");
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
            transform: [{ scale: Animated.multiply(pressScale, pulseAnim) }],
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
                shadowColor: isDarkMode ? theme.accentGold : "#0274BB",
                borderWidth: isDarkMode ? 0 : 1.5,
                borderColor: isDarkMode ? "transparent" : "rgba(2, 116, 187, 0.25)",
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Scan QR Code"
          >
            <MaterialCommunityIcons
              name="qrcode-scan"
              size={25}
              color={isDarkMode ? "#080F1E" : "#0274BB"}
            />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

function CustomBottomTabBar({
  state,
  descriptors,
  navigation,
  insets,
  isDarkMode,
  theme,
  requiresIdUpload,
}: any) {
  const activeColor = theme.tabBarActive;
  const inactiveColor = theme.tabBarInactive;

  // Split routes symmetrically around the centered QR code scanner:
  // Left side gets Home, Search; Right side gets My Books, Library Card
  const leftRouteNames = ["index", "search"];
  const rightRouteNames = ["books", "reservations"];

  useEffect(() => {
    if (requiresIdUpload) {
      const currentRouteName = state.routes[state.index]?.name;
      if (currentRouteName && currentRouteName !== "profile") {
        navigation.navigate("profile");
      }
    }
  }, [requiresIdUpload, state.index, state.routes, navigation]);

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
        navigation.navigate("profile");
        return;
      }

      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
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
          />
        )}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: theme.background },
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
            href: null,
          }}
        />

        {/* HIDDEN SCREENS */}
        <Tabs.Screen
          name="book-details"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="reservation-details"
          options={{
            href: null,
          }}
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
    elevation: 12,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
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
    paddingVertical: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: -0.2,
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
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderRightWidth: 2.5,
    borderBottomWidth: 0,
    justifyContent: "center",
    alignItems: "center",
    elevation: 10,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.16,
    shadowRadius: 5,
  },
  qrFabButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
});
