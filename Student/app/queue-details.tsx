import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimatedScreen from "../components/AnimatedScreen";
import { useThemeColors } from "../hooks/useThemeColors";

import { Ionicons } from "@expo/vector-icons";

import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";

export default function QueueDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();
  const params = useLocalSearchParams();

  // Clean up category string from bracket representation
  const cleanCategory = typeof params.category === "string"
    ? params.category.replace(/[\[\]'"\\]/g, "")
    : params.category || "General";

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top, height: 70 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
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
          Queue Details
        </Text>

        <View style={{ width: 24 }} />
      </View>

      {/* CONTENT */}
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={[styles.bookCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Text style={[styles.bookTitle, { color: theme.accentGold }]}>
            {params.title}
          </Text>

          <Text style={[styles.author, { color: theme.textSecondary }]}>
            by {params.author}
          </Text>

          <View style={[styles.queueBox, { backgroundColor: isDarkMode ? "rgba(252, 211, 77, 0.05)" : "rgba(11, 90, 142, 0.05)", borderColor: theme.cardBorder }]}>
            <Text style={[styles.queueLabel, { color: theme.accentGold }]}>
              Waiting List Position
            </Text>

            <Text style={[styles.queueNumber, { color: theme.accentGold }]}>
              #{params.queuePosition}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
              Estimated Wait:
            </Text>

            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
              {params.estimatedWait}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
              Category:
            </Text>

            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
              {cleanCategory}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
              Shelf:
            </Text>

            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
              {params.shelf}
            </Text>
          </View>

          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {params.description}
          </Text>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#111A2E",
  },

  headerTitle: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  bookCard: {
    backgroundColor: "#111A2E",
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: "#1E293B",
  },

  bookTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FCD34D",
  },

  author: {
    marginTop: 6,
    fontSize: 15,
    color: "#94A3B8",
  },

  queueBox: {
    marginTop: 24,
    backgroundColor: "rgba(252, 211, 77, 0.05)",
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(252, 211, 77, 0.2)",
  },

  queueLabel: {
    fontSize: 14,
    color: "#FCD34D",
    fontWeight: "700",
  },

  queueNumber: {
    marginTop: 8,
    fontSize: 42,
    fontWeight: "900",
    color: "#FCD34D",
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
  },

  infoLabel: {
    fontWeight: "700",
    color: "#94A3B8",
  },

  infoValue: {
    color: "#F8FAFC",
    fontWeight: "600",
  },

  description: {
    marginTop: 28,
    fontSize: 14,
    lineHeight: 22,
    color: "#CBD5E1",
  },
});