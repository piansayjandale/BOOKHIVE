import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AnimatedScreen from "../components/AnimatedScreen";
import { useThemeColors } from "../hooks/useThemeColors";
import { Ionicons } from "@expo/vector-icons";

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useThemeColors();

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 30 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={styles.topSection}>
          <View
            style={[
              styles.logoBadge,
              {
                backgroundColor: isDarkMode ? "rgba(255, 215, 0, 0.15)" : "#FEF9C3",
                borderColor: isDarkMode ? "rgba(255, 215, 0, 0.35)" : "#FDE047",
              },
            ]}
          >
            <Ionicons
              name="school-outline"
              size={36}
              color={isDarkMode ? theme.accentGold : theme.brandBlue}
            />
          </View>
          <Text style={[styles.title, { color: theme.textPrimary }]}>BookHive</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Student Sign-In & Access Guide
          </Text>
        </View>

        {/* Main Instructional Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.cardBorder,
              shadowColor: theme.shadowColor,
            },
          ]}
        >
          {/* Super Admin Notice Banner */}
          <View
            style={[
              styles.noticeBox,
              {
                backgroundColor: isDarkMode
                  ? "rgba(255, 215, 0, 0.12)"
                  : "#FEF9C3",
                borderColor: isDarkMode
                  ? "rgba(255, 215, 0, 0.40)"
                  : "#FDE047",
              },
            ]}
          >
            <View style={styles.noticeHeader}>
              <Ionicons
                name="shield-checkmark"
                size={22}
                color={isDarkMode ? theme.accentGold : "#854D0E"}
              />
              <Text
                style={[
                  styles.noticeTitle,
                  { color: isDarkMode ? theme.accentGold : "#854D0E" },
                ]}
              >
                Official Account Policy
              </Text>
            </View>
            <Text
              style={[
                styles.noticeText,
                { color: isDarkMode ? "#F3F4F6" : "#713F12" },
              ]}
            >
              Self-service account registration is disabled. Only the{" "}
              <Text style={{ fontWeight: "700" }}>Super Administrator</Text> can
              officially create and authorize institutional accounts.
            </Text>
          </View>

          {/* How Students Sign In */}
          <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>
            How to Sign In to Your Account
          </Text>

          {/* Step 1 */}
          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepNumberBadge,
                {
                  backgroundColor: isDarkMode
                    ? "rgba(56, 189, 248, 0.18)"
                    : "#E0F2FE",
                  borderColor: isDarkMode
                    ? "rgba(56, 189, 248, 0.35)"
                    : "#BAE6FD",
                },
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={20}
                color={isDarkMode ? theme.accentBlue : theme.brandBlue}
              />
            </View>
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, { color: theme.textPrimary }]}>
                1. Log in with your School Email
              </Text>
              <Text style={[styles.stepDescription, { color: theme.textSecondary }]}>
                Enter your official STI WNU School Google/Email account (e.g.,{" "}
                <Text style={{ fontWeight: "600", color: theme.textPrimary }}>
                  yourname.id@wnu.sti.edu.ph
                </Text>{" "}
                or{" "}
                <Text style={{ fontWeight: "600", color: theme.textPrimary }}>
                  @sti.edu.ph
                </Text>
                ) directly on the Log In page.
              </Text>
            </View>
          </View>

          {/* Step 2 */}
          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepNumberBadge,
                {
                  backgroundColor: isDarkMode
                    ? "rgba(16, 185, 129, 0.18)"
                    : "#ECFDF5",
                  borderColor: isDarkMode
                    ? "rgba(16, 185, 129, 0.35)"
                    : "#A7F3D0",
                },
              ]}
            >
              <Ionicons
                name="arrow-forward-circle-outline"
                size={20}
                color={isDarkMode ? "#34D399" : "#059669"}
              />
            </View>
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, { color: theme.textPrimary }]}>
                2. Automatic Redirection to Information Field
              </Text>
              <Text style={[styles.stepDescription, { color: theme.textSecondary }]}>
                Upon signing in, you will be automatically redirected to the{" "}
                <Text style={{ fontWeight: "600", color: theme.textPrimary }}>
                  Student Information field
                </Text>{" "}
                just like in the localhost student dashboard.
              </Text>
            </View>
          </View>

          {/* Step 3 */}
          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepNumberBadge,
                {
                  backgroundColor: isDarkMode
                    ? "rgba(255, 215, 0, 0.18)"
                    : "#FEF9C3",
                  borderColor: isDarkMode
                    ? "rgba(255, 215, 0, 0.40)"
                    : "#FDE047",
                },
              ]}
            >
              <Ionicons
                name="id-card-outline"
                size={20}
                color={isDarkMode ? theme.accentGold : "#B45309"}
              />
            </View>
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, { color: theme.textPrimary }]}>
                3. Input Details & Upload IDs
              </Text>
              <Text style={[styles.stepDescription, { color: theme.textSecondary }]}>
                Confirm your Student ID Number, Department, Course, Year Level, and
                upload both the{" "}
                <Text style={{ fontWeight: "600", color: theme.textPrimary }}>
                  Front & Back of your School ID
                </Text>{" "}
                and{" "}
                <Text style={{ fontWeight: "600", color: theme.textPrimary }}>
                  Library ID
                </Text>
                .
              </Text>
            </View>
          </View>

          {/* CTA Button to Login */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: theme.buttonPrimaryBg },
            ]}
            onPress={() => router.replace("/login")}
            activeOpacity={0.8}
          >
            <Ionicons
              name="log-in-outline"
              size={20}
              color={theme.buttonPrimaryText}
              style={{ marginRight: 8 }}
            />
            <Text
              style={[
                styles.actionButtonText,
                { color: theme.buttonPrimaryText },
              ]}
            >
              Go to Log In Screen
            </Text>
          </TouchableOpacity>

          {/* Contact Support Footer */}
          <View style={styles.supportContainer}>
            <Ionicons
              name="help-circle-outline"
              size={18}
              color={theme.textMuted}
            />
            <Text style={[styles.supportText, { color: theme.textMuted }]}>
              For account concerns, contact the Super Administrator at{" "}
              <Text style={{ fontWeight: "600", color: theme.textSecondary }}>
                superadmin@stiwnu.edu.ph
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 22,
    justifyContent: "center",
  },
  topSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  card: {
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    elevation: 6,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  noticeBox: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  noticeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 8,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  stepNumberBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
    marginRight: 14,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 3,
  },
  stepDescription: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "500",
  },
  actionButton: {
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    elevation: 3,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  supportContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    paddingHorizontal: 10,
  },
  supportText: {
    fontSize: 11.5,
    lineHeight: 16,
    marginLeft: 6,
    textAlign: "center",
    flex: 1,
  },
});
