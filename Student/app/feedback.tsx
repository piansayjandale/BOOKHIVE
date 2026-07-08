import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import AnimatedScreen from "../components/AnimatedScreen";
import { useThemeColors } from "../hooks/useThemeColors";

export default function FeedbackScannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    } else if (!permission.granted) {
      setScanError("Camera permission is required to scan QR codes.");
    }
  }, [permission]);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    setScanned(true);
    setScanResult(data);
    Alert.alert("QR Scanned", `Scanned data:\n${data}`);
  };

  const openLink = async () => {
    if (!scanResult) return;

    const supported = await Linking.canOpenURL(scanResult);
    if (supported) {
      await Linking.openURL(scanResult);
    } else {
      Alert.alert("Cannot open QR result", "The scanned QR code is not a valid link.");
    }
  };

  const resetScanner = () => {
    setScanned(false);
    setScanResult(null);
    setScanError(null);
  };

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: 12 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder, borderBottomWidth: 1 }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.cardBg }]}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={22} color={theme.accentGold} />
        </TouchableOpacity>

        <Text style={[styles.heading, { color: theme.textPrimary }]}>Feedback Scanner</Text>
      </View>

      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Scan the QR code to submit feedback and reviews.
      </Text>

      {permission === null ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={theme.accentGold} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Requesting camera permission...</Text>
        </View>
      ) : !permission.granted ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{scanError ?? "Camera access denied."}</Text>
          <Text style={[styles.errorSubText, { color: theme.textSecondary }]}>
            Allow camera access in your device settings to scan QR codes.
          </Text>
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
          {scanned && scanResult ? (
            <View style={[styles.resultBox, { backgroundColor: theme.cardBg }]}>
              <Text style={[styles.resultLabel, { color: theme.accentGold }]}>Scanned result</Text>
              <Text style={[styles.resultText, { color: theme.textPrimary }]}>{scanResult}</Text>
              <View style={styles.resultButtons}>
                <TouchableOpacity style={[styles.openButton, { backgroundColor: theme.accentGold }]} onPress={openLink}>
                  <Text style={[styles.openButtonText, { color: isDarkMode ? "#080F1E" : "#FFFFFF" }]}>Open Link</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.resetButton, { backgroundColor: theme.background }]} onPress={resetScanner}>
                  <Text style={[styles.resetButtonText, { color: theme.textSecondary }]}>Scan Again</Text>
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
    backgroundColor: "#001B33",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#001B33",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  heading: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 14,
    color: "#CBD5E1",
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
    color: "#CBD5E1",
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
    color: "#CBD5E1",
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
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  resultLabel: {
    color: "#0B5A8E",
    fontWeight: "700",
    marginBottom: 8,
    fontSize: 16,
  },
  resultText: {
    color: "#0F172A",
    marginBottom: 14,
    fontSize: 14,
    fontWeight: "500",
  },
  resultButtons: {
    flexDirection: "row",
    gap: 12,
  },
  openButton: {
    flex: 1,
    backgroundColor: "#FFD700",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  openButtonText: {
    color: "#001B33",
    fontWeight: "700",
    fontSize: 14,
  },
  resetButton: {
    flex: 1,
    backgroundColor: "#E2E8F0",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  resetButtonText: {
    color: "#1E3A8E",
    fontWeight: "700",
    fontSize: 14,
  },
});
