import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimatedScreen from "../../components/AnimatedScreen";
import {
  Feather,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useThemeColors } from "../../hooks/useThemeColors";

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

  const progressSteps = [
    { label: "Reservation Submitted", completed: true },
    { label: "Added to Waiting Queue", completed: true },
    { label: "Waiting for Book Return", completed: true },
    { label: "Ready for Pickup", completed: false },
    { label: "Borrow Completed", completed: false },
  ];

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: 18 + insets.top, paddingBottom: 18, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder, borderBottomWidth: 1 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={theme.accentGold} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Reservation Details</Text>

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
          <View style={[styles.coverPlaceholder, { backgroundColor: isDarkMode ? "#1E293B" : "#E2E8F0" }]}>
            <MaterialCommunityIcons
              name="book-open-page-variant"
              size={40}
              color={theme.accentGold}
            />
          </View>

          <View style={styles.bookInfoDetails}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Author</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{author}</Text>

            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Category</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{category}</Text>

            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Shelf location</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{shelf}</Text>

            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Rating</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{rating} · {reviews} reviews</Text>

            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Availability</Text>
            <Text style={[styles.badgeText, { color: theme.accentGold }]}>
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
                  step.completed && { backgroundColor: theme.accentGold },
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

        <View style={[styles.currentBorrowCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Text style={[styles.currentBorrowTitle, { color: theme.textPrimary }]}>Current Borrow Information</Text>
          <Text style={[styles.currentBorrowText, { color: theme.textSecondary }]}>
            Current borrower due date:
          </Text>
          <Text style={[styles.currentBorrowDate, { color: theme.textPrimary }]}>{currentBorrowDueDate}</Text>
        </View>

        <View style={[styles.notificationsCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionLabel, { color: theme.textPrimary }]}>Notification Settings</Text>
          <View style={styles.notificationRow}>
            <Text style={[styles.notificationText, { color: theme.textSecondary }]}>Notify me when available</Text>
            <Switch
              value={notifyAvailable}
              onValueChange={setNotifyAvailable}
              thumbColor={notifyAvailable ? theme.accentGold : "#E2E8F0"}
              trackColor={{ false: "#CBD5E1", true: isDarkMode ? "#3E3B1B" : "#FDE68A" }}
            />
          </View>
          <View style={styles.notificationRow}>
            <Text style={[styles.notificationText, { color: theme.textSecondary }]}>Email notification</Text>
            <Switch
              value={notifyEmail}
              onValueChange={setNotifyEmail}
              thumbColor={notifyEmail ? theme.accentGold : "#E2E8F0"}
              trackColor={{ false: "#CBD5E1", true: isDarkMode ? "#3E3B1B" : "#FDE68A" }}
            />
          </View>
          <View style={styles.notificationRow}>
            <Text style={[styles.notificationText, { color: theme.textSecondary }]}>SMS notification</Text>
            <Switch
              value={notifySMS}
              onValueChange={setNotifySMS}
              thumbColor={notifySMS ? theme.accentGold : "#E2E8F0"}
              trackColor={{ false: "#CBD5E1", true: isDarkMode ? "#3E3B1B" : "#FDE68A" }}
            />
          </View>
        </View>

        <View style={[styles.qrCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={styles.qrHeader}>
            <Text style={[styles.qrTitle, { color: theme.textPrimary }]}>Reservation QR Code</Text>
            <MaterialCommunityIcons
              name="qrcode-scan"
              size={22}
              color={theme.accentGold}
            />
          </View>
          <View style={[styles.qrPlaceholder, { backgroundColor: theme.background, borderColor: theme.cardBorder }]}>
            <Text style={[styles.qrPlaceholderText, { color: theme.textSecondary }]}>QR CODE</Text>
          </View>
          <Text style={[styles.qrDescription, { color: theme.textSecondary }]}>
            Show this code to the librarian for faster verification and pickup.
          </Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={() => router.push('/reservations')}
          >
            <Text style={[styles.cancelButtonText, { color: "#FFFFFF" }]}>Cancel Reservation</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton, { backgroundColor: theme.accentGold }]}
            onPress={() => router.push('/search')}
          >
            <Text style={[styles.secondaryButtonText, { color: isDarkMode ? "#080F1E" : "#FFFFFF" }]}>Find Similar Books</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
});
