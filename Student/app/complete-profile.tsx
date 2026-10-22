import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Image,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import AnimatedScreen from "../components/AnimatedScreen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../data/AuthContext";
import { updateStudentProfile, clearLocalCache, saveStudentIdCardsToStorage } from "../data/store";
import { apiClient } from "../services/api";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

const DEPARTMENTS = [
  { code: "CICT", name: "College of Information & Communications Technology" },
  { code: "COE", name: "College of Engineering" },
  { code: "CBMA", name: "College of Business Management & Accountancy" },
  { code: "CAS", name: "College of Arts & Sciences" },
  { code: "CED", name: "College of Education" },
  { code: "CHTM", name: "College of Hospitality & Tourism Management" },
  { code: "CCJE", name: "College of Criminal Justice Education" },
];

const DEPARTMENT_COURSES: Record<string, { code: string; name: string }[]> = {
  CICT: [
    { code: "BSIT", name: "BS Information Technology" },
    { code: "BSCS", name: "BS Computer Science" },
  ],
  COE: [
    { code: "BSCPE", name: "BS Computer Engineering" },
    { code: "BSEE", name: "BS Electrical Engineering" },
    { code: "BSECE", name: "BS Electronics Engineering" },
  ],
  CBMA: [
    { code: "BSA", name: "BS Accountancy" },
    { code: "BSBA", name: "BS Business Administration" },
    { code: "BSMA", name: "BS Management Accounting" },
    { code: "BSE", name: "BS Entrepreneurship" },
  ],
  CAS: [
    { code: "BACOMM", name: "BA Communication" },
    { code: "BAPsych", name: "BS Psychology" },
    { code: "BAPos", name: "BA Political Science" },
  ],
  CED: [
    { code: "BSED", name: "Bachelor of Secondary Education" },
    { code: "BEED", name: "Bachelor of Elementary Education" },
  ],
  CHTM: [
    { code: "BSHM", name: "BS Hospitality Management" },
    { code: "BSTM", name: "BS Tourism Management" },
  ],
  CCJE: [
    { code: "BSCrim", name: "BS Criminology" },
  ],
};

const YEAR_LEVELS = ["1ST", "2ND", "3RD", "4TH"];
const SECTIONS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

type IdPhoto = {
  uri: string;
  base64: string;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F19",
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  topHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
    width: "100%",
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#121A2C",
    borderWidth: 1.5,
    borderColor: "#1E2A42",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  backButtonPlaceholder: {
    width: 42,
    height: 42,
  },
  card: {
    backgroundColor: "#121A2C",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#1E2A42",
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    color: "#E2E8F0",
    letterSpacing: 0.8,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  underlineInput: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    borderBottomWidth: 1.5,
    borderBottomColor: "#4B5563",
    paddingVertical: 6,
    paddingHorizontal: 0,
  },
  gridRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 16,
  },
  dropdownBox: {
    flex: 1,
    backgroundColor: "#1E283E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2D3852",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dropdownHeaderLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#E2E8F0",
    textAlign: "center",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  dropdownValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1.5,
    borderBottomColor: "#64748B",
    paddingBottom: 4,
  },
  dropdownValueText: {
    fontSize: 19,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  // ID Upload Section Styles
  idSectionContainer: {
    marginTop: 10,
    marginBottom: 20,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#1E2A42",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 18,
    marginBottom: 16,
  },
  idCardBox: {
    backgroundColor: "#172238",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#253450",
    padding: 14,
    marginBottom: 16,
  },
  idCardBoxComplete: {
    borderColor: "#10B981",
  },
  idCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  idCardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  idCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.6,
  },
  badgeReady: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderColor: "#10B981",
    borderWidth: 1,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  badgeReadyText: {
    color: "#34D399",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  badgeMissing: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "#EF4444",
    borderWidth: 1,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  badgeMissingText: {
    color: "#F87171",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  badgePartial: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    borderColor: "#F59E0B",
    borderWidth: 1,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  badgePartialText: {
    color: "#FBBF24",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  scanBothButton: {
    backgroundColor: "#1E2A42",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FFC800",
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  scanBothButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFC800",
    letterSpacing: 0.5,
  },
  slotsRow: {
    flexDirection: "row",
    gap: 12,
  },
  slotBox: {
    flex: 1,
    height: 110,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#334155",
    borderStyle: "dashed",
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  slotBoxFilled: {
    borderStyle: "solid",
    borderColor: "#10B981",
  },
  slotImage: {
    width: "100%",
    height: "100%",
  },
  slotPill: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#475569",
  },
  slotPillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  slotRetakeBtn: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "#FFC800",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  slotRetakeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#000000",
  },
  slotPlaceholderText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#CBD5E1",
    marginTop: 4,
  },
  slotSubtext: {
    fontSize: 9,
    color: "#64748B",
    marginTop: 2,
  },
  ocrNoticeBox: {
    backgroundColor: "rgba(30, 42, 66, 0.8)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2D3E5E",
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 16,
  },
  ocrNoticeText: {
    fontSize: 12,
    color: "#94A3B8",
    flex: 1,
    lineHeight: 18,
  },
  ocrVerifyingBox: {
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EAB308",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
  },
  ocrVerifyingText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFC800",
  },
  ocrErrorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#EF4444",
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 16,
  },
  ocrErrorText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F87171",
    flex: 1,
    lineHeight: 18,
  },
  ocrSuccessBox: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#10B981",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  ocrSuccessText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#34D399",
  },
  errorText: {
    color: "#EF4444",
    marginBottom: 12,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  heroUploadAllButton: {
    backgroundColor: "#FFC800",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
    elevation: 4,
    shadowColor: "#FFC800",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  heroUploadAllIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  heroUploadAllTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#080F1E",
    letterSpacing: 0.3,
  },
  heroUploadAllSub: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1E293B",
    marginTop: 2,
  },
  heroUploadAllBadge: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#080F1E",
  },
  heroUploadAllBadgeComplete: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderColor: "#10B981",
    borderWidth: 1,
  },
  heroUploadAllBadgePending: {
    backgroundColor: "#080F1E",
  },
  heroUploadAllBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#FFC800",
    letterSpacing: 0.5,
  },
  doneButton: {
    backgroundColor: "#FFC800",
    height: 56,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFC800",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    marginTop: 8,
  },
  doneButtonText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#000000",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "75%",
    backgroundColor: "#141D30",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#25334E",
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#222F46",
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  modalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: "#1A253C",
  },
  modalItemActive: {
    backgroundColor: "#223354",
    borderWidth: 1,
    borderColor: "#FFC800",
  },
  modalItemText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#CBD5E1",
  },
  modalItemTextActive: {
    color: "#FFC800",
    fontWeight: "800",
  },
  modalItemSub: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
});

