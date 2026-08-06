import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimatedScreen from "../../components/AnimatedScreen";

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../data/AuthContext";
import { useThemeColors } from "../../hooks/useThemeColors";
import { getReservations, getStudentProfile, subscribe, getNotifications, NotificationItem } from "../../data/store";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();

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

  const unreadCount = notifications.filter((n) => !n.read).length;

  const { logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            logout();
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
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
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
              color={theme.accentGold}
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
          <Image
            source={{
              uri: profile.avatar,
            }}
            style={[styles.avatar, { borderColor: theme.cardBorder }] as any}
          />

          <Text style={[styles.name, { color: theme.textPrimary }]}>
            {profile.name}
          </Text>

          <Text style={[styles.course, { color: theme.textSecondary }]}>
            {profile.course}
          </Text>

          <View style={[styles.idBadge, { backgroundColor: theme.background, borderColor: theme.cardBorder }]}>
            <Text style={[styles.idText, { color: theme.accentGold }]}>
              STUDENT ID: {profile.studentId}
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
              shadowColor: theme.shadowColor,
              shadowOpacity: isDarkMode ? 0.3 : 0.05,
            }
          ]}>
            <Text style={[styles.statNumber, { color: theme.accentGold }]}>
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
              shadowColor: theme.shadowColor,
              shadowOpacity: isDarkMode ? 0.3 : 0.05,
            }
          ]}>
            <Text style={[styles.statNumber, { color: theme.accentGold }]}>
              {reservations.filter((book) => book.status === 'Approved').length}
            </Text>

            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Borrowed Books
            </Text>
          </View>
        </View>

        {/* SETTINGS SECTION (Positioned directly below stats) */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.accentGold }]}>
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
              color={theme.accentGold}
            />

            <Text style={[styles.settingText, { color: theme.textPrimary }]}>
              System Settings
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.cardBorder }]}
            onPress={() => router.push('/edit-profile')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="person-outline"
              size={20}
              color={theme.accentGold}
            />

            <Text style={[styles.settingText, { color: theme.textPrimary }]}>
              Edit Profile
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
              color={theme.accentGold}
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
    fontSize: 18,
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

  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: "#1E293B",
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
});