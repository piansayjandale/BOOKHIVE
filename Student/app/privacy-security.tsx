import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimatedScreen from "../components/AnimatedScreen";
import { useThemeColors } from "../hooks/useThemeColors";

import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function PrivacySecurityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();

  const [emailNotifications, setEmailNotifications] =
    useState(true);
  const [smsNotifications, setSmsNotifications] =
    useState(false);
  const [dataSharing, setDataSharing] = useState(
    false
  );
  const [profilePrivacy, setProfilePrivacy] =
    useState(true);

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          onPress: () => {},
          style: "cancel",
        },
        {
          text: "Logout",
          onPress: () => {
            router.replace("/");
          },
          style: "destructive",
        },
      ]
    );
  };

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: 16 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder, borderBottomWidth: 1 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather
            name="arrow-left"
            size={22}
            color={theme.accentGold}
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          PRIVACY & SECURITY
        </Text>

        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 0,
          paddingBottom: 40,
        }}
      >
        {/* NOTIFICATIONS */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.accentGold }]}>
            Notifications
          </Text>

          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1 }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={theme.accentGold}
                />
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>
                    Email Notifications
                  </Text>
                  <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>
                    Receive updates via email
                  </Text>
                </View>
              </View>
              <Switch
                value={emailNotifications}
                onValueChange={
                  setEmailNotifications
                }
                trackColor={{
                  false: theme.cardBorder,
                  true: "#86EFAC",
                }}
                thumbColor={
                  emailNotifications
                    ? "#22C55E"
                    : "#94A3B8"
                }
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />

            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons
                  name="chatbox-outline"
                  size={20}
                  color={theme.accentGold}
                />
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>
                    SMS Notifications
                  </Text>
                  <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>
                    Receive updates via text
                  </Text>
                </View>
              </View>
              <Switch
                value={smsNotifications}
                onValueChange={
                  setSmsNotifications
                }
                trackColor={{
                  false: theme.cardBorder,
                  true: "#86EFAC",
                }}
                thumbColor={
                  smsNotifications
                    ? "#22C55E"
                    : "#94A3B8"
                }
              />
            </View>
          </View>
        </View>

        {/* PRIVACY */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.accentGold }]}>
            Privacy
          </Text>

          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1 }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons
                  name="eye-outline"
                  size={20}
                  color={theme.accentGold}
                />
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>
                    Profile Privacy
                  </Text>
                  <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>
                    Make profile visible to others
                  </Text>
                </View>
              </View>
              <Switch
                value={profilePrivacy}
                onValueChange={
                  setProfilePrivacy
                }
                trackColor={{
                  false: theme.cardBorder,
                  true: "#86EFAC",
                }}
                thumbColor={
                  profilePrivacy
                    ? "#22C55E"
                    : "#94A3B8"
                }
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />

            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons
                  name="share-social-outline"
                  size={20}
                  color={theme.accentGold}
                />
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>
                    Data Sharing
                  </Text>
                  <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>
                    Share data for improvements
                  </Text>
                </View>
              </View>
              <Switch
                value={dataSharing}
                onValueChange={setDataSharing}
                trackColor={{
                  false: theme.cardBorder,
                  true: "#86EFAC",
                }}
                thumbColor={
                  dataSharing
                    ? "#22C55E"
                    : "#94A3B8"
                }
              />
            </View>
          </View>
        </View>

        {/* SESSION */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.accentGold }]}>
            Session
          </Text>

          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1 }]}>
            <View style={[styles.infoBox, { backgroundColor: theme.background }]}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={theme.accentGold}
              />
              <Text style={[styles.infoText, { color: theme.textPrimary }]}>
                Last login: 2 hours ago
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.logoutButton, { borderTopColor: theme.cardBorder }]}
              onPress={handleLogout}
            >
              <Ionicons
                name="log-out-outline"
                size={18}
                color="#EF4444"
              />
              <Text style={styles.logoutText}>
                Logout
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* LEGAL LINKS */}
        <View style={styles.legalSection}>
          <TouchableOpacity style={[styles.legalLink, { borderBottomColor: theme.cardBorder }]}>
            <Text style={[styles.legalText, { color: theme.accentGold }]}>
              Terms of Service
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.legalLink, { borderBottomColor: theme.cardBorder }]}>
            <Text style={[styles.legalText, { color: theme.accentGold }]}>
              Privacy Policy
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.legalLink, { borderBottomColor: theme.cardBorder }]}>
            <Text style={[styles.legalText, { color: theme.accentGold }]}>
              Data Protection Notice
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
    backgroundColor: "#F4F6F8",
  },

  header: {
    backgroundColor: "#032B44",
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },

  section: {
    marginTop: 20,
  },

  sectionTitle: {
    paddingHorizontal: 20,
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 12,
  },

  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: "hidden",
  },

  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  settingInfo: {
    marginLeft: 12,
    flex: 1,
  },

  settingLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },

  settingDesc: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748B",
  },

  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 16,
  },

  formGroup: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0B5A8E",
    marginBottom: 6,
    letterSpacing: 0.3,
  },

  input: {
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#0F172A",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  updateButton: {
    backgroundColor: "#0B5A8E",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
  },

  updateButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#EEF4F8",
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },

  infoText: {
    marginLeft: 8,
    fontSize: 12,
    color: "#0B5A8E",
    fontWeight: "500",
  },

  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },

  logoutText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#EF4444",
  },

  legalSection: {
    marginTop: 30,
    marginHorizontal: 20,
  },

  legalLink: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },

  legalText: {
    fontSize: 13,
    color: "#0B5A8E",
    fontWeight: "500",
  },
});
