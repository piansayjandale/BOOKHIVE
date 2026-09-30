import React, { useEffect, useRef } from "react";
import { Tabs } from "expo-router";
import { View, Animated } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../hooks/useThemeColors";
import TermsAgreementModal from "../../components/TermsAgreementModal";

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
          toValue: 1.18,
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
              width: 48,
              height: 32,
              borderRadius: 16,
              backgroundColor: pillBg,
              justifyContent: "center",
              alignItems: "center",
            }
          : {
              width: 48,
              height: 32,
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

export default function Layout() {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();

  const activeColor = theme.tabBarActive;
  const inactiveColor = theme.tabBarInactive;

  return (
    <>
      <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.background },
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          fontFamily: "monospace",
          letterSpacing: -0.2,
          marginBottom: 4,
        },
        tabBarStyle: {
          backgroundColor: theme.tabBarBg,
          height: 64 + (insets.bottom > 0 ? insets.bottom : 6),
          borderTopColor: theme.tabBarBorder,
          borderTopWidth: 1,
          paddingTop: 6,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          elevation: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              focused={focused}
              name="home"
              nameOutline="home-outline"
              color={color}
              activeColor={activeColor}
              pillBg={theme.tabBarActivePill}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              focused={focused}
              name="magnify"
              nameOutline="magnify"
              color={color}
              activeColor={activeColor}
              pillBg={theme.tabBarActivePill}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="books"
        options={{
          title: "My Books",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              focused={focused}
              name="book-open-page-variant"
              nameOutline="book-open-page-variant-outline"
              color={color}
              activeColor={activeColor}
              pillBg={theme.tabBarActivePill}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="reservations"
        options={{
          title: "Library Card",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              focused={focused}
              name="card-bulleted"
              nameOutline="card-bulleted-outline"
              color={color}
              activeColor={activeColor}
              pillBg={theme.tabBarActivePill}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              focused={focused}
              name="account-circle"
              nameOutline="account-circle-outline"
              color={color}
              activeColor={activeColor}
              pillBg={theme.tabBarActivePill}
            />
          ),
        }}
      />

      {/* HIDDEN PAGES */}
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