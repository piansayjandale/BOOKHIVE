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

import {
  Ionicons,
  Feather,
} from "@expo/vector-icons";

import {
  useRouter,
  useLocalSearchParams,
} from "expo-router";

import {
  addReservation,
  addLibraryPoints,
} from "../data/store";

export default function RequestConfirmation() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();

  const params = useLocalSearchParams();

  const reservationDate =
    (params.reservationDate as string) ||
    new Date().toISOString().split("T")[0];

  const returnDate =
    (params.returnDate as string) ||
    "Not set";

  const studentName =
    (params.studentName as string) ||
    "Student";

  const studentId =
    (params.studentId as string) ||
    "ID not set";

  const department =
    (params.department as string) ||
    "Department not set";

  const action =
    ((params.action as string) === "Borrow"
      ? "Borrow"
      : "Reserve") as 'Borrow' | 'Reserve';
  const isBorrow = action === "Borrow";

  const book = {
    id:
      `${params.title ?? "unknown"}-${Date.now()}`,

    title:
      (params.title as string) ||
      "Unknown Book",

    author:
      (params.author as string) ||
      "Unknown Author",

    isbn:
      (params.isbn as string) ||
      "N/A",

    department,
    studentName,
    studentId,
    date: reservationDate,
    returnDate,
    status: "Pending",
    action,
    studentIDImage: (params.studentIDImage as string) || "",
  };

  const handleConfirm = () => {
    addReservation(book);
    addLibraryPoints(isBorrow ? 50 : 30); // Award 50 pts for borrowing, 30 pts for reserving
    router.replace("/reservations");
  };

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top, height: 70 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder, borderBottomWidth: 1 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
        >
          <Feather
            name="arrow-left"
            size={24}
            color={theme.accentGold}
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          {isBorrow ? 'Borrow Request' : 'Reservation'}
        </Text>

        <View style={{ width: 24 }} />
      </View>

      {/* CARD */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1 }]}>
          <View style={[styles.iconCircle, { backgroundColor: theme.background }]}>
            <Ionicons
              name="book"
              size={42}
              color={theme.accentGold}
            />
          </View>

          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {isBorrow ? 'Confirm Borrow Request' : 'Confirm Reservation'}
          </Text>

          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            You are about to {isBorrow ? 'borrow' : 'reserve'} this book.
          </Text>

          <View style={[styles.bookBox, { backgroundColor: theme.background }]}>
            <Text style={[styles.bookTitle, { color: theme.textPrimary }]}>
              {book.title}
            </Text>

            <Text style={[styles.bookAuthor, { color: theme.textSecondary }]}>
              {book.author}
            </Text>

            <Text style={[styles.bookMeta, { color: theme.textSecondary }]}>
              ISBN: {book.isbn} • {book.department}
            </Text>
          </View>

          <View style={[styles.userBox, { backgroundColor: theme.background }]}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Student</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{book.studentName}</Text>

            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Student ID</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{book.studentId}</Text>

            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Department</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{book.department}</Text>
          </View>

          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                Reservation Date
              </Text>

              <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
                {book.date}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                Return Date
              </Text>

              <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
                {book.returnDate}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                Status
              </Text>

              <Text
                style={[
                  styles.infoValue,
                  {
                    color: "#16A34A",
                  },
                ]}
              >
                Ready for Approval
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: theme.accentGold }]}
            onPress={handleConfirm}
          >
            <Ionicons
              name="checkmark-circle"
              size={22}
              color={isDarkMode ? "#080F1E" : "#FFFFFF"}
            />

            <Text style={[styles.confirmText, { color: isDarkMode ? "#080F1E" : "#FFFFFF" }]}>
              {isBorrow ? 'Confirm Borrow Request' : 'Confirm Reservation'}
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
    backgroundColor: "#F1F5F9",
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },

  header: {
    height: 70,
    backgroundColor: "#001B33",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },

  headerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },

  card: {
    backgroundColor: "#FFFFFF",
    margin: 20,
    borderRadius: 30,
    padding: 25,
    alignItems: "center",
  },

  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#0B5A8E",
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    marginTop: 20,
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
  },

  subtitle: {
    marginTop: 10,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 24,
  },

  bookBox: {
    width: "100%",
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
    padding: 20,
    marginTop: 24,
  },

  bookTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },

  bookMeta: {
    marginTop: 8,
    color: "#475569",
    fontSize: 13,
  },

  userBox: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    padding: 18,
    marginTop: 20,
  },

  bookAuthor: {
    marginTop: 8,
    color: "#64748B",
  },

  infoBox: {
    width: "100%",
    marginTop: 24,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  infoLabel: {
    color: "#64748B",
    fontSize: 14,
  },

  infoValue: {
    color: "#0F172A",
    fontWeight: "700",
  },

  confirmBtn: {
    width: "100%",
    height: 58,
    borderRadius: 18,
    backgroundColor: "#0B5A8E",
    marginTop: 30,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  confirmText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
    marginLeft: 10,
  },
});