export default function CompleteProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { user, updateUser, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const handleBackToLogin = async () => {
    try {
      await logout();
    } catch (err) {
      console.log("Error during back to login:", err);
    }
    router.replace("/login");
  };

  const [name, setName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("CICT");
  const [course, setCourse] = useState("BSIT");
  const [yearLevel, setYearLevel] = useState("4TH");
  const [section, setSection] = useState("H");

  // ID Cards State
  const [schoolIdFront, setSchoolIdFront] = useState<IdPhoto | null>(null);
  const [schoolIdBack, setSchoolIdBack] = useState<IdPhoto | null>(null);
  const [libraryIdFront, setLibraryIdFront] = useState<IdPhoto | null>(null);
  const [libraryIdBack, setLibraryIdBack] = useState<IdPhoto | null>(null);
  const [idCaptureOrientation, setIdCaptureOrientation] = useState<"portrait" | "landscape">("portrait");

  const [ocrVerifying, setOcrVerifying] = useState(false);
  const [ocrVerified, setOcrVerified] = useState(false);
  const [ocrError, setOcrError] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [activePicker, setActivePicker] = useState<"department" | "course" | "yearLevel" | "section" | null>(null);

  useEffect(() => {
    clearLocalCache();
  }, []);

  useEffect(() => {
    const passedEmail = params.email || user?.email || "";
    if (passedEmail) {
      setEmail(passedEmail);
    }
    if (user) {
      if (user.fullName && user.fullName !== "STI Student") {
        setName(user.fullName);
      }
      if (user.studentId && !user.studentId.startsWith("STI-") && !user.studentId.startsWith("MS-")) {
        setIdNumber(user.studentId);
      }
      if (user.department && DEPARTMENTS.some((d) => d.code === user.department)) {
        setDepartment(user.department);
      }
      if (user.course) {
        setCourse(user.course);
      }
      if (user.yearLevel) {
        setYearLevel(user.yearLevel);
      }
      if (user.section) {
        setSection(user.section);
      }
    }
  }, [user, params.email]);

  useEffect(() => {
    const backAction = () => {
      handleBackToLogin();
      return true;
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, []);

  const handleIdNumberChange = (raw: string) => {
    const digitsOnly = raw.replace(/[^0-9]/g, "");
    let formatted = "";
    if (digitsOnly.length > 0) {
      formatted += digitsOnly.substring(0, 2);
    }
    if (digitsOnly.length > 2) {
      formatted += "-" + digitsOnly.substring(2, 6);
    }
    if (digitsOnly.length > 6) {
      formatted += "-" + digitsOnly.substring(6, 9);
    }
    setIdNumber(formatted);
    setErrorMessage("");
    setOcrError("");
  };

  const handleDepartmentSelect = (deptCode: string) => {
    setDepartment(deptCode);
    const available = DEPARTMENT_COURSES[deptCode];
    if (available && available.length > 0) {
      setCourse(available[0].code);
    }
    setActivePicker(null);
  };

  const requestCameraPermission = async (): Promise<boolean> => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Camera Permission Required",
          "Camera permission is required to photograph your ID cards for verification."
        );
        return false;
      }
      return true;
    } catch {
      return false;
    }
  };

  const captureSingleSlot = async (
    slot: "schoolFront" | "schoolBack" | "libraryFront" | "libraryBack",
    source: "camera" | "gallery" = "camera",
    orientationOverride?: "portrait" | "landscape"
  ) => {
    const activeOrientation = orientationOverride || idCaptureOrientation;
    const cropAspect: [number, number] =
      activeOrientation === "portrait" ? [10, 16] : [16, 10];
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === "gallery") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Required", "Gallery permission is needed to choose an ID image.");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: cropAspect,
          quality: 0.45,
          base64: true,
        });
      } else {
        const hasPerm = await requestCameraPermission();
        if (!hasPerm) return;
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: cropAspect,
          quality: 0.45,
          base64: true,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const photoData: IdPhoto = {
          uri: asset.uri,
          base64: asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri,
        };

        if (slot === "schoolFront") setSchoolIdFront(photoData);
        if (slot === "schoolBack") setSchoolIdBack(photoData);
        if (slot === "libraryFront") setLibraryIdFront(photoData);
        if (slot === "libraryBack") setLibraryIdBack(photoData);

        setOcrError("");
        setOcrVerified(false);
      }
    } catch (err: any) {
      console.warn("Error capturing ID photo:", err);
      Alert.alert("Capture Error", "Could not capture image. Please try again.");
    }
  };

  const promptSlotOrientation = (
    slot: "schoolFront" | "schoolBack" | "libraryFront" | "libraryBack",
    source: "camera" | "gallery",
    label: string
  ) => {
    if (Platform.OS === "web") {
      void captureSingleSlot(slot, source, idCaptureOrientation);
      return;
    }
    Alert.alert(
      `${label} Orientation`,
      `Choose Portrait (vertical ID) or Landscape (horizontal ID) before ${
        source === "camera" ? "capturing" : "cropping"
      }:`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Portrait (Vertical)",
          onPress: () => {
            setIdCaptureOrientation("portrait");
            void captureSingleSlot(slot, source, "portrait");
          },
        },
        {
          text: "Landscape (Horizontal)",
          onPress: () => {
            setIdCaptureOrientation("landscape");
            void captureSingleSlot(slot, source, "landscape");
          },
        },
      ]
    );
  };

  const handleSlotPress = (
    slot: "schoolFront" | "schoolBack" | "libraryFront" | "libraryBack",
    label: string
  ) => {
    Alert.alert(
      `Capture ${label}`,
      "Take a clear photo using your camera or select from gallery:",
      [
        {
          text: "Camera (Recommended)",
          onPress: () => promptSlotOrientation(slot, "camera", label),
        },
        {
          text: "Choose from Gallery",
          onPress: () => promptSlotOrientation(slot, "gallery", label),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  };

  const handleScanFullId = async (type: "school" | "library") => {
    const hasPerm = await requestCameraPermission();
    if (!hasPerm) return;

    const label = type === "school" ? "School ID" : "Library ID";
    const cropAspect: [number, number] =
      idCaptureOrientation === "portrait" ? [10, 16] : [16, 10];

    try {
      Alert.alert(
        `Scan ${label} (Front)`,
        `Please point your camera at the FRONT of your ${label} (${
          idCaptureOrientation === "portrait" ? "Portrait / Vertical" : "Landscape / Horizontal"
        }) and ensure text is clearly visible and legible.`,
        [
          {
            text: "Open Camera",
            onPress: async () => {
              const frontRes = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: cropAspect,
                quality: 0.45,
                base64: true,
              });

              if (!frontRes.canceled && frontRes.assets?.[0]) {
                const frontAsset = frontRes.assets[0];
                const frontPhoto: IdPhoto = {
                  uri: frontAsset.uri,
                  base64: frontAsset.base64 ? `data:image/jpeg;base64,${frontAsset.base64}` : frontAsset.uri,
                };
                if (type === "school") setSchoolIdFront(frontPhoto);
                else setLibraryIdFront(frontPhoto);

                setTimeout(() => {
                  Alert.alert(
                    `Front Captured!`,
                    `Now please flip your ${label} and take a photo of the BACK side.`,
                    [
                      {
                        text: "Capture Back",
                        onPress: async () => {
                          const backRes = await ImagePicker.launchCameraAsync({
                            allowsEditing: true,
                            aspect: cropAspect,
                            quality: 0.45,
                            base64: true,
                          });

                          if (!backRes.canceled && backRes.assets?.[0]) {
                            const backAsset = backRes.assets[0];
                            const backPhoto: IdPhoto = {
                              uri: backAsset.uri,
                              base64: backAsset.base64 ? `data:image/jpeg;base64,${backAsset.base64}` : backAsset.uri,
                            };
                            if (type === "school") setSchoolIdBack(backPhoto);
                            else setLibraryIdBack(backPhoto);
                            setOcrError("");
                            setOcrVerified(false);
                          }
                        },
                      },
                      { text: "Later", style: "cancel" },
                    ]
                  );
                }, 350);
              }
            },
          },
          { text: "Cancel", style: "cancel" },
        ]
      );
    } catch (err: any) {
      console.warn("Guided scan error:", err);
      Alert.alert("Camera Notice", "Could not start camera. Please try again.");
    }
  };

  const startGuidedScanSequence = async () => {
    const hasPerm = await requestCameraPermission();
    if (!hasPerm) return;

    const cropAspect: [number, number] =
      idCaptureOrientation === "portrait" ? [10, 16] : [16, 10];

    Alert.alert(
      "Step 1 of 4: School ID (Front)",
      `Point camera at the FRONT of your School ID (${
        idCaptureOrientation === "portrait" ? "Portrait / Vertical" : "Landscape / Horizontal"
      }).`,
      [
        {
          text: "Open Camera",
          onPress: async () => {
            const res1 = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: cropAspect,
              quality: 0.45,
              base64: true,
            });
            if (!res1.canceled && res1.assets?.[0]) {
              const a1 = res1.assets[0];
              setSchoolIdFront({
                uri: a1.uri,
                base64: a1.base64 ? `data:image/jpeg;base64,${a1.base64}` : a1.uri,
              });

              setTimeout(() => {
                Alert.alert(
                  "Step 2 of 4: School ID (Back)",
                  "Flip your School ID and capture the BACK side.",
                  [
                    {
                      text: "Capture Back",
                      onPress: async () => {
                        const res2 = await ImagePicker.launchCameraAsync({
                          allowsEditing: true,
                          aspect: cropAspect,
                          quality: 0.45,
                          base64: true,
                        });
                        if (!res2.canceled && res2.assets?.[0]) {
                          const a2 = res2.assets[0];
                          setSchoolIdBack({
                            uri: a2.uri,
                            base64: a2.base64 ? `data:image/jpeg;base64,${a2.base64}` : a2.uri,
                          });

                          setTimeout(() => {
                            Alert.alert(
                              "Step 3 of 4: Library ID (Front)",
                              "Now position the FRONT side of your Library ID.",
                              [
                                {
                                  text: "Capture Front",
                                  onPress: async () => {
                                    const res3 = await ImagePicker.launchCameraAsync({
                                      allowsEditing: true,
                                      aspect: cropAspect,
                                      quality: 0.45,
                                      base64: true,
                                    });
                                    if (!res3.canceled && res3.assets?.[0]) {
                                      const a3 = res3.assets[0];
                                      setLibraryIdFront({
                                        uri: a3.uri,
                                        base64: a3.base64 ? `data:image/jpeg;base64,${a3.base64}` : a3.uri,
                                      });

                                      setTimeout(() => {
                                        Alert.alert(
                                          "Step 4 of 4: Library ID (Back)",
                                          "Finally, capture the BACK side of your Library ID.",
                                          [
                                            {
                                              text: "Capture Back",
                                              onPress: async () => {
                                                const res4 = await ImagePicker.launchCameraAsync({
                                                  allowsEditing: true,
                                                  aspect: cropAspect,
                                                  quality: 0.45,
                                                  base64: true,
                                                });
                                                if (!res4.canceled && res4.assets?.[0]) {
                                                  const a4 = res4.assets[0];
                                                  setLibraryIdBack({
                                                    uri: a4.uri,
                                                    base64: a4.base64 ? `data:image/jpeg;base64,${a4.base64}` : a4.uri,
                                                  });
                                                  setOcrError("");
                                                  setOcrVerified(false);
                                                  Alert.alert(
                                                    "All 4 IDs Captured!",
                                                    "All 4 sides have been captured successfully. You can now tap Finish Setup."
                                                  );
                                                }
                                              },
                                            },
                                            { text: "Later", style: "cancel" },
                                          ]
                                        );
                                      }, 400);
                                    }
                                  },
                                },
                                { text: "Later", style: "cancel" },
                              ]
                            );
                          }, 400);
                        }
                      },
                    },
                    { text: "Later", style: "cancel" },
                  ]
                );
              }, 400);
            }
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handlePickAllFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission Required", "Photo library access is needed to upload your ID cards.");
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 4,
        quality: 0.45,
        base64: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const assets = res.assets;
        if (assets.length >= 4) {
          setSchoolIdFront({
            uri: assets[0].uri,
            base64: assets[0].base64 ? `data:image/jpeg;base64,${assets[0].base64}` : assets[0].uri,
          });
          setSchoolIdBack({
            uri: assets[1].uri,
            base64: assets[1].base64 ? `data:image/jpeg;base64,${assets[1].base64}` : assets[1].uri,
          });
          setLibraryIdFront({
            uri: assets[2].uri,
            base64: assets[2].base64 ? `data:image/jpeg;base64,${assets[2].base64}` : assets[2].uri,
          });
          setLibraryIdBack({
            uri: assets[3].uri,
            base64: assets[3].base64 ? `data:image/jpeg;base64,${assets[3].base64}` : assets[3].uri,
          });
          Alert.alert("All 4 Photos Uploaded!", "School ID and Library ID (Front & Back) successfully loaded. Review the previews below.");
        } else {
          const currentMissing: Array<"schoolFront" | "schoolBack" | "libraryFront" | "libraryBack"> = [];
          if (!schoolIdFront) currentMissing.push("schoolFront");
          if (!schoolIdBack) currentMissing.push("schoolBack");
          if (!libraryIdFront) currentMissing.push("libraryFront");
          if (!libraryIdBack) currentMissing.push("libraryBack");

          assets.forEach((asset, idx) => {
            const targetSlot = currentMissing[idx] || (idx === 0 ? "schoolFront" : idx === 1 ? "schoolBack" : idx === 2 ? "libraryFront" : "libraryBack");
            const photo: IdPhoto = {
              uri: asset.uri,
              base64: asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri,
            };
            if (targetSlot === "schoolFront") setSchoolIdFront(photo);
            else if (targetSlot === "schoolBack") setSchoolIdBack(photo);
            else if (targetSlot === "libraryFront") setLibraryIdFront(photo);
            else if (targetSlot === "libraryBack") setLibraryIdBack(photo);
          });

          Alert.alert("Photos Uploaded", `Added ${assets.length} ID photo(s). Please verify all 4 sides (School ID Front & Back, Library ID Front & Back) are uploaded.`);
        }
        setOcrError("");
        setOcrVerified(false);
      }
    } catch (err) {
      console.warn("Gallery pick error:", err);
      Alert.alert("Gallery Error", "Could not pick photos from library. Please try again.");
    }
  };

  const handleUploadAllFourIds = () => {
    Alert.alert(
      "Upload 4 Required ID Photos",
      "Upload both Front & Back of your School ID and Library ID (4 photos total).\n\nSelect an option below:",
      [
        {
          text: "Guided Camera Scan (All 4)",
          onPress: () => {
            void startGuidedScanSequence();
          },
        },
        {
          text: "Upload from Gallery",
          onPress: () => {
            void handlePickAllFromGallery();
          },
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  };

  const handleDone = async () => {
    try {
      setErrorMessage("");
      setOcrError("");
      const cleanName = name.trim();
      const cleanId = idNumber.trim();
      const cleanEmail = email.trim().toLowerCase();

      if (!cleanName) {
        setErrorMessage("Please enter your full name.");
        return;
      }

      const idRegex = /^\d{2}-\d{4}-\d{3}$/;
      if (!idRegex.test(cleanId)) {
        setErrorMessage("ID Number must be formatted as 23-1111-111.");
        return;
      }

      if (!cleanEmail) {
        setErrorMessage("University email is required.");
        return;
      }

      // 1. Validate ID Uploads
      if (!schoolIdFront || !schoolIdBack) {
        setErrorMessage("Please capture both Front and Back photos of your School ID.");
        Alert.alert(
          "School ID Required",
          "Please capture both the Front and Back of your School ID before proceeding."
        );
        return;
      }

      if (!libraryIdFront || !libraryIdBack) {
        setErrorMessage("Please capture both Front and Back photos of your Library ID.");
        Alert.alert(
          "Library ID Required",
          "Please capture both the Front and Back of your Library ID before proceeding."
        );
        return;
      }

      setLoading(true);
      setOcrVerifying(true);

      // 2. OCR Verification Call
      let ocrResult: any = null;
      try {
        const verifyResponse = await apiClient.post("/api/student/ocr/verify-id", {
          schoolIdFront: schoolIdFront.base64,
          schoolIdBack: schoolIdBack.base64,
          libraryIdFront: libraryIdFront.base64,
          libraryIdBack: libraryIdBack.base64,
          expectedName: cleanName,
          expectedIdNumber: cleanId,
        });
        ocrResult = verifyResponse.data;
      } catch (apiErr: any) {
        console.warn("OCR API Error:", apiErr?.response?.data || apiErr?.message);
        if (apiErr?.response?.data) {
          ocrResult = apiErr.response.data;
        }
      }

      if (!ocrResult || !ocrResult.success) {
        setLoading(false);
        setOcrVerifying(false);
        setOcrVerified(false);

        const mismatchReason =
          ocrResult?.message ||
          "The student name or ID number on your uploaded ID cards failed to match your entered credentials.";
        setOcrError(mismatchReason);

        Alert.alert(
          "Identity Verification Failed",
          `${mismatchReason}\n\nEntered Credentials:\n• Name: ${cleanName}\n• ID No: ${cleanId}\n\nYou cannot proceed to the app until your ID cards match your information. Please ensure your physical IDs are clear, well-lit, and legible, then retake the photos.`,
          [
            {
              text: "Retake ID Photos",
              style: "default",
            },
          ]
        );
        return;
      }

      setOcrVerified(true);
      setOcrVerifying(false);

      const schoolFrontData = schoolIdFront.base64 || schoolIdFront.uri;
      const schoolBackData = schoolIdBack.base64 || schoolIdBack.uri;
      const libraryFrontData = libraryIdFront.base64 || libraryIdFront.uri;
      const libraryBackData = libraryIdBack.base64 || libraryIdBack.uri;

      const localSchoolFront = Platform.OS === "web" ? schoolFrontData : (schoolIdFront.uri || schoolFrontData);
      const localSchoolBack = Platform.OS === "web" ? schoolBackData : (schoolIdBack.uri || schoolBackData);
      const localLibraryFront = Platform.OS === "web" ? libraryFrontData : (libraryIdFront.uri || libraryFrontData);
      const localLibraryBack = Platform.OS === "web" ? libraryBackData : (libraryIdBack.uri || libraryBackData);

      // Save lightweight local URIs first so AsyncStorage never hits SQLITE_FULL
      await saveStudentIdCardsToStorage(
        {
          schoolIdFront: localSchoolFront,
          schoolIdBack: localSchoolBack,
          libraryIdFront: localLibraryFront,
          libraryIdBack: localLibraryBack,
          verifiedAt: new Date().toISOString(),
          ownerEmail: cleanEmail,
          ownerStudentId: cleanId,
        },
        cleanEmail,
        cleanId
      );

      // 3. Save profile to backend & local storage
      const res = await updateStudentProfile({
        name: cleanName,
        studentId: cleanId,
        email: cleanEmail,
        department,
        course,
        yearLevel,
        yearlevel: `${yearLevel} Year`,
        section,
        schoolIdFront: schoolFrontData,
        schoolIdBack: schoolBackData,
        libraryIdFront: libraryFrontData,
        libraryIdBack: libraryBackData,
      });

      if (!res.success) {
        setErrorMessage(res.message || "Failed to update profile. Please try again.");
        setLoading(false);
        return;
      }

      updateUser({
        fullName: cleanName,
        studentId: cleanId,
        email: cleanEmail,
        department,
        course,
        yearLevel,
        section,
        schoolIdFront: localSchoolFront,
        schoolIdBack: localSchoolBack,
        libraryIdFront: localLibraryFront,
        libraryIdBack: localLibraryBack,
        isNewUser: false,
      });

      // Navigate to tabs
      router.replace("/(tabs)");
    } catch (err) {
      console.log("Setup Error:", err);
      setErrorMessage("Something went wrong while saving details.");
    } finally {
      setLoading(false);
      setOcrVerifying(false);
    }
  };

  const currentCourses = DEPARTMENT_COURSES[department] || DEPARTMENT_COURSES.CICT;

  const schoolComplete = Boolean(schoolIdFront && schoolIdBack);
  const schoolPartial = Boolean(schoolIdFront || schoolIdBack) && !schoolComplete;

  const libraryComplete = Boolean(libraryIdFront && libraryIdBack);
  const libraryPartial = Boolean(libraryIdFront || libraryIdBack) && !libraryComplete;
  const uploadedCount = [schoolIdFront, schoolIdBack, libraryIdFront, libraryIdBack].filter(Boolean).length;

  return (
    <AnimatedScreen style={{ flex: 1 }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContainer,
            {
              paddingTop: Math.max(insets.top + 10, 28),
              paddingBottom: Math.max(insets.bottom + 16, 32),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* TOP HEADER ROW WITH BACK BUTTON */}
          <View style={styles.topHeaderRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackToLogin}
              activeOpacity={0.7}
              accessibilityLabel="Back to Login"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={22} color="#FFC800" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>BOOKHIVE</Text>

            <View style={styles.backButtonPlaceholder} />
          </View>

          <View style={styles.card}>
            <View>
              {/* NAME: */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>NAME:</Text>
                <TextInput
                  style={styles.underlineInput}
                  placeholder="Juan Dela Cruz"
                  placeholderTextColor="#475569"
                  value={name}
                  onChangeText={(v) => {
                    setName(v);
                    setErrorMessage("");
                    setOcrError("");
                  }}
                  autoCapitalize="words"
                />
              </View>

              {/* ID NO. */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>ID NO.</Text>
                <TextInput
                  style={styles.underlineInput}
                  placeholder="23-1111-111"
                  placeholderTextColor="#475569"
                  value={idNumber}
                  onChangeText={handleIdNumberChange}
                  keyboardType="numeric"
                  maxLength={11}
                  autoCapitalize="none"
                />
              </View>

              {/* UNIVERSITY EMAIL: */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>UNIVERSITY EMAIL:</Text>
                <TextInput
                  style={styles.underlineInput}
                  placeholder="student@wnu.sti.edu.ph"
                  placeholderTextColor="#475569"
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    setErrorMessage("");
                    setOcrError("");
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* 2x2 GRID OF DROPDOWNS */}
              <View style={styles.gridRow}>
                {/* DEPARTMENT */}
                <TouchableOpacity
                  style={styles.dropdownBox}
                  activeOpacity={0.8}
                  onPress={() => setActivePicker("department")}
                >
                  <Text style={styles.dropdownHeaderLabel}>DEPARTMENT</Text>
                  <View style={styles.dropdownValueRow}>
                    <Text style={styles.dropdownValueText}>{department}</Text>
                    <Ionicons name="chevron-down" size={18} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>

                {/* COURSE */}
                <TouchableOpacity
                  style={styles.dropdownBox}
                  activeOpacity={0.8}
                  onPress={() => setActivePicker("course")}
                >
                  <Text style={styles.dropdownHeaderLabel}>COURSE</Text>
                  <View style={styles.dropdownValueRow}>
                    <Text style={styles.dropdownValueText}>{course}</Text>
                    <Ionicons name="chevron-down" size={18} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.gridRow}>
                {/* YEAR LEVEL */}
                <TouchableOpacity
                  style={styles.dropdownBox}
                  activeOpacity={0.8}
                  onPress={() => setActivePicker("yearLevel")}
                >
                  <Text style={styles.dropdownHeaderLabel}>YEAR LEVEL</Text>
                  <View style={styles.dropdownValueRow}>
                    <Text style={styles.dropdownValueText}>{yearLevel}</Text>
                    <Ionicons name="chevron-down" size={18} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>

                {/* SECTION */}
                <TouchableOpacity
                  style={styles.dropdownBox}
                  activeOpacity={0.8}
                  onPress={() => setActivePicker("section")}
                >
                  <Text style={styles.dropdownHeaderLabel}>SECTION</Text>
                  <View style={styles.dropdownValueRow}>
                    <Text style={styles.dropdownValueText}>{section}</Text>
                    <Ionicons name="chevron-down" size={18} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              </View>

              {/* ======================================================== */}
              {/* ID VERIFICATION SECTION (SCHOOL ID & LIBRARY ID) */}
              {/* ======================================================== */}
              <View style={styles.idSectionContainer}>
                {/* 4 ID UPLOAD ACTION BUTTON */}
                <TouchableOpacity
                  style={styles.heroUploadAllButton}
                  activeOpacity={0.85}
                  onPress={handleUploadAllFourIds}
                  accessibilityRole="button"
                  accessibilityLabel="Upload 4 Required ID Photos"
                >
                  <View style={styles.heroUploadAllIconWrap}>
                    <Ionicons name="images" size={24} color="#080F1E" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.heroUploadAllTitle}>
                      Upload 4 Required ID Photos
                    </Text>
                    <Text style={styles.heroUploadAllSub}>
                      School ID & Library ID • Front & Back
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.heroUploadAllBadge,
                      uploadedCount === 4
                        ? styles.heroUploadAllBadgeComplete
                        : styles.heroUploadAllBadgePending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.heroUploadAllBadgeText,
                        uploadedCount === 4 && { color: "#10B981" },
                      ]}
                    >
                      {uploadedCount === 4 ? "4/4 READY ✓" : `${uploadedCount}/4 UPLOADED`}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.sectionTitleRow}>
                  <Ionicons name="shield-checkmark" size={18} color="#FFC800" />
                  <Text style={styles.sectionTitle}>REQUIRED ID VERIFICATION</Text>
                </View>
                <Text style={styles.sectionSubtitle}>
                  Please capture both the Front and Back of your School ID and Library ID. Our OCR scanner will verify that your Name and ID Number match your entered credentials.
                </Text>

                {/* PORTRAIT / LANDSCAPE ORIENTATION SELECTOR */}
                <View
                  style={{
                    backgroundColor: "#172238",
                    borderRadius: 14,
                    padding: 10,
                    marginBottom: 14,
                    borderWidth: 1,
                    borderColor: "#253450",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons name="crop-outline" size={15} color="#FFC800" />
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "800",
                          color: "#F8FAFC",
                        }}
                      >
                        ID Capture Orientation
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 10.5,
                        fontWeight: "600",
                        color: "#94A3B8",
                      }}
                    >
                      {idCaptureOrientation === "portrait"
                        ? "Vertical (10:16)"
                        : "Horizontal (16:10)"}
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => setIdCaptureOrientation("portrait")}
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        paddingVertical: 9,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        backgroundColor:
                          idCaptureOrientation === "portrait"
                            ? "rgba(255, 200, 0, 0.16)"
                            : "#0F172A",
                        borderColor:
                          idCaptureOrientation === "portrait"
                            ? "#FFC800"
                            : "#334155",
                      }}
                    >
                      <Ionicons
                        name="phone-portrait-outline"
                        size={15}
                        color={idCaptureOrientation === "portrait" ? "#FFC800" : "#94A3B8"}
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "800",
                          color: idCaptureOrientation === "portrait" ? "#FFC800" : "#CBD5E1",
                        }}
                      >
                        Portrait (Vertical)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => setIdCaptureOrientation("landscape")}
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        paddingVertical: 9,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        backgroundColor:
                          idCaptureOrientation === "landscape"
                            ? "rgba(255, 200, 0, 0.16)"
                            : "#0F172A",
                        borderColor:
                          idCaptureOrientation === "landscape"
                            ? "#FFC800"
                            : "#334155",
                      }}
                    >
                      <Ionicons
                        name="phone-landscape-outline"
                        size={15}
                        color={idCaptureOrientation === "landscape" ? "#FFC800" : "#94A3B8"}
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "800",
                          color: idCaptureOrientation === "landscape" ? "#FFC800" : "#CBD5E1",
                        }}
                      >
                        Landscape (Horizontal)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 1. SCHOOL ID BOX */}
                <View style={[styles.idCardBox, schoolComplete && styles.idCardBoxComplete]}>
                  <View style={styles.idCardHeader}>
                    <View style={styles.idCardHeaderLeft}>
                      <Ionicons name="school" size={18} color="#FFC800" />
                      <Text style={styles.idCardTitle}>SCHOOL ID</Text>
                    </View>
                    {schoolComplete ? (
                      <View style={styles.badgeReady}>
                        <Text style={styles.badgeReadyText}>✓ READY</Text>
                      </View>
                    ) : schoolPartial ? (
                      <View style={styles.badgePartial}>
                        <Text style={styles.badgePartialText}>1/2 SIDES</Text>
                      </View>
                    ) : (
                      <View style={styles.badgeMissing}>
                        <Text style={styles.badgeMissingText}>REQUIRED</Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.scanBothButton}
                    activeOpacity={0.8}
                    onPress={() => handleScanFullId("school")}
                  >
                    <Ionicons name="camera" size={16} color="#FFC800" />
                    <Text style={styles.scanBothButtonText}>
                      {schoolComplete ? "RETAKE SCHOOL ID (FRONT & BACK)" : "SCAN SCHOOL ID (FRONT & BACK)"}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.slotsRow}>
                    {/* FRONT SLOT */}
                    <TouchableOpacity
                      style={[styles.slotBox, Boolean(schoolIdFront) && styles.slotBoxFilled]}
                      activeOpacity={0.8}
                      onPress={() => handleSlotPress("schoolFront", "School ID (Front)")}
                    >
                      {schoolIdFront ? (
                        <>
                          <Image
                            source={{ uri: schoolIdFront.uri }}
                            style={styles.slotImage}
                            resizeMode="contain"
                          />
                          <View style={styles.slotPill}>
                            <Text style={styles.slotPillText}>FRONT</Text>
                          </View>
                          <View style={styles.slotRetakeBtn}>
                            <Ionicons name="camera" size={10} color="#000" />
                            <Text style={styles.slotRetakeText}>Retake</Text>
                          </View>
                        </>
                      ) : (
                        <>
                          <Ionicons name="camera-outline" size={24} color="#94A3B8" />
                          <Text style={styles.slotPlaceholderText}>Front Side</Text>
                          <Text style={styles.slotSubtext}>Tap to capture</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    {/* BACK SLOT */}
                    <TouchableOpacity
                      style={[styles.slotBox, Boolean(schoolIdBack) && styles.slotBoxFilled]}
                      activeOpacity={0.8}
                      onPress={() => handleSlotPress("schoolBack", "School ID (Back)")}
                    >
                      {schoolIdBack ? (
                        <>
                          <Image
                            source={{ uri: schoolIdBack.uri }}
                            style={styles.slotImage}
                            resizeMode="contain"
                          />
                          <View style={styles.slotPill}>
                            <Text style={styles.slotPillText}>BACK</Text>
                          </View>
                          <View style={styles.slotRetakeBtn}>
                            <Ionicons name="camera" size={10} color="#000" />
                            <Text style={styles.slotRetakeText}>Retake</Text>
                          </View>
                        </>
                      ) : (
                        <>
                          <Ionicons name="camera-outline" size={24} color="#94A3B8" />
                          <Text style={styles.slotPlaceholderText}>Back Side</Text>
                          <Text style={styles.slotSubtext}>Tap to capture</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 2. LIBRARY ID BOX */}
                <View style={[styles.idCardBox, libraryComplete && styles.idCardBoxComplete]}>
                  <View style={styles.idCardHeader}>
                    <View style={styles.idCardHeaderLeft}>
                      <Ionicons name="card" size={18} color="#FFC800" />
                      <Text style={styles.idCardTitle}>LIBRARY ID</Text>
                    </View>
                    {libraryComplete ? (
                      <View style={styles.badgeReady}>
                        <Text style={styles.badgeReadyText}>✓ READY</Text>
                      </View>
                    ) : libraryPartial ? (
                      <View style={styles.badgePartial}>
                        <Text style={styles.badgePartialText}>1/2 SIDES</Text>
                      </View>
                    ) : (
                      <View style={styles.badgeMissing}>
                        <Text style={styles.badgeMissingText}>REQUIRED</Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.scanBothButton}
                    activeOpacity={0.8}
                    onPress={() => handleScanFullId("library")}
                  >
                    <Ionicons name="camera" size={16} color="#FFC800" />
                    <Text style={styles.scanBothButtonText}>
                      {libraryComplete ? "RETAKE LIBRARY ID (FRONT & BACK)" : "SCAN LIBRARY ID (FRONT & BACK)"}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.slotsRow}>
                    {/* FRONT SLOT */}
                    <TouchableOpacity
                      style={[styles.slotBox, Boolean(libraryIdFront) && styles.slotBoxFilled]}
                      activeOpacity={0.8}
                      onPress={() => handleSlotPress("libraryFront", "Library ID (Front)")}
                    >
                      {libraryIdFront ? (
                        <>
                          <Image
                            source={{ uri: libraryIdFront.uri }}
                            style={styles.slotImage}
                            resizeMode="contain"
                          />
                          <View style={styles.slotPill}>
                            <Text style={styles.slotPillText}>FRONT</Text>
                          </View>
                          <View style={styles.slotRetakeBtn}>
                            <Ionicons name="camera" size={10} color="#000" />
                            <Text style={styles.slotRetakeText}>Retake</Text>
                          </View>
                        </>
                      ) : (
                        <>
                          <Ionicons name="camera-outline" size={24} color="#94A3B8" />
                          <Text style={styles.slotPlaceholderText}>Front Side</Text>
                          <Text style={styles.slotSubtext}>Tap to capture</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    {/* BACK SLOT */}
                    <TouchableOpacity
                      style={[styles.slotBox, Boolean(libraryIdBack) && styles.slotBoxFilled]}
                      activeOpacity={0.8}
                      onPress={() => handleSlotPress("libraryBack", "Library ID (Back)")}
                    >
                      {libraryIdBack ? (
                        <>
                          <Image
                            source={{ uri: libraryIdBack.uri }}
                            style={styles.slotImage}
                            resizeMode="contain"
                          />
                          <View style={styles.slotPill}>
                            <Text style={styles.slotPillText}>BACK</Text>
                          </View>
                          <View style={styles.slotRetakeBtn}>
                            <Ionicons name="camera" size={10} color="#000" />
                            <Text style={styles.slotRetakeText}>Retake</Text>
                          </View>
                        </>
                      ) : (
                        <>
                          <Ionicons name="camera-outline" size={24} color="#94A3B8" />
                          <Text style={styles.slotPlaceholderText}>Back Side</Text>
                          <Text style={styles.slotSubtext}>Tap to capture</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* OCR STATUS FEEDBACK BOXES */}
                {ocrVerifying ? (
                  <View style={styles.ocrVerifyingBox}>
                    <ActivityIndicator size="small" color="#FFC800" />
                    <Text style={styles.ocrVerifyingText}>
                      Scanning ID cards via OCR & verifying identity...
                    </Text>
                  </View>
                ) : ocrError ? (
                  <View style={styles.ocrErrorBox}>
                    <Ionicons name="alert-circle" size={20} color="#EF4444" style={{ marginTop: 1 }} />
                    <Text style={styles.ocrErrorText}>{ocrError}</Text>
                  </View>
                ) : ocrVerified ? (
                  <View style={styles.ocrSuccessBox}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <Text style={styles.ocrSuccessText}>Identity Verified Successfully via OCR ✓</Text>
                  </View>
                ) : (
                  <View style={styles.ocrNoticeBox}>
                    <Ionicons name="information-circle-outline" size={18} color="#FFC800" style={{ marginTop: 1 }} />
                    <Text style={styles.ocrNoticeText}>
                      BookHive requires student identity validation. If the Name or ID Number detected on your ID cards does not match your entered credentials, access will be blocked until retaken.
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Error Message */}
            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}

            {/* DONE BUTTON */}
            <TouchableOpacity
              style={styles.doneButton}
              activeOpacity={0.85}
              onPress={handleDone}
              disabled={loading}
            >
              <Text style={styles.doneButtonText}>
                {loading ? (ocrVerifying ? "VERIFYING OCR..." : "SAVING...") : "DONE"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* SELECTION MODAL */}
        <Modal
          visible={activePicker !== null}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setActivePicker(null)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setActivePicker(null)}
          >
            <TouchableOpacity
              style={styles.modalContent}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {activePicker === "department" && "Select Department"}
                  {activePicker === "course" && "Select Course"}
                  {activePicker === "yearLevel" && "Select Year Level"}
                  {activePicker === "section" && "Select Section"}
                </Text>
                <TouchableOpacity onPress={() => setActivePicker(null)}>
                  <Ionicons name="close" size={22} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {activePicker === "department" &&
                  DEPARTMENTS.map((dept) => {
                    const isSelected = department === dept.code;
                    return (
                      <TouchableOpacity
                        key={dept.code}
                        style={[styles.modalItem, isSelected && styles.modalItemActive]}
                        onPress={() => handleDepartmentSelect(dept.code)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.modalItemText, isSelected && styles.modalItemTextActive]}>
                            {dept.code}
                          </Text>
                          <Text style={styles.modalItemSub}>{dept.name}</Text>
                        </View>
                        {isSelected && <Ionicons name="checkmark" size={18} color="#FFC800" />}
                      </TouchableOpacity>
                    );
                  })}

                {activePicker === "course" &&
                  currentCourses.map((c) => {
                    const isSelected = course === c.code;
                    return (
                      <TouchableOpacity
                        key={c.code}
                        style={[styles.modalItem, isSelected && styles.modalItemActive]}
                        onPress={() => {
                          setCourse(c.code);
                          setActivePicker(null);
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.modalItemText, isSelected && styles.modalItemTextActive]}>
                            {c.code}
                          </Text>
                          <Text style={styles.modalItemSub}>{c.name}</Text>
                        </View>
                        {isSelected && <Ionicons name="checkmark" size={18} color="#FFC800" />}
                      </TouchableOpacity>
                    );
                  })}

                {activePicker === "yearLevel" &&
                  YEAR_LEVELS.map((yr) => {
                    const isSelected = yearLevel === yr;
                    return (
                      <TouchableOpacity
                        key={yr}
                        style={[styles.modalItem, isSelected && styles.modalItemActive]}
                        onPress={() => {
                          setYearLevel(yr);
                          setActivePicker(null);
                        }}
                      >
                        <Text style={[styles.modalItemText, isSelected && styles.modalItemTextActive]}>
                          {yr} YEAR
                        </Text>
                        {isSelected && <Ionicons name="checkmark" size={18} color="#FFC800" />}
                      </TouchableOpacity>
                    );
                  })}

                {activePicker === "section" &&
                  SECTIONS.map((sec) => {
                    const isSelected = section === sec;
                    return (
                      <TouchableOpacity
                        key={sec}
                        style={[styles.modalItem, isSelected && styles.modalItemActive]}
                        onPress={() => {
                          setSection(sec);
                          setActivePicker(null);
                        }}
                      >
                        <Text style={[styles.modalItemText, isSelected && styles.modalItemTextActive]}>
                          SECTION {sec}
                        </Text>
                        {isSelected && <Ionicons name="checkmark" size={18} color="#FFC800" />}
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </AnimatedScreen>
  );
}
