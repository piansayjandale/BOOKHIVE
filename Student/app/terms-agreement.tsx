import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimatedScreen from "../components/AnimatedScreen";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../data/AuthContext";
import { useThemeColors } from "../hooks/useThemeColors";
import { getTermsAccepted, getTermsAcceptedDate } from "../data/store";
import { TERMS_AND_AGREEMENT } from "../data/termsContent";

export default function TermsAgreementScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isDarkMode, theme } = useThemeColors();

  const [isAccepted, setIsAccepted] = useState(true);
  const [acceptedDate, setAcceptedDate] = useState<string | null>(null);

  const accountId = user?.studentId || user?.email || user?.id || "";

  useEffect(() => {
    if (accountId) {
      getTermsAccepted(accountId).then((res) => setIsAccepted(res));
      getTermsAcceptedDate(accountId).then((dateStr) => {
        if (dateStr) {
          try {
            const d = new Date(dateStr);
            setAcceptedDate(
              d.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            );
          } catch {
            setAcceptedDate(null);
          }
        }
      });
    }
  }, [accountId]);

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View
        style={[
          styles.header,
          {
            paddingTop: 16 + insets.top,
            backgroundColor: theme.headerBg,
            borderBottomColor: theme.headerBorder,
            borderBottomWidth: 1,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack?.()) {
              router.back();
            } else {
              router.replace("/(tabs)/profile");
            }
          }}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={22} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.headerTitle }]}>
          TERMS & AGREEMENT
        </Text>

        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 18,
          paddingBottom: 40,
        }}
      >
        {/* ACCOUNT STATUS BANNER */}
        <View
          style={[
            styles.statusCard,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.cardBorder,
              shadowColor: theme.shadowColor,
              shadowOpacity: isDarkMode ? 0.3 : 0.05,
            },
          ]}
        >
          <View style={styles.statusTopRow}>
            <View style={styles.statusBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.statusBadgeText}>
                {isAccepted ? "Agreement Active" : "Pending Acceptance"}
              </Text>
            </View>

            <Text style={[styles.studentIdPill, { color: theme.accentGold }]}>
              {user?.studentId || "Student Account"}
            </Text>
          </View>

          <Text style={[styles.statusTitle, { color: theme.textPrimary }]}>
            {user?.fullName || "Student Account"}
          </Text>

          <Text style={[styles.statusSubtitle, { color: theme.textSecondary }]}>
            This account is bound by the official BookHive library policies and circulation regulations.
            {acceptedDate ? ` Recorded on ${acceptedDate}.` : ""}
          </Text>
        </View>

        {/* SECTION TITLE */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.accentGold }]}>
            Library Rules & Regulations
          </Text>
        </View>

        {/* TERMS LIST */}
        <View
          style={[
            styles.termsCard,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.cardBorder,
              shadowColor: theme.shadowColor,
              shadowOpacity: isDarkMode ? 0.3 : 0.05,
            },
          ]}
        >
          {TERMS_AND_AGREEMENT.map((section, sIdx) => {
            const isLast = sIdx === TERMS_AND_AGREEMENT.length - 1;
            return (
              <View
                key={section.id}
                style={[
                  styles.termItem,
                  { borderBottomColor: theme.cardBorder },
                  isLast && { borderBottomWidth: 0, paddingBottom: 6 },
                ]}
              >
                <View style={styles.termTitleRow}>
                  <View
                    style={[
                      styles.termIconWrap,
                      { backgroundColor: isDarkMode ? "#0E1726" : "#F1F5F9" },
                    ]}
                  >
                    <Ionicons
                      name={section.icon as any}
                      size={18}
                      color={theme.accentGold}
                    />
                  </View>
                  <Text style={[styles.termSectionTitle, { color: theme.textPrimary }]}>
                    {section.title}
                  </Text>
                </View>

                <Text style={[styles.termSectionDesc, { color: theme.textSecondary }]}>
                  {section.description}
                </Text>

                <View style={styles.rulesContainer}>
                  {section.rules.map((rule, rIdx) => (
                    <View key={`screen-rule-${section.id}-${rIdx}`} style={styles.ruleRow}>
                      <View
                        style={[styles.ruleBullet, { backgroundColor: theme.accentGold }]}
                      />
                      <Text style={[styles.ruleText, { color: theme.textPrimary }]}>
                        {rule}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>

        {/* NOTICE */}
        <View style={[styles.footerNotice, { borderColor: theme.cardBorder }]}>
          <Ionicons name="information-circle-outline" size={18} color={theme.accentGold} />
          <Text style={[styles.footerNoticeText, { color: theme.textSecondary }]}>
            Policies and penalty schedules are subject to university guidelines. For appeals or inquiries, contact the Library Administration or Super Administrator.
          </Text>
        </View>

        {/* BACK BUTTON */}
        <TouchableOpacity
          style={[styles.returnButton, { backgroundColor: theme.accentGold }]}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.returnButtonText}>Back to Profile</Text>
        </TouchableOpacity>
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  statusCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  statusTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#10B981",
  },
  studentIdPill: {
    fontSize: 12,
    fontWeight: "800",
    fontFamily: "monospace",
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  termsCard: {
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  termItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  termTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 6,
  },
  termIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  termSectionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
  },
  termSectionDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
    fontWeight: "500",
    paddingLeft: 46,
  },
  rulesContainer: {
    gap: 8,
    paddingLeft: 46,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  ruleBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  ruleText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  footerNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    marginBottom: 20,
  },
  footerNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  returnButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  returnButtonText: {
    color: "#080F1E",
    fontSize: 15,
    fontWeight: "800",
  },
});
