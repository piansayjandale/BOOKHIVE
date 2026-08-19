import { Tabs } from "expo-router";
import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../hooks/useThemeColors";

export default function Layout() {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();

  const activeColor = theme.tabBarActive;
  const inactiveColor = theme.tabBarInactive;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
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
            <View
              style={
                focused
                  ? {
                      width: 48,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: theme.tabBarActivePill,
                      justifyContent: "center",
                      alignItems: "center",
                    }
                  : {
                      width: 48,
                      height: 32,
                      justifyContent: "center",
                      alignItems: "center",
                    }
              }
            >
              <MaterialCommunityIcons
                name={focused ? "home" : "home-outline"}
                size={22}
                color={focused ? activeColor : color}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={
                focused
                  ? {
                      width: 48,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: theme.tabBarActivePill,
                      justifyContent: "center",
                      alignItems: "center",
                    }
                  : {
                      width: 48,
                      height: 32,
                      justifyContent: "center",
                      alignItems: "center",
                    }
              }
            >
              <MaterialCommunityIcons
                name="magnify"
                size={22}
                color={focused ? activeColor : color}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="books"
        options={{
          title: "My Books",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={
                focused
                  ? {
                      width: 48,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: theme.tabBarActivePill,
                      justifyContent: "center",
                      alignItems: "center",
                    }
                  : {
                      width: 48,
                      height: 32,
                      justifyContent: "center",
                      alignItems: "center",
                    }
              }
            >
              <MaterialCommunityIcons
                name="book-open-page-variant"
                size={22}
                color={focused ? activeColor : color}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="reservations"
        options={{
          title: "Book Card",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={
                focused
                  ? {
                      width: 48,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: theme.tabBarActivePill,
                      justifyContent: "center",
                      alignItems: "center",
                    }
                  : {
                      width: 48,
                      height: 32,
                      justifyContent: "center",
                      alignItems: "center",
                    }
              }
            >
              <MaterialCommunityIcons
                name={focused ? "card-bulleted" : "card-bulleted-outline"}
                size={22}
                color={focused ? activeColor : color}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={
                focused
                  ? {
                      width: 48,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: theme.tabBarActivePill,
                      justifyContent: "center",
                      alignItems: "center",
                    }
                  : {
                      width: 48,
                      height: 32,
                      justifyContent: "center",
                      alignItems: "center",
                    }
              }
            >
              <MaterialCommunityIcons
                name="account-circle-outline"
                size={22}
                color={focused ? activeColor : color}
              />
            </View>
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