import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimatedScreen from "../components/AnimatedScreen";

import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../hooks/useThemeColors";

export default function ScannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useThemeColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    setScanned(true);
    setScanResult(data);
    Alert.alert("QR Code scanned", data);
  };

  const resetScanner = () => {
    setScanned(false);
    setScanResult(null);
  };

  const openScannedLink = async () => {
    if (!scanResult) return;

    const supported = await Linking.canOpenURL(scanResult);
    if (supported) {
      await Linking.openURL(scanResult);
    } else {
      Alert.alert("Invalid QR result", "This QR code result is not a valid link.");
    }
  };

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: 12 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder, borderBottomWidth: 1 }]}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)" }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={theme.accentGold} />
        </TouchableOpacity>
        <Text style={[styles.heading, { color: theme.textPrimary }]}>QR Scanner</Text>
      </View>

      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Scan the library QR code to submit feedback and reviews.
      </Text>

      {Platform.OS === "web" ? (
        <View style={styles.centerBox}>
          <Ionicons name="camera-outline" size={48} color={theme.accentGold} style={{ marginBottom: 12 }} />
          <Text style={styles.errorText}>Camera scanner is not supported on web browsers.</Text>
          <Text style={[styles.errorSubText, { color: theme.textSecondary }]}>Please run the application on a mobile device via Expo Go to use the QR scanner.</Text>
        </View>
      ) : permission === null ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={theme.accentGold} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Requesting camera permission...</Text>
        </View>
      ) : !permission.granted ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>Camera permission is required to scan QR codes.</Text>
          <Text style={[styles.errorSubText, { color: theme.textSecondary }]}>Please enable camera access in Expo Go and try again.</Text>
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
            <Text style={styles.scannerHint}>Point your camera at a QR code.</Text>
          </View>
          {scanResult ? (
            <View style={[styles.resultBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderTopWidth: 1 }]}>
              <Text style={[styles.resultLabel, { color: theme.accentGold }]}>Scanned result</Text>
              <Text style={[styles.resultText, { color: theme.textPrimary }]}>{scanResult}</Text>
              <View style={styles.resultActions}>
                <TouchableOpacity style={[styles.openButton, { backgroundColor: theme.accentGold }]} onPress={openScannedLink}>
                  <Text style={[styles.openButtonText, { color: isDarkMode ? "#080F1E" : "#FFFFFF" }]}>Open link</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.resetButton, { backgroundColor: isDarkMode ? "#1E293B" : "#E2E8F0" }]} onPress={resetScanner}>
                  <Text style={[styles.resetButtonText, { color: theme.textPrimary }]}>Scan again</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
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
    fontSize: 20,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
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
  },
  scannerWrapper: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scanner: {
    flex: 1,
  },
  hintBox: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  scannerHint: {
    color: "#FFFFFF",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "500",
  },
  resultBox: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  resultLabel: {
    fontWeight: "700",
    marginBottom: 8,
    fontSize: 16,
  },
  resultText: {
    marginBottom: 14,
    fontSize: 14,
    fontWeight: "500",
  },
  resultActions: {
    flexDirection: "row",
    gap: 12,
  },
  openButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  openButtonText: {
    fontWeight: "700",
    fontSize: 14,
  },
  resetButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  resetButtonText: {
    fontWeight: "700",
    fontSize: 14,
  },
});