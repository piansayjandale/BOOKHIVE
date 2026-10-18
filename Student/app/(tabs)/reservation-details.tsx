import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  BackHandler,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimatedScreen from "../../components/AnimatedScreen";
import {
  Feather,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useThemeColors } from "../../hooks/useThemeColors";
import { cancelReservation, getUpcomingReservations } from "../../data/store";

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const formatDate = (date: Date) => {
  const month = monthNames[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}, ${year}`;
};

export default function ReservationDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useThemeColors();

  const title = (params.title as string) || "Deep Learning Essentials";
  const author = (params.author as string) || "Dr. Samantha Reed";
  const category = (params.category as string) || "AI / Computer Science";
  const description =
    (params.description as string) ||
    "A detailed guide to modern deep learning techniques, neural architectures, and practical applications for academic research.";
  const shelf = (params.shelf as string) || "Shelf C-208, 3rd Floor";
  const rating = (params.rating as string) || "4.9";
  const reviews = (params.reviews as string) || "87";
  const available = (params.available as string) === "true";
  const queuePosition = Number(params.queuePosition as string) || 1;
  const studentsAhead = Math.max(queuePosition - 1, 0);
  const estimatedWait = (params.estimatedWait as string) || "7 days";
  const currentBorrowDueDate =
    (params.currentBorrowDueDate as string) ||
    formatDate(new Date(Date.now() + 4 * 24 * 60 * 60 * 1000));
  const [notifyAvailable, setNotifyAvailable] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySMS, setNotifySMS] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const reservationId =
    (params.id as string) ||
    (params.reservationId as string) ||
    (params.transactionId as string) ||
    "";

  const handleCancelPress = () => {
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    try {
      setIsCancelling(true);
      const allRes = getUpcomingReservations();
      const matched = allRes.find(
        (r) =>
          (reservationId && String(r.id) === String(reservationId)) ||
          (r.title && r.title.toLowerCase().trim() === title.toLowerCase().trim())
      );
      const targetId = reservationId || matched?.id || "";

      if (targetId) {
        await cancelReservation(targetId);
      }
      setIsCancelling(false);
      setShowCancelModal(false);
      if (params.from === "notifications" || String(params.from) === "notifications") {
        router.replace("/notifications");
      } else {
        router.replace("/(tabs)/reservations");
      }
    } catch (error: any) {
      setIsCancelling(false);
      setShowCancelModal(false);
      Alert.alert("Cancellation Notice", error?.message || "Failed to cancel reservation.");
    }
  };

  const progressSteps = [
    { label: "Reservation Submitted", completed: true },
    { label: "Added to Waiting Queue", completed: true },
    { label: "Book Copy Available", completed: available },
    { label: "Ready for Pickup (1-Day Timer)", completed: available },
    { label: "Borrow Completed", completed: false },
  ];

  const handleBack = useCallback(() => {
    if (params.from === "notifications" || String(params.from) === "notifications") {
      router.replace("/notifications");
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/reservations");
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
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: 18 + insets.top, paddingBottom: 18, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder, borderBottomWidth: 1 }]}>
        <TouchableOpacity onPress={handleBack}>
          <Feather name="arrow-left" size={22} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.headerTitle }]}>Reservation Details</Text>

        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.sectionHeading}>
          <Text style={[styles.bookTitle, { color: theme.textPrimary }]}>{title}</Text>
          <Text style={[styles.bookSubtitle, { color: theme.textSecondary }]}>{category}</Text>
        </View>

        <View style={[styles.bookInfoCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={[styles.coverPlaceholder, { backgroundColor: isDarkMode ? "#1E293B" : theme.bookCoverBg }]}>
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: isDarkMode ? "rgba(255, 215, 0, 0.18)" : "#FEF08A",
                borderColor: isDarkMode ? "rgba(255, 215, 0, 0.45)" : "#FDE047",
                borderWidth: 1.5,
                justifyContent: "center",
                alignItems: "center",
                shadowColor: "#FCD400",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3,
                elevation: 2,
              }}
            >
              <MaterialCommunityIcons
                name="book-open-page-variant"
                size={34}
                color={isDarkMode ? theme.accentGold : "#0274BB"}
              />
            </View>
          </View>

          <View style={styles.bookInfoDetails}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Author</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{author}</Text>

            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Category</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{category}</Text>

            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Call Number</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{shelf}</Text>

            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Availability</Text>
            <Text style={[styles.badgeText, { color: isDarkMode ? theme.accentGold : theme.accentBlue }]}>
              {available ? 'Available' : 'Currently Borrowed'}
            </Text>
          </View>
        </View>

        <View style={[styles.descriptionSection, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionLabel, { color: theme.textPrimary }]}>About this Reservation</Text>
          <Text style={[styles.descriptionText, { color: theme.textSecondary }]}>{description}</Text>
        </View>

        <View style={[styles.statusCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Text style={[styles.statusTitle, { color: theme.textPrimary }]}>Your Position in Queue</Text>
          <Text style={[styles.queueNumber, { color: theme.textPrimary }]}>#{queuePosition}</Text>

          <View style={styles.queueDetailsRow}>
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Students ahead</Text>
              <Text style={[styles.detailValue, { color: theme.textPrimary }]}>{studentsAhead}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Estimated wait</Text>
              <Text style={[styles.detailValue, { color: theme.textPrimary }]}>{estimatedWait}</Text>
            </View>
          </View>

          <View style={[styles.progressBarBackground, { backgroundColor: isDarkMode ? "#1E293B" : "#E2E8F0" }]}>
            {progressSteps.map((step, index) => (
              <View
                key={index}
                style={[
                  styles.progressBlock,
                  { backgroundColor: isDarkMode ? "#1E293B" : "#E2E8F0" },
                  step.completed && { backgroundColor: isDarkMode ? theme.accentGold : theme.accentBlue },
                ]}
              />
            ))}
          </View>

          <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>Queue Progress</Text>
        </View>

        <View style={[styles.timelineCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Text style={[styles.timelineTitle, { color: theme.textPrimary }]}>Reservation Timeline</Text>

          {progressSteps.map((step, index) => (
            <View key={index} style={styles.timelineRow}>
              <Text style={[styles.timelineIcon, { color: theme.textPrimary }]}>
                {step.completed ? "✓" : index === 2 ? "⏳" : "⬜"}
              </Text>
              <Text
                style={[
                  styles.timelineText,
                  { color: theme.textSecondary },
                  step.completed ? [styles.timelineTextActive, { color: theme.textPrimary }] : null,
                ]}
              >
                {step.label}
              </Text>
            </View>
          ))}
        </View>

        {available && (
          <View style={[styles.timelineCard, { backgroundColor: "rgba(16, 185, 129, 0.12)", borderColor: "#10B981" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <MaterialCommunityIcons name="clock-alert-outline" size={20} color="#10B981" />
              <Text style={{ fontSize: 14, fontWeight: "800", color: "#10B981" }}>
                1-Day Claim Window Active
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: theme.textPrimary, lineHeight: 18 }}>
              A physical copy of this book is ready for you at the library desk! You have 24 hours to claim it. If you do not claim or borrow it within 24 hours, this reservation will be automatically voided and transferred to the next student in the queue.
            </Text>
          </View>
        )}

        <View style={[styles.currentBorrowCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Text style={[styles.currentBorrowTitle, { color: theme.textPrimary }]}>Current Borrow Information</Text>
          <Text style={[styles.currentBorrowText, { color: theme.textSecondary }]}>
            Current borrower due date:
          </Text>
          <Text style={[styles.currentBorrowDate, { color: theme.textPrimary }]}>{currentBorrowDueDate}</Text>
        </View>


        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={handleCancelPress}
            activeOpacity={0.8}
          >
            <Text style={[styles.cancelButtonText, { color: "#FFFFFF" }]}>Cancel Reservation</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton, { backgroundColor: isDarkMode ? theme.accentGold : theme.buttonPrimaryBg, borderColor: !isDarkMode ? theme.buttonPrimaryBorder : undefined }]}
            onPress={() => router.push('/search')}
          >
            <Text style={[styles.secondaryButtonText, { color: isDarkMode ? "#080F1E" : theme.buttonPrimaryText, fontWeight: "800" }]}>Find Similar Books</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* CANCEL CONFIRMATION POPUP MODAL */}
      <Modal
        visible={showCancelModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!isCancelling) setShowCancelModal(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              if (!isCancelling) setShowCancelModal(false);
            }}
          />

          <View
            style={[
              styles.cancelModalCard,
              {
                backgroundColor: isDarkMode ? "#111A2E" : "#FFFFFF",
                borderColor: isDarkMode ? "#24334C" : "#E2E8F0",
              },
            ]}
          >
            {/* Warning Icon Badge */}
            <View style={styles.modalIconContainer}>
              <View style={styles.modalIconCircle}>
                <MaterialCommunityIcons
                  name="calendar-remove-outline"
                  size={32}
                  color="#EF4444"
                />
              </View>
            </View>

            {/* Prompt Question */}
            <Text
              style={[
                styles.modalQuestionText,
                { color: isDarkMode ? "#FFFFFF" : "#0F172A" },
              ]}
            >
              Are you sure to cancel this?
            </Text>

            {/* Book Title & Description */}
            <Text
              style={[
                styles.modalBookTitle,
                { color: isDarkMode ? theme.accentGold : theme.accentBlue },
              ]}
              numberOfLines={2}
            >
              {title}
            </Text>

            <Text
              style={[
                styles.modalWarningDesc,
                { color: isDarkMode ? "#94A3B8" : "#64748B" },
              ]}
            >
              This action will release your place in queue #{queuePosition} and cancel this reservation request.
            </Text>

            {/* Action Buttons: Keep vs Confirm Cancel */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.keepBtn,
                  {
                    backgroundColor: isDarkMode ? "#1E293B" : "#F1F5F9",
                    borderColor: isDarkMode ? "#334155" : "#CBD5E1",
                  },
                ]}
                disabled={isCancelling}
                onPress={() => setShowCancelModal(false)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.keepBtnText,
                    { color: isDarkMode ? "#E2E8F0" : "#475569" },
                  ]}
                >
                  No, Keep It
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.confirmCancelBtn]}
                disabled={isCancelling}
                onPress={handleConfirmCancel}
                activeOpacity={0.8}
              >
                {isCancelling ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmCancelBtnText}>Yes, Cancel</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontWeight: "800",
    fontSize: 16,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionHeading: {
    marginBottom: 20,
  },
  bookTitle: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 6,
  },
  bookSubtitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  bookInfoCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    gap: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  coverPlaceholder: {
    width: 88,
    height: 116,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  bookInfoDetails: {
    flex: 1,
    justifyContent: "space-between",
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 12,
  },
  descriptionSection: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4,
  },
  badgeText: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "800",
  },
  statusCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 12,
  },
  queueNumber: {
    fontSize: 48,
    fontWeight: "900",
    marginBottom: 14,
  },
  queueDetailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  detailItem: {
    flex: 1,
    paddingRight: 10,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  detailValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "800",
  },
  progressBarBackground: {
    flexDirection: "row",
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBlock: {
    flex: 1,
  },
  progressBlockCompleted: {
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  timelineCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 16,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  timelineIcon: {
    width: 24,
    fontSize: 14,
    marginRight: 10,
    fontWeight: "800",
  },
  timelineText: {
    fontSize: 14,
  },
  timelineTextActive: {
    fontWeight: "700",
  },
  currentBorrowCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  currentBorrowTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
  },
  currentBorrowText: {
    fontSize: 14,
    marginBottom: 6,
  },
  currentBorrowDate: {
    fontSize: 15,
    fontWeight: "800",
  },
  notificationsCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 14,
  },
  notificationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  notificationText: {
    fontSize: 14,
    flex: 1,
    marginRight: 12,
  },
  qrCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  qrHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  qrPlaceholder: {
    height: 180,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  qrPlaceholderText: {
    fontSize: 14,
    fontWeight: "700",
  },
  qrDescription: {
    fontSize: 13,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#EF4444",
  },
  secondaryButton: {
  },
  cancelButtonText: {
    fontWeight: "800",
  },
  secondaryButtonText: {
    fontWeight: "800",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  cancelModalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  modalIconContainer: {
    marginBottom: 16,
    alignItems: "center",
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(239, 68, 68, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalQuestionText: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  modalBookTitle: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  modalWarningDesc: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 24,
    paddingHorizontal: 6,
  },
  modalActionsRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  keepBtn: {
    borderWidth: 1,
  },
  keepBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  confirmCancelBtn: {
    backgroundColor: "#EF4444",
  },
  confirmCancelBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
