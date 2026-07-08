import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";

import {
  Ionicons,
  Feather,
  MaterialCommunityIcons,
} from "@expo/vector-icons";

import { useRouter, useLocalSearchParams } from "expo-router";
import { useThemeColors } from "../hooks/useThemeColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ReservationDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useThemeColors();

  const params = useLocalSearchParams();
  const queuePosition = params.queuePosition ? String(params.queuePosition) : "1";
  const estimatedWait = params.estimatedWait ? String(params.estimatedWait) : "Pending approval";
  const studentsAhead = Math.max(0, Number(queuePosition) - 1);

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 16, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder, borderBottomWidth: 1 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={theme.accentGold}
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          Reservation Details
        </Text>

        <View style={{ width: 24 }} />
      </View>

      {/* BOOK CARD */}
      <View style={[styles.bookCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
        <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? "#3F1B1F" : "#FCE7D6" }]}>
          <MaterialCommunityIcons
            name="book-clock-outline"
            size={34}
            color={theme.accentGold}
          />
        </View>

        <Text style={[styles.bookTitle, { color: theme.textPrimary }]}>
          {params.title}
        </Text>

        <Text style={[styles.author, { color: theme.textSecondary }]}>
          by {params.author}
        </Text>

        <View style={[styles.queueBadge, { backgroundColor: isDarkMode ? "#3A2E12" : "#FEF3C7" }]}>
          <Text style={[styles.queueBadgeText, { color: isDarkMode ? "#FCD34D" : "#92400E" }]}>
            Queue #{queuePosition}
          </Text>
        </View>
      </View>

      {/* STATUS CARD */}
      <View style={[styles.statusCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
          Reservation Status
        </Text>

        <View style={styles.infoRow}>
          <Ionicons
            name="time-outline"
            size={18}
            color={theme.accentGold}
          />

          <Text style={[styles.infoText, { color: theme.textPrimary }]}>
            You are currently #{queuePosition} in the waiting queue
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons
            name="people-outline"
            size={18}
            color={theme.accentGold}
          />

          <Text style={[styles.infoText, { color: theme.textPrimary }]}>
            {studentsAhead} {studentsAhead === 1 ? 'student is' : 'students are'} ahead of you
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Feather
            name="calendar"
            size={18}
            color={theme.accentGold}
          />

          <Text style={[styles.infoText, { color: theme.textPrimary }]}>
            Estimated availability: {estimatedWait}
          </Text>
        </View>
      </View>

      {/* BOOK INFO */}
      <View style={[styles.detailsCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
          Book Information
        </Text>

        <View style={styles.detailRow}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Category
          </Text>

          <Text style={[styles.value, { color: theme.textPrimary }]}>
            {params.category}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Language
          </Text>

          <Text style={[styles.value, { color: theme.textPrimary }]}>
            {params.language}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Pages
          </Text>

          <Text style={[styles.value, { color: theme.textPrimary }]}>
            {params.pages}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Shelf Location
          </Text>

          <Text style={[styles.value, { color: theme.textPrimary }]}>
            {params.shelf}
          </Text>
        </View>
      </View>

      {/* DESCRIPTION */}
      <View style={[styles.descriptionCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
          Description
        </Text>

        <Text style={[styles.description, { color: theme.textSecondary }]}>
          {params.description}
        </Text>
      </View>

      {/* ACTION BUTTON */}
      <TouchableOpacity style={styles.cancelButton}>
        <Text style={styles.cancelButtonText}>
          Cancel Reservation
        </Text>
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
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },

  author: {
    marginTop: 8,
    fontSize: 15,
  },

  queueBadge: {
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
  },

  queueBadgeText: {
    fontWeight: "700",
  },

  statusCard: {
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 18,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  infoText: {
    marginLeft: 12,
    fontSize: 14,
  },

  detailsCard: {
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  label: {
    fontSize: 14,
  },

  value: {
    fontWeight: "600",
    fontSize: 14,
  },

  descriptionCard: {
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
  },

  description: {
    lineHeight: 24,
    fontSize: 14,
  },

  cancelButton: {
    marginTop: 28,
    marginHorizontal: 20,
    height: 58,
    backgroundColor: "#DC2626",
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  cancelButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
});