import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  BackHandler,
} from "react-native";

import {
  Ionicons,
  Feather,
  MaterialCommunityIcons,
} from "@expo/vector-icons";

import { useRouter, useLocalSearchParams } from "expo-router";
import { useThemeColors } from "../hooks/useThemeColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cancelReservation } from "../data/store";

export default function ReservationDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useThemeColors();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const params = useLocalSearchParams();
  const reservationId = (params.id as string) || "";
  const queuePosition = params.queuePosition ? String(params.queuePosition) : "1";
  const estimatedWait = params.estimatedWait ? String(params.estimatedWait) : "Waiting for return";
  const studentsAhead = Math.max(0, Number(queuePosition) - 1);
  const isAvailable = params.available === 'true' || params.available === 'Available';
  const dateReserved = (params.dateReserved as string) || (params.pickupDate as string) || (params.date as string) || "Not specified";

  const handleCancel = () => {
    Alert.alert(
      "Cancel Reservation?",
      `Are you sure you want to cancel your reservation for "${params.title}"? You will lose your current spot in the 1st-come 1st-served queue.`,
      [
        { text: "Keep Reservation", style: "cancel" },
        {
          text: "Cancel Reservation",
          style: "destructive",
          onPress: async () => {
            setIsSubmitting(true);
            try {
              if (reservationId) {
                await cancelReservation(reservationId);
              }
              Alert.alert("Reservation Cancelled", `Your reservation for "${params.title}" has been cancelled.`);
              router.back();
            } catch (err) {
              console.warn("Failed to cancel reservation:", err);
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleBorrowNow = () => {
    router.push({
      pathname: "/borrow",
      params: {
        title: params.title,
        author: params.author,
        isbn: params.isbn || "",
        department: params.department || params.category || "Circulation",
        action: "Borrow",
      },
    });
  };

  const handleBack = useCallback(() => {
    if (params.from === "notifications" || String(params.from) === "notifications") {
      router.replace("/notifications");
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  }, [params.from, router]);

  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };

    const backSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );

    return () => backSubscription.remove();
  }, [handleBack]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 16, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder, borderBottomWidth: 1 }]}>
        <TouchableOpacity
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDarkMode ? theme.accentGold : theme.accentBlue}
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          Reservation Details
        </Text>

        <View style={{ width: 24 }} />
      </View>

      {/* BOOK CARD */}
      <View style={[styles.bookCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
        <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? "rgba(168, 85, 247, 0.15)" : "#F3E8FF", borderColor: isDarkMode ? "rgba(168, 85, 247, 0.3)" : "#D8B4FE", borderWidth: 1 }]}>
          <MaterialCommunityIcons
            name="book-clock-outline"
            size={36}
            color="#A855F7"
          />
        </View>

        <Text style={[styles.bookTitle, { color: theme.textPrimary }]}>
          {params.title}
        </Text>

        <Text style={[styles.author, { color: theme.textSecondary }]}>
          by {params.author}
        </Text>

        <View style={[
          styles.queueBadge,
          isAvailable
            ? { backgroundColor: "rgba(16, 185, 129, 0.15)", borderColor: "#10B981" }
            : { backgroundColor: isDarkMode ? "rgba(168, 85, 247, 0.15)" : "#F3E8FF", borderColor: isDarkMode ? "#A855F7" : "#D8B4FE" }
        ]}>
          <Text style={[
            styles.queueBadgeText,
            { color: isAvailable ? "#10B981" : isDarkMode ? "#C084FC" : "#7C3AED", fontWeight: "800" }
          ]}>
            {isAvailable ? "READY FOR PICKUP" : `WAITLIST #${queuePosition}`}
          </Text>
        </View>
      </View>

      {/* 24-HOUR CLAIM WINDOW ALERT (If returned copy is available) */}
      {isAvailable && (
        <View style={[styles.alertCard, { backgroundColor: "rgba(16, 185, 129, 0.12)", borderColor: "#10B981" }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Ionicons name="checkmark-circle-outline" size={22} color="#10B981" />
            <Text style={{ fontSize: 15, fontWeight: "800", color: "#10B981" }}>
              Book Returned & Ready for Pickup!
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: theme.textPrimary, lineHeight: 20, marginBottom: 14 }}>
            A physical copy has been returned and is reserved exclusively for you at the library desk. Please claim or borrow it within the 24-hour pickup hold window.
          </Text>
          <TouchableOpacity
            style={styles.claimButton}
            onPress={handleBorrowNow}
            activeOpacity={0.85}
          >
            <Ionicons name="book-outline" size={18} color="#FFFFFF" />
            <Text style={styles.claimButtonText}>Claim Copy / Borrow Now</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* RESERVATION DETAILS & 1ST-COME 1ST-SERVED INFO CARD */}
      <View style={[styles.statusCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="receipt-outline" size={20} color={isDarkMode ? "#FCD34D" : theme.accentBlue} />
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            Reservation Information
          </Text>
        </View>

        {/* Date Reserved */}
        <View style={styles.infoRow}>
          <View style={[styles.infoIconBox, { backgroundColor: isDarkMode ? "rgba(59, 130, 246, 0.15)" : "#EFF6FF" }]}>
            <Ionicons name="calendar-outline" size={18} color={isDarkMode ? "#60A5FA" : "#2563EB"} />
          </View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Date Reserved</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
              {dateReserved}
            </Text>
          </View>
        </View>

        {/* Queue Policy: 1st-Come, 1st-Served */}
        <View style={styles.infoRow}>
          <View style={[styles.infoIconBox, { backgroundColor: isDarkMode ? "rgba(168, 85, 247, 0.15)" : "#F3E8FF" }]}>
            <MaterialCommunityIcons name="podium-gold" size={18} color="#A855F7" />
          </View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Queue Method</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
              1st-Come, 1st-Served Waitlist
            </Text>
            <Text style={[styles.infoSubtext, { color: theme.textSecondary }]}>
              The 1st to reserve is 1st in line to borrow when this book is returned.
            </Text>
          </View>
        </View>

        {/* Current Waitlist Position */}
        <View style={styles.infoRow}>
          <View style={[styles.infoIconBox, { backgroundColor: isDarkMode ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7" }]}>
            <Ionicons name="people-outline" size={18} color={isDarkMode ? "#FBBF24" : "#D97706"} />
          </View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Queue Spot</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
              #{queuePosition} {studentsAhead === 0 ? "(You are next in line!)" : `(${studentsAhead} ahead)`}
            </Text>
          </View>
        </View>

        {/* Reservation Duration & Hold Window */}
        <View style={styles.infoRow}>
          <View style={[styles.infoIconBox, { backgroundColor: isDarkMode ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5" }]}>
            <Ionicons name="time-outline" size={18} color={isDarkMode ? "#34D399" : "#059669"} />
          </View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Reservation Duration</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
              Active Until Return + 24h Hold Window
            </Text>
            <Text style={[styles.infoSubtext, { color: theme.textSecondary }]}>
              Once returned, a 24-hour pickup hold window is granted exclusively to you before offering to the next student.
            </Text>
          </View>
        </View>

        {/* Automatic System Notification */}
        <View style={[styles.infoRow, { marginBottom: 0 }]}>
          <View style={[styles.infoIconBox, { backgroundColor: isDarkMode ? "rgba(236, 72, 153, 0.15)" : "#FDF2F8" }]}>
            <Ionicons name="notifications-outline" size={18} color={isDarkMode ? "#F472B6" : "#DB2777"} />
          </View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>System Notification</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
              Automatic Return Alert
            </Text>
            <Text style={[styles.infoSubtext, { color: theme.textSecondary }]}>
              The BookHive system automatically notifies you via app notification the moment this copy is returned to the library.
            </Text>
          </View>
        </View>
      </View>

      {/* BOOK INFO */}
      <View style={[styles.detailsCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginBottom: 16 }]}>
          Book Information
        </Text>

        {params.category ? (
          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Category</Text>
            <Text style={[styles.value, { color: theme.textPrimary }]}>{params.category}</Text>
          </View>
        ) : null}

        {params.department ? (
          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Department</Text>
            <Text style={[styles.value, { color: theme.textPrimary }]}>{params.department}</Text>
          </View>
        ) : null}

        {params.isbn ? (
          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>ISBN</Text>
            <Text style={[styles.value, { color: theme.textPrimary }]}>{params.isbn}</Text>
          </View>
        ) : null}

        {params.shelf ? (
          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Shelf / Call Number</Text>
            <Text style={[styles.value, { color: theme.textPrimary }]}>{params.shelf}</Text>
          </View>
        ) : null}

        {params.language ? (
          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Language</Text>
            <Text style={[styles.value, { color: theme.textPrimary }]}>{params.language}</Text>
          </View>
        ) : null}

        {params.pages ? (
          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Pages</Text>
            <Text style={[styles.value, { color: theme.textPrimary }]}>{params.pages}</Text>
          </View>
        ) : null}
      </View>

      {/* DESCRIPTION */}
      {params.description ? (
        <View style={[styles.descriptionCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginBottom: 12 }]}>
            Description
          </Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {params.description}
          </Text>
        </View>
      ) : null}

      {/* ACTION BUTTON */}
      <TouchableOpacity
        style={[styles.cancelButton, isSubmitting && { opacity: 0.6 }]}
        disabled={isSubmitting}
        onPress={handleCancel}
        activeOpacity={0.85}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.cancelButtonText}>
            Cancel Reservation
          </Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },

  bookCard: {
    margin: 20,
    marginBottom: 16,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
  },

  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },

  bookTitle: {
    marginTop: 18,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },

  author: {
    marginTop: 6,
    fontSize: 14,
  },

  queueBadge: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
  },

  queueBadgeText: {
    fontSize: 13,
  },

  alertCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
  },

  claimButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#10B981",
    borderRadius: 14,
    paddingVertical: 14,
  },

  claimButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  statusCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },

  infoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
  },

  infoContent: {
    flex: 1,
  },

  infoLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },

  infoValue: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },

  infoSubtext: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },

  detailsCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  label: {
    fontSize: 14,
  },

  value: {
    fontWeight: "600",
    fontSize: 14,
    maxWidth: "60%",
    textAlign: "right",
  },

  descriptionCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },

  description: {
    lineHeight: 22,
    fontSize: 14,
  },

  cancelButton: {
    marginTop: 12,
    marginHorizontal: 20,
    height: 54,
    backgroundColor: "#DC2626",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },

  cancelButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
});