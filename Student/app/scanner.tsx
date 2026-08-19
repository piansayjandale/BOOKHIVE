import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimatedScreen from "../components/AnimatedScreen";

import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeColors } from "../hooks/useThemeColors";

export default function ScannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useThemeColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualInput, setManualInput] = useState("");

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    // Clean data payload
    let targetPayload = data.trim();
    if (targetPayload.startsWith("bookhive://student/")) {
      targetPayload = targetPayload.replace("bookhive://student/", "");
    }

    try {
      // Check if it's a JSON payload
      if (targetPayload.startsWith("{")) {
        const parsed = JSON.parse(targetPayload);
        if (parsed.qrCode || parsed.qr || parsed.idNumber || parsed.studentId || parsed.payload) {
          targetPayload = parsed.qrCode || parsed.qr || parsed.idNumber || parsed.studentId || parsed.payload;
        }
      }
    } catch {
      // Use raw string
    }

    router.push({
      pathname: "/scanned-card",
      params: { qr: targetPayload },
    });
  };

  const handleManualSubmit = (overrideCode?: string) => {
    const code = (overrideCode || manualInput).trim();
    if (!code) return;

    router.push({
      pathname: "/scanned-card",
      params: { qr: code },
    });
  };

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: 12 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder, borderBottomWidth: 1 }]}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)" }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={theme.accentGold} />
        </TouchableOpacity>
        <Text style={[styles.heading, { color: theme.textPrimary }]}>Student Card Scanner</Text>
      </View>

      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Scan any student's unique QR code to view their Library Card and Violation Record.
      </Text>

      {Platform.OS === "web" ? (
        <ScrollView contentContainerStyle={styles.webFallbackContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.webScannerBox}>
            <MaterialCommunityIcons name="qrcode-scan" size={54} color={theme.accentGold} style={{ marginBottom: 12 }} />
            <Text style={[styles.webTitle, { color: theme.textPrimary }]}>In-App Student QR Scanner</Text>
            <Text style={[styles.errorSubText, { color: theme.textSecondary }]}>
              Camera scanning is active on mobile. On web browsers, you can test student QR resolution by selecting a test student or entering a payload below:
            </Text>

            {/* Quick Test Students */}
            <View style={styles.quickTestSection}>
              <Text style={[styles.quickTestLabel, { color: theme.accentGold }]}>DEMO STUDENT CARDS</Text>
              <TouchableOpacity
                style={[styles.quickTestBtn, { backgroundColor: isDarkMode ? '#172338' : '#E2E8F0', borderColor: isDarkMode ? '#283850' : '#CBD5E1' }]}
                onPress={() => handleManualSubmit("e1a10001-6537-4050-8000-000000000001")}
              >
                <Ionicons name="person-circle-outline" size={20} color={theme.accentGold} />
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text style={[styles.quickTestName, { color: theme.textPrimary }]}>Jandale Piansay</Text>
                  <Text style={[styles.quickTestId, { color: theme.textSecondary }]}>ID: 653705 • CICT</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickTestBtn, { backgroundColor: isDarkMode ? '#172338' : '#E2E8F0', borderColor: isDarkMode ? '#283850' : '#CBD5E1' }]}
                onPress={() => handleManualSubmit("e1a10003-2026-4050-8000-000000000003")}
              >
                <Ionicons name="person-circle-outline" size={20} color={theme.accentGold} />
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text style={[styles.quickTestName, { color: theme.textPrimary }]}>STI Student (With Overdue Loan)</Text>
                  <Text style={[styles.quickTestId, { color: theme.textSecondary }]}>ID: STI-2026-001 • WNU STI</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Manual QR Code Input */}
            <View style={styles.manualInputSection}>
              <TextInput
                style={[styles.textInput, { backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF', borderColor: isDarkMode ? '#283850' : '#CBD5E1', color: theme.textPrimary }]}
                placeholder="Enter Student ID or QR UUID..."
                placeholderTextColor={theme.textMuted}
                value={manualInput}
                onChangeText={setManualInput}
              />
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: theme.accentGold }]}
                onPress={() => handleManualSubmit()}
              >
                <Text style={[styles.submitBtnText, { color: isDarkMode ? '#080F1E' : '#FFFFFF' }]}>Resolve Card</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      ) : permission === null ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={theme.accentGold} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Requesting camera permission...</Text>
        </View>
      ) : !permission.granted ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>Camera permission is required to scan QR codes.</Text>
          <Text style={[styles.errorSubText, { color: theme.textSecondary }]}>Please enable camera access in Expo Go and try again.</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: theme.accentGold }]}
            onPress={requestPermission}
          >
            <Text style={[styles.submitBtnText, { color: isDarkMode ? '#080F1E' : '#FFFFFF' }]}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.scannerWrapper}>
          <CameraView
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
            style={styles.scanner}
          />
          <View style={styles.hintBox}>
            <Text style={styles.scannerHint}>Point your camera at a student's BookHive QR code.</Text>
          </View>
        </View>
      )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  heading: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 13,
    textAlign: "center",
    marginHorizontal: 16,
    marginBottom: 16,
  },
  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    color: "#EF4444",
    textAlign: "center",
    fontWeight: "600",
    marginBottom: 8,
  },
  errorSubText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  scannerWrapper: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scanner: {
    flex: 1,
  },
  hintBox: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  scannerHint: {
    color: "#FFFFFF",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },
  webFallbackContainer: {
    padding: 16,
    alignItems: "center",
  },
  webScannerBox: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
  },
  webTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  quickTestSection: {
    width: "100%",
    marginTop: 24,
  },
  quickTestLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    marginBottom: 10,
  },
  quickTestBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  quickTestName: {
    fontSize: 13,
    fontWeight: "700",
  },
  quickTestId: {
    fontSize: 11,
    marginTop: 2,
  },
  manualInputSection: {
    width: "100%",
    marginTop: 18,
  },
  textInput: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 10,
  },
  submitBtn: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  submitBtnText: {
    fontWeight: "800",
    fontSize: 14,
  },
});