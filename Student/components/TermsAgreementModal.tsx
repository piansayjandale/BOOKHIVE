import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../data/AuthContext";
import { useThemeColors } from "../hooks/useThemeColors";
import { getTermsAccepted, setTermsAccepted } from "../data/store";
import { TERMS_AND_AGREEMENT } from "../data/termsContent";
import { useRouter } from "expo-router";

interface TermsAgreementModalProps {
  visible?: boolean;
  onClose?: () => void;
  isViewOnly?: boolean;
}

export default function TermsAgreementModal({
  visible: controlledVisible,
  onClose,
  isViewOnly = false,
}: TermsAgreementModalProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { isDarkMode, theme } = useThemeColors();

  const [visible, setVisible] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const accountId = user?.studentId || user?.email || user?.id || "";

  useEffect(() => {
    if (controlledVisible !== undefined) {
      setVisible(controlledVisible);
      return;
    }

    // Auto-check if terms have been accepted for this specific student account
    if (!isViewOnly && accountId) {
      let isMounted = true;
      getTermsAccepted(accountId).then((accepted) => {
        if (isMounted) {
          setVisible(!accepted);
        }
      });
      return () => {
        isMounted = false;
      };
    }
  }, [controlledVisible, accountId, isViewOnly]);

  const handleAccept = async () => {
    if (!agreed) {
      Alert.alert(
        "Agreement Required",
        "Please check the box confirming you have read and agreed to the BookHive Terms & Agreement."
      );
      return;
    }

    try {
      setSubmitting(true);
      if (accountId) {
        await setTermsAccepted(accountId);
      }
      setVisible(false);
      onClose?.();
    } catch (err) {
      console.warn("Error accepting terms:", err);
      Alert.alert("Error", "Could not save your agreement. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      "Decline Terms & Agreement",
      "Accepting the BookHive library terms is mandatory to utilize borrowing, reservations, and reading services. Declining will sign you out of this session.",
      [
        { text: "Go Back", style: "cancel" },
        {
          text: "Decline & Sign Out",
          style: "destructive",
          onPress: async () => {
            setVisible(false);
            await logout();
            router.replace("/login");
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {
        if (isViewOnly) {
          setVisible(false);
          onClose?.();
        } else {
          handleDecline();
        }
      }}
    >
      <View style={[styles.modalOverlay, { backgroundColor: isDarkMode ? "rgba(3, 7, 18, 0.85)" : "rgba(15, 23, 42, 0.55)" }]}>
        <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          {/* HEADER */}
          <View style={[styles.headerContainer, { borderBottomColor: theme.cardBorder }]}>
            <View style={[styles.badgePill, { backgroundColor: isDarkMode ? "rgba(234, 179, 8, 0.12)" : "#FEF9C3", borderColor: isDarkMode ? "rgba(234, 179, 8, 0.3)" : "#FDE047", borderWidth: 1 }]}>
              <Ionicons name="shield-checkmark" size={16} color={isDarkMode ? theme.accentGold : "#854D0E"} />
              <Text style={[styles.badgeText, { color: isDarkMode ? theme.accentGold : "#854D0E" }]}>
                OFFICIAL LIBRARY POLICY
              </Text>
            </View>

            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              Terms & Agreement
            </Text>

            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              {user?.fullName ? `Account: ${user.fullName} (${user.studentId || "Student"})` : "BookHive Circulation & Facility Regulations"}
            </Text>
          </View>

          {/* SCROLLABLE TERMS BODY */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            <View style={[styles.introBox, { backgroundColor: isDarkMode ? "#0A1224" : "#F0F7FF", borderColor: isDarkMode ? theme.cardBorder : "rgba(2, 116, 187, 0.20)" }]}>
              <Ionicons name="information-circle-outline" size={18} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
              <Text style={[styles.introText, { color: theme.textSecondary }]}>
                Welcome to BookHive. As a registered student, your borrowing privileges and access to physical/digital collections are subject to the following institutional agreements. Please review carefully.
              </Text>
            </View>

            {TERMS_AND_AGREEMENT.map((section) => (
              <View key={section.id} style={[styles.sectionBlock, { borderBottomColor: isDarkMode ? "#1A253C" : "rgba(2, 116, 187, 0.10)" }]}>
                <View style={styles.sectionHeaderRow}>
                  <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? "#141D30" : "#EFF6FF" }]}>
                    <Ionicons name={section.icon as any} size={18} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: isDarkMode ? theme.textPrimary : "#0B1A2C" }]}>
                    {section.title}
                  </Text>
                </View>

                <Text style={[styles.sectionDesc, { color: theme.textSecondary }]}>
                  {section.description}
                </Text>

                <View style={styles.rulesList}>
                  {section.rules.map((rule, idx) => (
                    <View key={`rule-${section.id}-${idx}`} style={styles.ruleItem}>
                      <View style={[styles.ruleBullet, { backgroundColor: isDarkMode ? theme.accentGold : "#FCD400" }]} />
                      <Text style={[styles.ruleText, { color: theme.textPrimary }]}>
                        {rule}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>

          {/* FOOTER ACTIONS */}
          <View style={[styles.footerContainer, { borderTopColor: theme.cardBorder }]}>
            {!isViewOnly ? (
              <>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  activeOpacity={0.8}
                  onPress={() => setAgreed(!agreed)}
                >
                  <View style={[styles.checkbox, agreed && { backgroundColor: isDarkMode ? theme.accentGold : "#FCD400", borderColor: isDarkMode ? theme.accentGold : "#EAB308" }]}>
                    {agreed && <Ionicons name="checkmark" size={16} color={isDarkMode ? "#000000" : "#0B1A2C"} />}
                  </View>
                  <Text style={[styles.checkboxLabel, { color: theme.textPrimary }]}>
                    I have read, understood, and accept all terms, library regulations, and penalty policies.
                  </Text>
                </TouchableOpacity>

                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[styles.declineBtn, { backgroundColor: isDarkMode ? "transparent" : "#FFFFFF", borderColor: isDarkMode ? "#374151" : "#CBD5E1" }]}
                    onPress={handleDecline}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.declineBtnText, { color: theme.textSecondary }]}>Decline</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.acceptBtn,
                      {
                        backgroundColor: agreed
                          ? (isDarkMode ? theme.accentGold : "#FCD400")
                          : (isDarkMode ? "#2D3748" : "#E2E8F0"),
                        borderColor: agreed
                          ? (isDarkMode ? theme.accentGold : "#EAB308")
                          : "transparent",
                        borderWidth: agreed ? 1 : 0,
                      },
                    ]}
                    onPress={handleAccept}
                    disabled={!agreed || submitting}
                    activeOpacity={0.8}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color={isDarkMode ? "#000000" : "#0B1A2C"} />
                    ) : (
                      <Text style={[styles.acceptBtnText, { color: agreed ? (isDarkMode ? "#000000" : "#0B1A2C") : (isDarkMode ? "#9CA3AF" : "#94A3B8") }]}>
                        I Agree & Continue
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: isDarkMode ? theme.accentGold : "#FCD400" }]}
                onPress={() => {
                  setVisible(false);
                  onClose?.();
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.closeBtnText, { color: isDarkMode ? "#000000" : "#0B1A2C" }]}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(3, 7, 18, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    height: "90%",
    borderRadius: 24,
    borderWidth: 1.5,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    alignItems: "center",
    borderBottomWidth: 1,
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    fontWeight: "500",
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  introBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    marginBottom: 16,
  },
  introText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  sectionBlock: {
    paddingBottom: 18,
    marginBottom: 16,
    borderBottomWidth: 1,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
  },
  sectionDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
    fontWeight: "500",
  },
  rulesList: {
    gap: 8,
    paddingLeft: 4,
  },
  ruleItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
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
    fontWeight: "400",
  },
  footerContainer: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#94A3B8",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  btnRow: {
    flexDirection: "row",
    gap: 12,
  },
  declineBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  declineBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  acceptBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptBtnText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  closeBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "800",
  },
});
