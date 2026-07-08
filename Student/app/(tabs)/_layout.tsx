import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../hooks/useThemeColors";

export default function Layout() {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accentGold,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          letterSpacing: 0.2,
          marginBottom: 2,
        },
        tabBarStyle: {
          backgroundColor: theme.headerBg,
          height: 60 + insets.bottom,
          borderTopColor: theme.headerBorder,
          paddingTop: 6,
          paddingBottom: insets.bottom > 0 ? insets.bottom - 4 : 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="home-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="magnify"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="books"
        options={{
          title: "My Books",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="book-open-page-variant"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="reservations"
        options={{
          title: "Reservations",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="bookmark-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="account-circle-outline"
              size={size}
              color={color}
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
  );
}