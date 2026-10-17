import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Image,
  Dimensions,
  AppState,
  AppStateStatus,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { MaterialCommunityIcons, Ionicons, Feather } from "@expo/vector-icons";
import axios from "axios";
import { API_URL } from "../data/authService";
import { socketService } from "../services/socketService";

const { width, height } = Dimensions.get("window");

interface MaintenanceState {
  inMaintenance: boolean;
  title: string;
  message: string;
  until: string | null;
  remainingSeconds: number;
  minVersion: string;
  latestApkUrl: string;
}

export const MaintenanceModal: React.FC = () => {
  const [maintenance, setMaintenance] = useState<MaintenanceState>({
    inMaintenance: false,
    title: "System Maintenance & Update",
    message:
      "BookHive is currently undergoing scheduled maintenance and updates. Services are temporarily paused.",
    until: null,
    remainingSeconds: 0,
    minVersion: "1.0.4",
    latestApkUrl:
      "https://expo.dev/artifacts/eas/m90mnPT1hrznA0zP1xdm95K-P6ZMwCNdlYIbZ6kO-uQ.apk",
  });

  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [downloadStarted, setDownloadStarted] = useState<boolean>(false);
  const intervalRef = useRef<any>(null);

  // Fetch current maintenance status from backend
  const checkMaintenanceStatus = useCallback(async (showFeedback = false) => {
    try {
      if (showFeedback) setIsChecking(true);
      const res = await axios.get(`${API_URL}/api/system/maintenance`, {
        timeout: 6000,
      });

      if (res?.data) {
        const data = res.data;
        const inMaint = Boolean(data.inMaintenance);
        setMaintenance((prev) => ({
          ...prev,
          inMaintenance: inMaint,
          title: data.title || prev.title,
          message: data.message || prev.message,
          until: data.until || null,
          remainingSeconds: Number(data.remainingSeconds || 0),
          minVersion: data.minVersion || prev.minVersion,
          latestApkUrl: data.latestApkUrl || prev.latestApkUrl,
        }));

        if (data.until) {
          const diffSec = Math.max(
            0,
            Math.floor((new Date(data.until).getTime() - Date.now()) / 1000)
          );
          setCountdownSeconds(diffSec);
        } else if (data.remainingSeconds) {
          setCountdownSeconds(Number(data.remainingSeconds));
        }

        if (showFeedback && !inMaint) {
          Alert.alert(
            "System Online",
            "Maintenance mode has concluded! Welcome back to BookHive."
          );
        }
      }
    } catch (err: any) {
      console.log("[MaintenanceModal] Status check note:", err.message);
    } finally {
      if (showFeedback) setIsChecking(false);
    }
  }, []);

  // Subscribe to real-time WebSocket maintenance events
  useEffect(() => {
    void checkMaintenanceStatus();

    // Listen to real-time broadcast from Admin/Super Admin
    const unsubscribeMaintenance = socketService.subscribeToMaintenance(
      (data: any) => {
        console.log("[MaintenanceModal] Real-time event received:", data);
        if (typeof data === "object" && data !== null) {
          const inMaint = Boolean(data.inMaintenance);
          setMaintenance((prev) => ({
            ...prev,
            inMaintenance: inMaint,
            title: data.title || prev.title,
            message: data.message || prev.message,
            until: data.until || null,
            remainingSeconds: Number(data.remainingSeconds || 0),
            minVersion: data.minVersion || prev.minVersion,
            latestApkUrl: data.latestApkUrl || prev.latestApkUrl,
          }));

          if (data.until) {
            const diffSec = Math.max(
              0,
              Math.floor((new Date(data.until).getTime() - Date.now()) / 1000)
            );
            setCountdownSeconds(diffSec);
          } else if (data.remainingSeconds) {
            setCountdownSeconds(Number(data.remainingSeconds));
          }
        }
      }
    );

    // Also check on settings:updated
    const unsubscribeSettings = socketService.subscribeToSettings(
      (settings: any) => {
        if (settings?.isMaintenanceMode !== undefined) {
          void checkMaintenanceStatus();
        }
      }
    );

    // Periodic check every 30 seconds as fail-safe
    const pollInterval = setInterval(() => {
      void checkMaintenanceStatus();
    }, 30000);

    // AppState listener: re-check when app returns from background / browser
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        void checkMaintenanceStatus();
      }
    };
    const appStateSub = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      unsubscribeMaintenance();
      unsubscribeSettings();
      clearInterval(pollInterval);
      appStateSub.remove();
    };
  }, [checkMaintenanceStatus]);

  // Live countdown ticker
  useEffect(() => {
    if (!maintenance.inMaintenance) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          void checkMaintenanceStatus();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [maintenance.inMaintenance, checkMaintenanceStatus]);

  // Handle direct download of latest update APK
  const handleDownloadUpdate = async () => {
    const apkUrl =
      maintenance.latestApkUrl ||
      "https://expo.dev/artifacts/eas/u0IuSm_N5wixAJ9iBDJMwuQbe4aKO4HzZfYAjYao-dU.apk";

    try {
      setDownloadStarted(true);
      const supported = await Linking.canOpenURL(apkUrl);
      if (supported) {
        await Linking.openURL(apkUrl);
      } else {
        await Linking.openURL(apkUrl);
      }
    } catch (err) {
      Alert.alert(
        "Download Link",
        `Please open this link in your browser to download the update:\n\n${apkUrl}`,
        [{ text: "OK" }]
      );
    }
  };

  if (!maintenance.inMaintenance) {
    return null;
  }

  // Format countdown into HH : MM : SS
  const hours = Math.floor(countdownSeconds / 3600);
  const minutes = Math.floor((countdownSeconds % 3600) / 60);
  const seconds = countdownSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <Modal
      visible={maintenance.inMaintenance}
      animationType="fade"
      transparent={false}
      statusBarTranslucent={true}
      onRequestClose={() => {
        // Prevent dismissal via Android back button while maintenance is active
      }}
    >
      <View style={styles.container}>
        {/* Subtle Decorative Ambient Background Elements */}
        <View style={styles.ambientTop} />
        <View style={styles.ambientBottom} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Logo & Beacon */}
          <View style={styles.logoWrapper}>
            <View style={styles.logoContainer}>
              <Image
                source={require("../assets/icon.png")}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.pulseBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.pulseText}>REMOTE SYSTEM UPDATE</Text>
            </View>
          </View>

          {/* Heading */}
          <Text style={styles.titleText}>{maintenance.title}</Text>
          <Text style={styles.messageText}>{maintenance.message}</Text>

          {/* Live Countdown Box */}
          <View style={styles.countdownContainer}>
            <View style={styles.countdownHeaderRow}>
              <Ionicons name="time-outline" size={16} color="#FFD700" />
              <Text style={styles.countdownHeaderTitle}>
                ESTIMATED TIME REMAINING
              </Text>
            </View>

            <View style={styles.timerRow}>
              {/* Hours */}
              <View style={styles.timeCard}>
                <Text style={styles.timeNumber}>{pad(hours)}</Text>
                <Text style={styles.timeLabel}>HOURS</Text>
              </View>

              <Text style={styles.timeSeparator}>:</Text>

              {/* Minutes */}
              <View style={styles.timeCard}>
                <Text style={styles.timeNumber}>{pad(minutes)}</Text>
                <Text style={styles.timeLabel}>MINUTES</Text>
              </View>

              <Text style={styles.timeSeparator}>:</Text>

              {/* Seconds */}
              <View style={styles.timeCard}>
                <Text style={styles.timeNumber}>{pad(seconds)}</Text>
                <Text style={styles.timeLabel}>SECONDS</Text>
              </View>
            </View>

            {maintenance.until && (
              <Text style={styles.completionNote}>
                Estimated completion:{" "}
                {new Date(maintenance.until).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            )}
          </View>

          {/* Update Action Card */}
          <View style={styles.updateCard}>
            <View style={styles.updateCardHeader}>
              <View style={styles.updateIconContainer}>
                <MaterialCommunityIcons
                  name="cellphone-arrow-down"
                  size={24}
                  color="#FFD700"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.updateCardTitle}>
                  Mobile Application Update Available
                </Text>
                <Text style={styles.updateCardVersion}>
                  Target Release: v{maintenance.minVersion || "1.0.2"} (Official)
                </Text>
              </View>
            </View>

            <Text style={styles.updateDescription}>
              While system maintenance is in progress, please download and
              install the latest update package. Once completed, your phone will
              be ready when the system resumes.
            </Text>

            {/* Direct One-Tap Download Button */}
            <TouchableOpacity
              style={styles.downloadButton}
              activeOpacity={0.85}
              onPress={handleDownloadUpdate}
            >
              <Feather name="download-cloud" size={20} color="#001B33" />
              <Text style={styles.downloadButtonText}>
                {downloadStarted
                  ? "Downloading Update Package..."
                  : "Download & Install Update"}
              </Text>
            </TouchableOpacity>

            {downloadStarted && (
              <View style={styles.downloadGuideBox}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={16}
                  color="#10B981"
                />
                <Text style={styles.downloadGuideText}>
                  Download initiated. Tap the file in your notification bar or
                  Downloads folder to complete installation.
                </Text>
              </View>
            )}
          </View>

          {/* Secondary Check Status Button */}
          <TouchableOpacity
            style={styles.refreshButton}
            activeOpacity={0.7}
            disabled={isChecking}
            onPress={() => void checkMaintenanceStatus(true)}
          >
            {isChecking ? (
              <ActivityIndicator size="small" color="#FFD700" />
            ) : (
              <Feather name="refresh-cw" size={15} color="#FFD700" />
            )}
            <Text style={styles.refreshButtonText}>
              {isChecking ? "Checking Status..." : "Check If Maintenance Ended"}
            </Text>
          </TouchableOpacity>

          {/* Institutional Footer */}
          <View style={styles.footerContainer}>
            <Text style={styles.footerInstitution}>
              STI West Negros University · Library Ecosystem
            </Text>
            <Text style={styles.footerSub}>
              Direct Distribution Release · Client Lockout Active
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#001B33",
  },
  ambientTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.35,
    backgroundColor: "rgba(255, 215, 0, 0.05)",
  },
  ambientBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.25,
    backgroundColor: "rgba(2, 116, 187, 0.08)",
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingTop: Platform.OS === "android" ? 54 : 44,
    paddingBottom: 40,
  },
  logoWrapper: {
    alignItems: "center",
    marginBottom: 20,
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 215, 0, 0.35)",
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  pulseBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 215, 0, 0.14)",
    borderColor: "rgba(255, 215, 0, 0.3)",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 14,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#FFD700",
  },
  pulseText: {
    color: "#FFD700",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  titleText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  messageText: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 320,
    marginBottom: 24,
  },
  countdownContainer: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.25)",
    padding: 18,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  countdownHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  countdownHeaderTitle: {
    color: "#FFD700",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  timeCard: {
    backgroundColor: "rgba(0, 27, 51, 0.9)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    minWidth: 70,
  },
  timeNumber: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  timeLabel: {
    color: "#94A3B8",
    fontSize: 9,
    fontWeight: "700",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  timeSeparator: {
    color: "#FFD700",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 10,
  },
  completionNote: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 12,
    fontWeight: "500",
  },
  updateCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 18,
    marginBottom: 18,
  },
  updateCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  updateIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255, 215, 0, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  updateCardTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  updateCardVersion: {
    color: "#FFD700",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },
  updateDescription: {
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 16,
  },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFD700",
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  downloadButtonText: {
    color: "#001B33",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  downloadGuideBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 12,
    padding: 10,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  downloadGuideText: {
    flex: 1,
    color: "#A7F3D0",
    fontSize: 11,
    lineHeight: 15,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.3)",
    backgroundColor: "rgba(255, 215, 0, 0.08)",
    marginBottom: 24,
  },
  refreshButtonText: {
    color: "#FFD700",
    fontSize: 12,
    fontWeight: "700",
  },
  footerContainer: {
    alignItems: "center",
  },
  footerInstitution: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
  },
  footerSub: {
    color: "#475569",
    fontSize: 10,
    marginTop: 2,
  },
});

export default MaintenanceModal;
