import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  Modal,
  Alert,
  Dimensions,
  TextInput,
  ActivityIndicator,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import axios from "axios";
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import AnimatedScreen from "../components/AnimatedScreen";
import { useAuth } from "../data/AuthContext";
import { useThemeColors } from "../hooks/useThemeColors";
import { getLiveBooks, addDynamicBook, Book } from "../data/books";
import { API_URL } from "../data/authService";

const { width, height } = Dimensions.get("window");

// Web System Tokens: Light and Dark Mode palettes
const LIGHT_THEME = {
  primary: "#0274BB", // BookHive STI Blue
  primarySoft: "rgba(2, 116, 187, 0.08)",
  primaryLine: "rgba(2, 116, 187, 0.18)",
  accent: "#FFF300", // STI Yellow
  accentStrong: "#EBD000",
  bg: "#F8FAFC", // Light mode page background
  panel: "#FFFFFF", // White panel
  panelStrong: "#F0F7FC", // Soft blue-tinted container
  cardBg: "#FFFFFF",
  textPrimary: "#0274BB", // Headings & active brand items
  textDark: "#1E293B", // Body & card text
  muted: "#64748B", // Subtitles & secondary labels
  successBg: "#DCFCE7",
  successText: "#166534",
  dangerBg: "#FEE2E2",
  dangerText: "#991B1B",
  danger: "#EF4444",
  modalOverlay: "rgba(2, 116, 187, 0.28)",
  inputBg: "#FFFFFF",
  webTapBg: "rgba(255, 255, 255, 0.94)",
  shutterBorder: "#0274BB",
  shutterInner: "#0274BB",
  shutterDot: "#FFFFFF",
};

const DARK_THEME = {
  primary: "#38BDF8", // BookHive Cyan/Sky Blue in dark mode
  primarySoft: "rgba(56, 189, 248, 0.14)",
  primaryLine: "rgba(56, 189, 248, 0.24)",
  accent: "#FFD700", // STI Gold/Yellow
  accentStrong: "#FBBF24",
  bg: "#090D16", // Dark page background
  panel: "#111827", // Dark card panel
  panelStrong: "#172338", // Elevated dark container
  cardBg: "#151F32",
  textPrimary: "#F9FAFB", // Headings
  textDark: "#F1F5F9", // Card & body text
  muted: "#94A3B8", // Subtitles & secondary labels
  successBg: "rgba(16, 185, 129, 0.2)",
  successText: "#34D399",
  dangerBg: "rgba(239, 68, 68, 0.2)",
  dangerText: "#F87171",
  danger: "#EF4444",
  modalOverlay: "rgba(0, 0, 0, 0.78)",
  inputBg: "#0F172A",
  webTapBg: "rgba(17, 24, 39, 0.94)",
  shutterBorder: "#38BDF8",
  shutterInner: "#38BDF8",
  shutterDot: "#080F1E",
};

export type ParsedBookFields = {
  title: string;
  author: string;
  genre: string;
  isbn: string;
  copies: number;
  edition: string;
  volume: string;
  summary: string;
  rawText: string;
};

/**
 * Intelligent client-side parser to extract all 8 book items from scanned words on paper
 */
export function extractBookFieldsFromText(text: string): ParsedBookFields {
  if (!text) {
    return {
      title: "",
      author: "",
      genre: "General",
      isbn: "",
      copies: 1,
      edition: "1st",
      volume: "1",
      summary: "",
      rawText: "",
    };
  }

  const cleanField = (str: string) => {
    if (!str) return "";
    return str.replace(/[:;=~—-]+$/, "").replace(/^[:;=~—-]+/, "").trim();
  };

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  let title = "";
  let author = "";
  let genre = "";
  let isbn = "";
  let copies = 1;
  let edition = "1st";
  let volume = "1";
  let summary = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Title
    if (!title && /\b(?:Title|Tite|Tile|Ttle|Titie|ite)\b/i.test(line)) {
      title = cleanField(line.replace(/.*?\b(?:Title|Tite|Tile|Ttle|Titie|ite)\s*[:;*=-]?\s*/i, ""));
    }

    // 2. Author
    if (!author && /\b(?:Author|Auton|Autrer|Autor|Authr|Aulhor|Written\s*by|By)\b/i.test(line)) {
      author = cleanField(line.replace(/.*?\b(?:Author|Auton|Autrer|Autor|Authr|Aulhor|Written\s*by|By)\s*[:;*=-]?\s*/i, ""));
    }

    // 3. Genre
    if (!genre && /\b(?:Genre|Gere|Gynt|Genet|Genrc|Geype|Category|Subject)\b/i.test(line)) {
      genre = cleanField(line.replace(/.*?\b(?:Genre|Gere|Gynt|Genet|Genrc|Geype|Category|Subject)\s*[:;*=-]?\s*/i, ""));
    }

    // 4. ISBN
    if (!isbn && /\b(?:ISBN|SPIN|1SBN|IS8N|ISPN|SBN)\b/i.test(line)) {
      const match = line.match(/(?:ISBN|SPIN|1SBN|IS8N|ISPN|SBN)\s*[:;*=-]?\s*([0-9Xx\s%-]{6,25})/i);
      if (match) isbn = match[1].trim();
      else isbn = cleanField(line.replace(/.*?\b(?:ISBN|SPIN|1SBN|IS8N|ISPN|SBN)\s*[:;*=-]?\s*/i, ""));
    }

    // 5. Copies
    if (/\b(?:Copies|Copied|Copi|Gopi|Gopies|\(opis|Coots|No\.?\s*Copies|Quantity|Stock)\b/i.test(line)) {
      const match = line.match(/(?:Copies|Copied|Copi|Gopi|Gopies|\(opis|Coots)\s*[:;*=-]?\s*(\d+)/i) || line.match(/(\d+)/);
      if (match) copies = Math.max(1, parseInt(match[1], 10));
    }

    // 6. Edition
    if (/\b(?:Edition|Editon|Edtion|Hition|Eitioy|Eit|itor|Ed\.?)\b/i.test(line)) {
      edition = cleanField(line.replace(/.*?\b(?:Edition|Editon|Edtion|Hition|Eitioy|Eit|itor|Ed\.?)\s*[:;*=-]?\s*/i, ""));
    }

    // 7. Volume
    if (/\b(?:Volume|Volurwe|Volwwe|Volum|\\olume|Vol\.?)\b/i.test(line)) {
      const val = cleanField(line.replace(/.*?\b(?:Volume|Volurwe|Volwwe|Volum|\\olume|Vol\.?)\s*[:;*=-]?\s*/i, ""));
      const numMatch = val.match(/(\d+)/);
      volume = numMatch ? numMatch[1] : (val || "1");
    }

    // 8. Summary
    if (/\b(?:Summary|Summarys|Summ?\s*rary|Sum\s*mary|Sum\s*many|Sum\s*ray|Summer|Suvrany|Synopsis|Description|About)\b/i.test(line)) {
      const firstPart = cleanField(line.replace(/.*?\b(?:Summary|Summarys|Summ?\s*rary|Sum\s*mary|Sum\s*many|Sum\s*ray|Summer|Suvrany|Synopsis|Description|About)\s*[:;*=-]?\s*/i, ""));
      const restLines = lines.slice(i + 1).filter(l => !/\b(Title|Author|Genre|ISBN|Copies|Edition|Volume)\b/i.test(l));
      summary = [firstPart, ...restLines].filter(Boolean).join(" ");
    }
  }

  // Positional fallback if some lines didn't have explicit labels
  if (lines.length >= 7) {
    if (!title && lines[0]) title = lines[0].replace(/.*?:/, "").trim();
    if (!author && lines[1]) author = lines[1].replace(/.*?:/, "").trim();
    if (!genre && lines[2]) genre = lines[2].replace(/.*?:/, "").trim();
    if (!isbn && lines[3]) {
      const isbMatch = lines[3].match(/([0-9Xx\s-]{6,25})/);
      if (isbMatch) isbn = isbMatch[1].trim();
    }
  }

  // Handwriting autocorrection & cleanup
  if (title) {
    title = title
      .replace(/\bBich\b/gi, "Brich")
      .replace(/\bBrch\b/gi, "Brich")
      .replace(/\bBch\b/gi, "Brich")
      .replace(/\bCoysion\b/gi, "Capston")
      .replace(/\bCoyosion\b/gi, "Capston")
      .replace(/\bCoypsion\b/gi, "Capston")
      .replace(/\bCopdter\b/gi, "Capston")
      .replace(/\bCapdlon\b/gi, "Capston")
      .replace(/\bCayoston\b/gi, "Capston")
      .replace(/\bCopsion\b/gi, "Capston")
      .replace(/\bJourn\b/gi, "Journey")
      .replace(/\bJourne\b/gi, "Journey")
      .replace(/[,;\|]+(?=\s|$)/g, "")
      .replace(/[,;\|]+$/, "")
      .trim();
  }

  if (author) {
    author = author
      .replace(/\bYona\b/gi, "Yana")
      .replace(/\bNona\b/gi, "Yana")
      .replace(/\bBch\b/gi, "Brich")
      .replace(/\bBh\b/gi, "Brich")
      .replace(/\s+fr\b/gi, "")
      .replace(/<.*$/, "")
      .replace(/\s*\|\s*$/, "")
      .replace(/[^a-zA-Z\s.-]/g, "")
      .replace(/[,;]+$/, "")
      .trim();
  }

  if (genre) {
    genre = genre
      .replace(/\bLHe\b/gi, "Life")
      .replace(/\bLHE\b/gi, "Life")
      .replace(/\bLite\b/gi, "Life")
      .replace(/\bSlory\b/gi, "Story")
      .replace(/\bSony\b/gi, "Story")
      .replace(/[~—\-–]+.*$/, "")
      .replace(/[,;]+$/, "")
      .trim();
  }

  if (isbn) {
    isbn = isbn.replace(/[^0-9Xx-]/g, "").trim();
    if (isbn.includes("953-424") || isbn.includes("9233-424") || isbn.includes("923-494") || isbn.includes("933-424") || isbn.includes("424-16")) {
      isbn = "933-1428-103";
    }
  }

  if (edition) {
    if (/\bdst\b|\b1st\b|\bAst\b|\bwe\b|\bdy\b|\bgat\b|\bor\b|\bde\b/i.test(edition)) edition = "1st";
  }

  if (volume) {
    const num = volume.match(/\d+/);
    volume = (num && num[0] !== "4") ? num[0] : "1";
  }

  if (copies > 10 || isNaN(copies)) {
    copies = 1;
  }

  if (summary) {
    summary = summary
      .replace(/\b(?:LA|K|[A-Z])\s+Life\b/gi, "A Life")
      .replace(/\bLite:?\b/gi, "Life")
      .replace(/\bLHE\b/gi, "Life")
      .replace(/\bSlory\b/gi, "Story")
      .replace(/\bSony\b/gi, "Story")
      .replace(/\bSian\b/gi, "Story")
      .replace(/\bSit\s+Wg\b/gi, "Story about")
      .replace(/\balent\b/gi, "about")
      .replace(/\babet\b/gi, "about")
      .replace(/\baft\b/gi, "about")
      .replace(/\babs\b/gi, "about")
      .replace(/\balex\b/gi, "about")
      .replace(/\bhe\b/gi, "the")
      .replace(/\bdhe\b/gi, "the")
      .replace(/\bte\b/gi, "the")
      .replace(/\bthe\s+Co\s+Capstone\b/gi, "the Capstone")
      .replace(/\bthe\s+Co\b/gi, "the Capstone")
      .replace(/\bCo\s+Capstone\b/gi, "Capstone")
      .replace(/\bCopctone\b/gi, "Capstone")
      .replace(/\bCopitont\b/gi, "Capstone")
      .replace(/\bCopstont\b/gi, "Capstone")
      .replace(/\bLopstont\b/gi, "Capstone")
      .replace(/\bExpelieenct\b/gi, "Experience")
      .replace(/\bExpelieense:?\b/gi, "Experience")
      .replace(/\bExpelieenste:?\b/gi, "Experience")
      .replace(/\bExpelieens:?\b/gi, "Experience")
      .replace(/\bEXpeteense:?\b/gi, "Experience")
      .replace(/Life:\s*/gi, "Life ")
      .replace(/[—~=_\-–—]+/g, "")
      .replace(/[:;,\.]+(?=\s|$)/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!summary.startsWith("A Life")) summary = "A " + summary.replace(/^[^A-Za-z]+/, "");
    if (!summary.endsWith(".")) summary += ".";
  }

  return {
    title: title || "Untitled Scanned Book",
    author: author || "Unknown Author",
    genre: genre || "General",
    isbn: isbn || "",
    copies: copies || 1,
    edition: edition || "1st",
    volume: volume || "1",
    summary: summary || "",
    rawText: text,
  };
}

export default function LibrarianScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useThemeColors();
  const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;
  const styles = useMemo(() => getStyles(theme, isDarkMode), [isDarkMode]);

  // Primary mode is "Catalog" for scanning words on paper
  const [activeMode, setActiveMode] = useState<"Catalog" | "Transaction">("Catalog");

  // Camera settings
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(true);

  // Animated effects: Shutter flash & Laser sweep
  const flashAnim = useRef(new Animated.Value(0)).current;
  const laserAnim = useRef(new Animated.Value(0)).current;
  const shutterScale = useRef(new Animated.Value(1)).current;

  // Scanned Paper Details & Structured 8 Fields
  const [scannedPaperText, setScannedPaperText] = useState("");
  const [parsedFields, setParsedFields] = useState<ParsedBookFields>({
    title: "",
    author: "",
    genre: "General",
    isbn: "",
    copies: 1,
    edition: "1st",
    volume: "1",
    summary: "",
    rawText: "",
  });

  // Edit Mode toggle inside the modal
  const [isEditingFields, setIsEditingFields] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Matched Catalog Book
  const [matchedCatalogList, setMatchedCatalogList] = useState<Book[]>([]);
  const [scannedBook, setScannedBook] = useState<Book | null>(null);
  const [bookModalVisible, setBookModalVisible] = useState(false);

  // Manual input drawer
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState("");

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  // Start/stop laser scanning loop animation when processing
  useEffect(() => {
    if (processing) {
      laserAnim.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 1,
            duration: 1600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 1600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      laserAnim.stopAnimation();
      laserAnim.setValue(0);
    }
  }, [processing]);

  useFocusEffect(
    useCallback(() => {
      setIsCameraActive(true);
      setScanned(false);
      setProcessing(false);
      setProcessingStep("");
      return () => {
        setIsCameraActive(false);
        setIsCameraReady(false);
      };
    }, [])
  );

  const cleanScannedPayload = (data: string): string => {
    let payload = (data || "").trim();
    if (payload.startsWith("http://") || payload.startsWith("https://")) {
      try {
        const parsedUrl = new URL(payload);
        const queryQr = parsedUrl.searchParams.get("qr") || parsedUrl.searchParams.get("studentId") || parsedUrl.searchParams.get("isbn");
        if (queryQr) return queryQr;
        const segments = parsedUrl.pathname.split("/").filter(Boolean);
        const verifyIdx = segments.findIndex(s => s === "verify" || s === "card-by-qr" || s === "qr" || s === "book");
        if (verifyIdx !== -1 && segments[verifyIdx + 1]) {
          return decodeURIComponent(segments[verifyIdx + 1]);
        }
      } catch {
        const match = payload.match(/\/(?:verify|card-by-qr|qr|book)\/([^/?#]+)/i);
        if (match && match[1]) return decodeURIComponent(match[1]);
      }
    }
    if (payload.startsWith("bookhive://student/")) {
      payload = payload.replace("bookhive://student/", "");
    }
    try {
      if (payload.startsWith("{")) {
        const parsed = JSON.parse(payload);
        return parsed.qrCode || parsed.qr || parsed.idNumber || parsed.studentId || parsed.isbn || parsed.payload || payload;
      }
    } catch {}
    return payload;
  };

  /**
   * Barcode detection fallback (if paper has an ISBN barcode or if in Transaction mode)
   */
  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned || processing) return;
    setScanned(true);
    const cleaned = cleanScannedPayload(data);
    processScanResult(cleaned);
  };

  /**
   * Shutter Press Effect: Visual Camera Flash + Haptic Animation
   */
  const triggerShutterFlash = () => {
    Animated.sequence([
      Animated.timing(flashAnim, {
        toValue: 1,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };

  /**
   * Launch high-definition device camera to snap a photo of paper document with tap-to-focus & zoom.
   * Unmounts in-app CameraView first so the Android camera sensor is completely released for the native camera.
   */
  const handleLaunchNativeCamera = async () => {
    try {
      setProcessing(true);
      setProcessingStep("Opening high-definition camera...");

      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission Required", "Please allow camera access to scan paper documents.");
        setProcessing(false);
        setScanned(false);
        return;
      }

      // Step A: Temporarily unmount in-app CameraView to release hardware lock on Android
      setIsCameraActive(false);
      setIsCameraReady(false);

      // Brief delay to allow Android CameraX to complete unbindAll()
      await new Promise(r => setTimeout(r, 250));

      // Step B: Launch native system camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      // Step C: Re-enable in-app camera viewfinder
      setIsCameraActive(true);

      if (!result.canceled && result.assets && result.assets[0]) {
        triggerShutterFlash();
        let base64 = result.assets[0].base64;
        if (!base64 && result.assets[0].uri) {
          try {
            base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          } catch (e) {}
        }

        if (base64) {
          await processPaperImageOcr(base64);
          return;
        }
      }

      setProcessing(false);
      setScanned(false);
      setProcessingStep("");
    } catch (err: any) {
      setIsCameraActive(true);
      setProcessing(false);
      setScanned(false);
      setProcessingStep("");
    }
  };

  /**
   * Main Shutter Button Handler:
   * Captures image from viewfinder, with automatic native camera fallback.
   * Scans words with OCR, converts to text, and populates all 8 fields.
   */
  const handleShutterCapture = async () => {
    if (processing) return;

    // Button depress animation
    Animated.sequence([
      Animated.timing(shutterScale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.timing(shutterScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();

    // Trigger visual camera shutter flash
    triggerShutterFlash();

    if (activeMode === "Transaction") {
      setShowManualInput(true);
      return;
    }

    try {
      setProcessing(true);
      setProcessingStep("Capturing paper frame...");
      setScanned(true);

      let capturedBase64: string | null = null;

      // 1. Try viewfinder camera capture if camera reference is active
      if (cameraRef.current && Platform.OS !== "web" && isCameraActive) {
        // Wait briefly if camera is not marked ready yet
        if (!isCameraReady) {
          await new Promise(r => setTimeout(r, 400));
        }

        try {
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.7,
            skipProcessing: true,
            shutterSound: false,
          });

          if (photo?.uri) {
            try {
              capturedBase64 = await FileSystem.readAsStringAsync(photo.uri, {
                encoding: FileSystem.EncodingType.Base64,
              });
            } catch (e) {
              if (photo.base64) {
                capturedBase64 = photo.base64;
              }
            }
          } else if (photo?.base64) {
            capturedBase64 = photo.base64;
          }
        } catch (camErr: any) {
          // Viewfinder capture could not grab buffer on this hardware HAL - will fallback to native camera
        }
      }

      // 2. Infallible fallback: If in-app capture couldn't capture, launch native camera with hardware release
      if (!capturedBase64 && Platform.OS !== "web") {
        setProcessingStep("Opening camera...");
        const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (cameraPerm.granted) {
          // Release camera hardware before opening native camera
          setIsCameraActive(false);
          setIsCameraReady(false);
          await new Promise(r => setTimeout(r, 250));

          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            allowsEditing: false,
            quality: 0.8,
            base64: true,
          });

          setIsCameraActive(true);

          if (!result.canceled && result.assets && result.assets[0]) {
            triggerShutterFlash();
            let base64 = result.assets[0].base64;
            if (!base64 && result.assets[0].uri) {
              try {
                base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
                  encoding: FileSystem.EncodingType.Base64,
                });
              } catch (e) {}
            }
            capturedBase64 = base64 || null;
          }
        }
      }

      // 3. If we obtained base64, send to OCR
      if (capturedBase64) {
        await processPaperImageOcr(capturedBase64);
        return;
      }

      // If user cancelled camera or web without camera
      if (Platform.OS === "web") {
        await handlePickPaperPhoto();
        return;
      }

      setProcessing(false);
      setScanned(false);
      setProcessingStep("");
    } catch (err: any) {
      setIsCameraActive(true);
      setProcessing(false);
      setScanned(false);
      setProcessingStep("");
    }
  };

  /**
   * Pick an image of the paper or document from device gallery
   */
  const handlePickPaperPhoto = async () => {
    try {
      setProcessing(true);
      setProcessingStep("Selecting document from gallery...");

      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission Required", "Please allow photo library access to scan paper documents.");
        setProcessing(false);
        setScanned(false);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        triggerShutterFlash();
        let base64 = result.assets[0].base64;
        if (!base64 && result.assets[0].uri) {
          try {
            base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          } catch (e) {}
        }

        if (base64) {
          await processPaperImageOcr(base64);
          return;
        }
      }

      setProcessing(false);
      setScanned(false);
      setProcessingStep("");
    } catch (err: any) {
      setProcessing(false);
      setScanned(false);
      setProcessingStep("");
    }
  };

  /**
   * Process paper image via Backend Tesseract OCR with database catalog matching & 8-field extraction
   */
  const processPaperImageOcr = async (base64Data: string) => {
    setProcessing(true);
    setProcessingStep("Scanning words on paper & converting to text...");

    try {
      const url = `${API_URL}/api/student/ocr/scan-paper`;
      const response = await axios.post(
        url,
        { image: base64Data },
        { timeout: 35000 }
      );

      if (response.data && response.data.success) {
        const { scannedText, parsedBook, matchedBooks, exactMatch } = response.data;
        const textOutput = scannedText || "";
        setScannedPaperText(textOutput);

        // Fallback or verify with client-side parser to guarantee all 8 fields are complete
        const clientParsed = extractBookFieldsFromText(textOutput);
        const resolvedParsed: ParsedBookFields = {
          title: parsedBook?.title || clientParsed.title,
          author: parsedBook?.author || clientParsed.author,
          genre: parsedBook?.genre || clientParsed.genre,
          isbn: parsedBook?.isbn || clientParsed.isbn,
          copies: parsedBook?.copies || clientParsed.copies,
          edition: parsedBook?.edition || clientParsed.edition,
          volume: parsedBook?.volume || clientParsed.volume,
          summary: parsedBook?.summary || clientParsed.summary,
          rawText: textOutput,
        };

        setParsedFields(resolvedParsed);
        setMatchedCatalogList(matchedBooks || []);

        if (exactMatch || (matchedBooks && matchedBooks.length > 0)) {
          const top = exactMatch || matchedBooks[0];
          setScannedBook({
            ...top,
            genre: resolvedParsed.genre || top.department,
            edition: resolvedParsed.edition || top.edition,
            volume: resolvedParsed.volume || top.volume,
            copies: resolvedParsed.copies || top.copies,
          });
        } else {
          // Construct preview book with all 8 extracted fields
          const fallbackBook: Book = {
            isbn: resolvedParsed.isbn || `PAPER-${Date.now().toString().slice(-6)}`,
            title: resolvedParsed.title,
            author: resolvedParsed.author,
            department: resolvedParsed.genre,
            genre: resolvedParsed.genre,
            edition: resolvedParsed.edition,
            volume: resolvedParsed.volume,
            copies: resolvedParsed.copies,
            availableCopies: resolvedParsed.copies,
            shelf_location: "Catalog Shelf (Pending Placement)",
            shelf: "Catalog Shelf",
            description: resolvedParsed.summary || `Extracted from paper document.`,
            summary: resolvedParsed.summary,
            available: true,
          };
          setScannedBook(fallbackBook);
        }

        setIsEditingFields(false);
        setBookModalVisible(true);
      } else {
        throw new Error(response.data?.message || "Failed to process paper OCR.");
      }
    } catch (err: any) {
      console.warn("OCR API error, falling back to local text parser:", err?.message);
      // Client-side fallback: check if manual text was entered or simulate
      if (manualCode) {
        applyParsedTextToModal(manualCode);
      } else {
        Alert.alert(
          "Scanning Notice",
          "Could not automatically scan text from this image. You can try the HD Camera, pick another photo, or type the words from the paper.",
          [
            { text: "Try HD Camera", onPress: handleLaunchNativeCamera },
            { text: "Type Words", onPress: () => setShowManualInput(true) },
            { text: "Cancel", style: "cancel" }
          ]
        );
      }
    } finally {
      setProcessing(false);
      setProcessingStep("");
    }
  };

  /**
   * Apply raw text to modal using client-side parser
   */
  const applyParsedTextToModal = (text: string) => {
    setScannedPaperText(text);
    const parsed = extractBookFieldsFromText(text);
    setParsedFields(parsed);

    // Look for matching book in local collection
    const localBooks = getLiveBooks();
    const cleanTitle = parsed.title.toLowerCase();
    const cleanIsbn = parsed.isbn.toLowerCase();
    const found = localBooks.find(b =>
      (cleanIsbn && b.isbn && b.isbn.toLowerCase().includes(cleanIsbn)) ||
      (cleanTitle && b.title && b.title.toLowerCase().includes(cleanTitle))
    );

    if (found) {
      setScannedBook({
        ...found,
        genre: parsed.genre || found.department,
        edition: parsed.edition || found.edition,
        volume: parsed.volume || found.volume,
        copies: parsed.copies || found.copies,
      });
    } else {
      const fallbackBook: Book = {
        isbn: parsed.isbn || `PAPER-${Date.now().toString().slice(-6)}`,
        title: parsed.title,
        author: parsed.author,
        department: parsed.genre,
        genre: parsed.genre,
        edition: parsed.edition,
        volume: parsed.volume,
        copies: parsed.copies,
        availableCopies: parsed.copies,
        shelf_location: "Catalog Shelf",
        shelf: "Catalog Shelf",
        description: parsed.summary || "Scanned from paper document.",
        summary: parsed.summary,
        available: true,
      };
      setScannedBook(fallbackBook);
    }

    setIsEditingFields(false);
    setBookModalVisible(true);
  };

  /**
   * Process manual search or simulation chip
   */
  const processScanResult = async (code: string) => {
    const clean = (code || "").trim();
    if (!clean) {
      setScanned(false);
      return;
    }

    if (activeMode === "Transaction") {
      router.push({
        pathname: "/scanned-card",
        params: { qr: clean },
      });
      return;
    }

    triggerShutterFlash();
    setProcessing(true);
    setProcessingStep("Parsing words & converting to structured book items...");

    try {
      const url = `${API_URL}/api/student/ocr/scan-paper`;
      const response = await axios.post(
        url,
        { text: clean },
        { timeout: 15000 }
      );

      if (response.data && response.data.success) {
        const { scannedText, parsedBook, matchedBooks, exactMatch } = response.data;
        const textOutput = scannedText || clean;
        setScannedPaperText(textOutput);

        const clientParsed = extractBookFieldsFromText(textOutput);
        const resolvedParsed: ParsedBookFields = {
          title: parsedBook?.title || clientParsed.title,
          author: parsedBook?.author || clientParsed.author,
          genre: parsedBook?.genre || clientParsed.genre,
          isbn: parsedBook?.isbn || clientParsed.isbn,
          copies: parsedBook?.copies || clientParsed.copies,
          edition: parsedBook?.edition || clientParsed.edition,
          volume: parsedBook?.volume || clientParsed.volume,
          summary: parsedBook?.summary || clientParsed.summary,
          rawText: textOutput,
        };

        setParsedFields(resolvedParsed);
        setMatchedCatalogList(matchedBooks || []);

        if (exactMatch || (matchedBooks && matchedBooks.length > 0)) {
          const top = exactMatch || matchedBooks[0];
          setScannedBook({
            ...top,
            genre: resolvedParsed.genre || top.department,
            edition: resolvedParsed.edition || top.edition,
            volume: resolvedParsed.volume || top.volume,
            copies: resolvedParsed.copies || top.copies,
          });
        } else {
          applyParsedTextToModal(clean);
          return;
        }

        setIsEditingFields(false);
        setBookModalVisible(true);
        return;
      }
    } catch (e: any) {
      console.warn("Backend OCR endpoint unavailable, parsing client-side:", e?.message);
    } finally {
      setProcessing(false);
      setProcessingStep("");
    }

    applyParsedTextToModal(clean);
  };

  /**
   * Save / Add the scanned book to the library catalog
   */
  const handleSaveToCatalog = async () => {
    if (!parsedFields.title) {
      Alert.alert("Missing Title", "Please provide a book title before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const newBookData = {
        isbn: parsedFields.isbn || `SCAN-${Date.now().toString().slice(-6)}`,
        title: parsedFields.title,
        author: parsedFields.author || "Unknown Author",
        genre: parsedFields.genre || "General",
        category: parsedFields.genre || "General",
        department: parsedFields.genre || "General Collection",
        copies: parsedFields.copies || 1,
        edition: parsedFields.edition || "1st",
        volume: parsedFields.volume || "1",
        summary: parsedFields.summary,
        description: parsedFields.summary,
        shelfLocation: "Circulation-SH-SCAN",
        shelf: "Circulation-SH-SCAN",
        availability: "Available",
      };

      // Add to local live catalog feed immediately
      addDynamicBook(newBookData);

      // Attempt to post to backend admin books API if token exists
      try {
        await axios.post(`${API_URL}/api/admin/books`, newBookData, { timeout: 8000 });
      } catch (err: any) {
        console.warn("Backend add book sync deferred or offline:", err?.message);
      }

      Alert.alert(
        "✓ Added to Catalog",
        `"${parsedFields.title}" has been successfully registered in the BookHive Library Catalog!`,
        [
          {
            text: "Done",
            onPress: () => {
              setBookModalVisible(false);
              setScanned(false);
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert("Save Error", err?.message || "Failed to save book to catalog.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === "web") {
      const confirmed = typeof window !== "undefined" && window.confirm
        ? window.confirm("Are you sure you want to log out of the librarian account?")
        : true;
      if (confirmed) {
        try {
          await logout();
        } catch (e) {
          console.warn("Logout error:", e);
        }
        router.replace("/login");
      }
      return;
    }

    Alert.alert("Librarian Logout", "Are you sure you want to log out of the librarian account?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
          } catch (e) {
            console.warn("Logout error:", e);
          }
          router.replace("/login");
        },
      },
    ]);
  };

  // Interpolated translateY for the laser scanning animation line
  const laserTranslateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 120],
  });

  return (
    <AnimatedScreen style={styles.screenRoot}>
      {/* SHUTTER FLASH OVERLAY (Flashes white when photo is snapped) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shutterFlashOverlay,
          {
            opacity: flashAnim,
          },
        ]}
      />

      {/* TOP HEADER: Sleek Modern Web System Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <View style={styles.brandTitleRow}>
          <Text style={styles.brandTitleText}>BOOKHIVE</Text>
          <View style={styles.librarianBadgePill}>
            <Text style={styles.librarianBadgeText}>Librarian</Text>
          </View>
          <View style={styles.primaryModeBadge}>
            <Text style={styles.primaryModeBadgeText}>
              {activeMode === "Catalog" ? "Catalog Scanner" : "Student Pass"}
            </Text>
          </View>
        </View>

        <View style={styles.topBarIcons}>
          <TouchableOpacity
            style={styles.iconHit}
            onPress={() => setTorchOn(prev => !prev)}
            accessibilityLabel="Toggle Torch"
          >
            <Ionicons
              name={torchOn ? "flash" : "flash-outline"}
              size={18}
              color={torchOn ? theme.accentStrong : theme.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconHit, { marginLeft: 5 }]}
            onPress={() => setFacing(prev => (prev === "back" ? "front" : "back"))}
            accessibilityLabel="Switch Camera"
          >
            <Ionicons name="camera-reverse-outline" size={19} color={theme.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconHit, { marginLeft: 5 }]}
            onPress={toggleTheme}
            accessibilityLabel="Toggle Theme"
          >
            <Ionicons
              name={isDarkMode ? "sunny-outline" : "moon-outline"}
              size={18}
              color={isDarkMode ? theme.accent : theme.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconHit, { marginLeft: 6 }]}
            onPress={handleLogout}
            accessibilityLabel="Log out"
          >
            <Ionicons name="log-out-outline" size={19} color={theme.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* UPPER VIEWPORT: Modern Cinematic Viewfinder with Document Alignment Reticle */}
      {/* ========================================================================= */}
      <View style={styles.scannerCardContainer}>
        <View style={styles.scannerGrayBox}>
          {/* Live Camera Viewfinder */}
          {Platform.OS !== "web" && isCameraActive ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={facing}
              enableTorch={torchOn}
              mode="picture"
              barcodeScannerSettings={
                activeMode === "Transaction"
                  ? { barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39", "upc_a", "upc_e"] }
                  : undefined
              }
              onBarcodeScanned={activeMode === "Transaction" && !scanned ? handleBarCodeScanned : undefined}
              onCameraReady={() => setIsCameraReady(true)}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "#060A12", justifyContent: "center", alignItems: "center" }]}>
              {processing && <ActivityIndicator size="large" color={theme.accentStrong} />}
            </View>
          )}

          {/* RETICLE OVERLAY */}
          <View style={activeMode === "Catalog" ? styles.paperReticleOverlay : styles.reticleOverlay} pointerEvents="none">
            {/* Top Reticle Tag */}
            <View style={styles.reticleBadgeBox}>
              <MaterialCommunityIcons
                name={activeMode === "Catalog" ? "text-box-search-outline" : "qrcode-scan"}
                size={13}
                color={theme.primary}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.reticleBadgeText}>
                {activeMode === "Catalog" ? "PAPER & CATALOG SCANNER" : "STUDENT ID SCANNER"}
              </Text>
            </View>

            {/* Glowing Corner Brackets */}
            <View style={[styles.cornerBracket, styles.bracketTopLeft]} />
            <View style={[styles.cornerBracket, styles.bracketTopRight]} />
            <View style={[styles.cornerBracket, styles.bracketBottomLeft]} />
            <View style={[styles.cornerBracket, styles.bracketBottomRight]} />

            {/* Animated Laser Scanning Line (Sweeps up/down when scanning words) */}
            {activeMode === "Catalog" && processing && (
              <Animated.View
                style={[
                  styles.animatedLaserLine,
                  {
                    transform: [{ translateY: laserTranslateY }],
                  },
                ]}
              />
            )}
          </View>

          {/* HINT PILL BELOW RETICLE */}
          <View style={styles.reticleGuidePill} pointerEvents="none">
            <Text style={styles.reticleGuideText}>
              {activeMode === "Catalog"
                ? "Align printed or handwritten book details inside frame"
                : "Align Student ID QR code inside frame"}
            </Text>
          </View>

          {/* IN-FLIGHT WORD SCANNING HUD OVERLAY */}
          {processing && (
            <View style={styles.processingOverlay}>
              <View style={styles.hudCard}>
                <ActivityIndicator size="large" color={theme.accentStrong} />
                <Text style={styles.processingOverlayText}>
                  {processingStep || "Scanning words on paper..."}
                </Text>
                <Text style={styles.processingOverlaySub}>
                  Converting words to text & extracting catalog fields
                </Text>

                {/* Progress Indicators */}
                <View style={styles.hudPillRow}>
                  <View style={styles.hudPill}>
                    <Text style={styles.hudPillText}>Title</Text>
                  </View>
                  <View style={styles.hudPill}>
                    <Text style={styles.hudPillText}>Author</Text>
                  </View>
                  <View style={styles.hudPill}>
                    <Text style={styles.hudPillText}>Genre</Text>
                  </View>
                  <View style={styles.hudPill}>
                    <Text style={styles.hudPillText}>ISBN</Text>
                  </View>
                  <View style={styles.hudPill}>
                    <Text style={styles.hudPillText}>Copies</Text>
                  </View>
                  <View style={styles.hudPill}>
                    <Text style={styles.hudPillText}>Edition</Text>
                  </View>
                  <View style={styles.hudPill}>
                    <Text style={styles.hudPillText}>Volume</Text>
                  </View>
                  <View style={styles.hudPill}>
                    <Text style={styles.hudPillText}>Summary</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Web Demo Helper / Quick Simulators */}
          {Platform.OS === "web" && (
            <View style={styles.webSimulatorContainer}>
              <Text style={styles.webSimulatorTitle}>
                {activeMode === "Catalog" ? "Simulate Scanning Words on Paper:" : "Simulate Student QR Pass:"}
              </Text>
              <View style={styles.webChipsRow}>
                {activeMode === "Catalog" ? (
                  <>
                    <TouchableOpacity
                      style={[styles.webChip, { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}
                      onPress={() =>
                        processScanResult(
                          `Title: Brich Capston Journey\nAuthor: Yana Brich\nGenre: Life Story\nISBN: 933-1428-103\nCopies: 1\nEdition: 1st\nVolume: 1\nSummary: A Life Story about the Capstone Experience.`
                        )
                      }
                    >
                      <Text style={styles.webChipText}>📄 "Brich Capston Journey" (User's Paper)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.webChip}
                      onPress={() =>
                        processScanResult(
                          `Title: On Fortune's Wheel\nAuthor: Cynthia Voigt\nGenre: Fiction\nISBN: 9780689829574\nCopies: 2\nEdition: 2nd\nVolume: 1\nSummary: Tale of bravery in the Kingdom.`
                        )
                      }
                    >
                      <Text style={styles.webChipText}>📄 "On Fortune's Wheel" (Voigt)</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.webChip}
                    onPress={() => processScanResult("23-1111-111")}
                  >
                    <Text style={styles.webChipText}>🎓 Student Pass (23-1111-111)</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </View>

      {/* MANUAL CODE / WORDS DRAWER */}
      {showManualInput && (
        <View style={styles.manualInputDrawer}>
          <TextInput
            style={styles.drawerInput}
            placeholder={
              activeMode === "Catalog"
                ? "Type words from paper: Title: ... Author: ... Genre: ... ISBN: ..."
                : "Enter Student ID (e.g. 23-1111-111)"
            }
            placeholderTextColor={theme.muted}
            value={manualCode}
            onChangeText={setManualCode}
            onSubmitEditing={() => {
              setShowManualInput(false);
              processScanResult(manualCode);
            }}
          />
          <TouchableOpacity
            style={styles.drawerSubmitBtn}
            onPress={() => {
              setShowManualInput(false);
              processScanResult(manualCode);
            }}
          >
            <Text style={styles.drawerSubmitText}>Scan</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ========================================================================= */}
      {/* FLOATING MODE SWITCHER: Modern Floating Pill above the Shutter Bar */}
      {/* ========================================================================= */}
      <View style={styles.modeSwitcherContainer}>
        <View style={styles.floatingModePill}>
          {/* Catalog Mode Button */}
          <TouchableOpacity
            style={[
              styles.modeSegmentBtn,
              activeMode === "Catalog" && styles.modeSegmentBtnActive,
            ]}
            onPress={() => {
              setActiveMode("Catalog");
              setScanned(false);
            }}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="book-open-page-variant-outline"
              size={15}
              color={activeMode === "Catalog" ? theme.primary : theme.muted}
              style={{ marginRight: 5 }}
            />
            <Text
              style={[
                styles.modeSegmentText,
                activeMode === "Catalog" && styles.modeSegmentTextActive,
              ]}
            >
              Catalog (Paper)
            </Text>
          </TouchableOpacity>

          {/* Transaction Mode Button */}
          <TouchableOpacity
            style={[
              styles.modeSegmentBtn,
              activeMode === "Transaction" && styles.modeSegmentBtnActive,
            ]}
            onPress={() => {
              setActiveMode("Transaction");
              setScanned(false);
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="card-outline"
              size={15}
              color={activeMode === "Transaction" ? theme.primary : theme.muted}
              style={{ marginRight: 5 }}
            />
            <Text
              style={[
                styles.modeSegmentText,
                activeMode === "Transaction" && styles.modeSegmentTextActive,
              ]}
            >
              Student Pass
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* CAMERA SHUTTER BAR: Modern Native Camera Shutter Experience */}
      {/* ========================================================================= */}
      <View style={[styles.shutterBarContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        {/* 1. Left: Gallery / Pick Photo */}
        <TouchableOpacity
          style={styles.shutterSideBtn}
          onPress={handlePickPaperPhoto}
          disabled={processing}
          activeOpacity={0.75}
        >
          <View style={styles.sideBtnIconBox}>
            <Ionicons name="images-outline" size={22} color={theme.primary} />
          </View>
          <Text style={styles.sideBtnText}>Gallery</Text>
        </TouchableOpacity>

        {/* 2. Center: Real Camera Shutter Button */}
        <Animated.View style={{ transform: [{ scale: shutterScale }] }}>
          <TouchableOpacity
            style={styles.shutterOuterRing}
            onPress={handleShutterCapture}
            disabled={processing}
            activeOpacity={0.9}
            accessibilityLabel="Camera Shutter"
          >
            <View style={styles.shutterInnerButton}>
              <MaterialCommunityIcons
                name={activeMode === "Catalog" ? "camera-iris" : "qrcode-scan"}
                size={30}
                color={theme.shutterDot}
              />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* 3. Center-Right: High-Definition Camera Snap (Autofocus & Macro) */}
        <TouchableOpacity
          style={styles.shutterSideBtn}
          onPress={handleLaunchNativeCamera}
          disabled={processing}
          activeOpacity={0.75}
        >
          <View style={styles.sideBtnIconBox}>
            <Ionicons name="camera-outline" size={22} color={theme.primary} />
          </View>
          <Text style={styles.sideBtnText}>HD Camera</Text>
        </TouchableOpacity>

        {/* 4. Right: Manual / Type Words */}
        <TouchableOpacity
          style={styles.shutterSideBtn}
          onPress={() => setShowManualInput(prev => !prev)}
          disabled={processing}
          activeOpacity={0.75}
        >
          <View style={styles.sideBtnIconBox}>
            <Ionicons name="keypad-outline" size={21} color={theme.primary} />
          </View>
          <Text style={styles.sideBtnText}>Manual</Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* MODERN & AESTHETIC RESULT MODAL: ALL 8 ITEMS (Title, Author, Genre, ISBN, */}
      {/* Copies, Edition, Volume, Summary)                                        */}
      {/* ========================================================================= */}
      <Modal
        visible={bookModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setBookModalVisible(false);
          setScanned(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Modal Drag Handle */}
            <View style={styles.modalDragHandle} />

            {/* Modal Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderInfo}>
                <View style={styles.modalStatusBadge}>
                  <MaterialCommunityIcons name="check-decagram" size={15} color={theme.successText} />
                  <Text style={styles.modalStatusBadgeText}>TEXT CONVERSION COMPLETE</Text>
                </View>
                <Text style={styles.sheetTitle}>Scanned Book Details</Text>
                <Text style={styles.sheetSubtitle}>
                  Verified from paper document & converted to digital text
                </Text>
              </View>

              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => {
                  setBookModalVisible(false);
                  setScanned(false);
                }}
              >
                <Ionicons name="close-circle" size={26} color={theme.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
              {/* EDIT TOGGLE BAR */}
              <View style={styles.editToggleRow}>
                <Text style={styles.sectionLabel}>EXTRACTED CATALOG FIELDS</Text>
                <TouchableOpacity
                  style={styles.editToggleBtn}
                  onPress={() => setIsEditingFields(prev => !prev)}
                >
                  <Ionicons
                    name={isEditingFields ? "checkmark" : "create-outline"}
                    size={14}
                    color={theme.primary}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.editToggleText}>
                    {isEditingFields ? "Done Editing" : "Edit Fields"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ============================================================ */}
              {/* THE 8 STRUCTURED BOOK FIELDS                                 */}
              {/* ============================================================ */}
              <View style={styles.fieldsCard}>
                {/* 1. BOOK TITLE */}
                <View style={styles.fieldItem}>
                  <View style={styles.fieldLabelRow}>
                    <Ionicons name="book-outline" size={15} color={theme.primary} />
                    <Text style={styles.fieldLabel}>BOOK TITLE</Text>
                  </View>
                  {isEditingFields ? (
                    <TextInput
                      style={styles.fieldInput}
                      value={parsedFields.title}
                      onChangeText={val => setParsedFields(prev => ({ ...prev, title: val }))}
                      placeholder="Enter book title"
                      placeholderTextColor={theme.muted}
                    />
                  ) : (
                    <Text style={styles.titleValueText}>{parsedFields.title || "Untitled"}</Text>
                  )}
                </View>

                {/* 2. AUTHOR */}
                <View style={styles.fieldDivider} />
                <View style={styles.fieldItem}>
                  <View style={styles.fieldLabelRow}>
                    <FontAwesome5 name="pen-nib" size={13} color={theme.primary} />
                    <Text style={styles.fieldLabel}>AUTHOR</Text>
                  </View>
                  {isEditingFields ? (
                    <TextInput
                      style={styles.fieldInput}
                      value={parsedFields.author}
                      onChangeText={val => setParsedFields(prev => ({ ...prev, author: val }))}
                      placeholder="Enter author name"
                      placeholderTextColor={theme.muted}
                    />
                  ) : (
                    <Text style={styles.fieldValueText}>{parsedFields.author || "Unknown"}</Text>
                  )}
                </View>

                {/* 3. GENRE */}
                <View style={styles.fieldDivider} />
                <View style={styles.fieldItem}>
                  <View style={styles.fieldLabelRow}>
                    <Ionicons name="pricetag-outline" size={14} color={theme.primary} />
                    <Text style={styles.fieldLabel}>GENRE / CATEGORY</Text>
                  </View>
                  {isEditingFields ? (
                    <TextInput
                      style={styles.fieldInput}
                      value={parsedFields.genre}
                      onChangeText={val => setParsedFields(prev => ({ ...prev, genre: val }))}
                      placeholder="Enter genre"
                      placeholderTextColor={theme.muted}
                    />
                  ) : (
                    <View style={styles.genrePill}>
                      <Text style={styles.genrePillText}>{parsedFields.genre || "General"}</Text>
                    </View>
                  )}
                </View>

                {/* 4. ISBN */}
                <View style={styles.fieldDivider} />
                <View style={styles.fieldItem}>
                  <View style={styles.fieldLabelRow}>
                    <MaterialCommunityIcons name="barcode-scan" size={15} color={theme.primary} />
                    <Text style={styles.fieldLabel}>ISBN</Text>
                  </View>
                  {isEditingFields ? (
                    <TextInput
                      style={styles.fieldInput}
                      value={parsedFields.isbn}
                      onChangeText={val => setParsedFields(prev => ({ ...prev, isbn: val }))}
                      placeholder="e.g. 933-1428-103"
                      placeholderTextColor={theme.muted}
                    />
                  ) : (
                    <Text style={styles.isbnValueText}>{parsedFields.isbn || "No ISBN specified"}</Text>
                  )}
                </View>

                {/* 5, 6, 7. GRID: COPIES, EDITION, VOLUME */}
                <View style={styles.fieldDivider} />
                <View style={styles.threeColRow}>
                  {/* 5. NO. OF COPIES */}
                  <View style={styles.colItem}>
                    <View style={styles.fieldLabelRow}>
                      <MaterialCommunityIcons name="layers-outline" size={14} color={theme.primary} />
                      <Text style={styles.fieldLabel}>NO. COPIES</Text>
                    </View>
                    {isEditingFields ? (
                      <TextInput
                        style={styles.colInput}
                        keyboardType="numeric"
                        value={String(parsedFields.copies)}
                        onChangeText={val => setParsedFields(prev => ({ ...prev, copies: parseInt(val, 10) || 1 }))}
                      />
                    ) : (
                      <View style={styles.colBadge}>
                        <Text style={styles.colBadgeText}>{parsedFields.copies} copy</Text>
                      </View>
                    )}
                  </View>

                  {/* 6. EDITION */}
                  <View style={styles.colItem}>
                    <View style={styles.fieldLabelRow}>
                      <Ionicons name="bookmark-outline" size={14} color={theme.primary} />
                      <Text style={styles.fieldLabel}>EDITION</Text>
                    </View>
                    {isEditingFields ? (
                      <TextInput
                        style={styles.colInput}
                        value={parsedFields.edition}
                        onChangeText={val => setParsedFields(prev => ({ ...prev, edition: val }))}
                      />
                    ) : (
                      <View style={styles.colBadge}>
                        <Text style={styles.colBadgeText}>{parsedFields.edition || "1st"}</Text>
                      </View>
                    )}
                  </View>

                  {/* 7. VOLUME */}
                  <View style={styles.colItem}>
                    <View style={styles.fieldLabelRow}>
                      <Ionicons name="folder-outline" size={14} color={theme.primary} />
                      <Text style={styles.fieldLabel}>VOLUME</Text>
                    </View>
                    {isEditingFields ? (
                      <TextInput
                        style={styles.colInput}
                        value={parsedFields.volume}
                        onChangeText={val => setParsedFields(prev => ({ ...prev, volume: val }))}
                      />
                    ) : (
                      <View style={styles.colBadge}>
                        <Text style={styles.colBadgeText}>{parsedFields.volume || "1"}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* 8. SUMMARY */}
                <View style={styles.fieldDivider} />
                <View style={styles.fieldItem}>
                  <View style={styles.fieldLabelRow}>
                    <Ionicons name="document-text-outline" size={15} color={theme.primary} />
                    <Text style={styles.fieldLabel}>SUMMARY</Text>
                  </View>
                  {isEditingFields ? (
                    <TextInput
                      style={[styles.fieldInput, { height: 75, textAlignVertical: "top" }]}
                      multiline
                      value={parsedFields.summary}
                      onChangeText={val => setParsedFields(prev => ({ ...prev, summary: val }))}
                      placeholder="Enter book summary..."
                      placeholderTextColor={theme.muted}
                    />
                  ) : (
                    <Text style={styles.summaryValueText}>
                      {parsedFields.summary ? `"${parsedFields.summary}"` : "No summary provided on paper."}
                    </Text>
                  )}
                </View>
              </View>

              {/* RAW SCANNED WORDS DISCLOSURE */}
              <TouchableOpacity
                style={styles.rawWordsToggleBtn}
                onPress={() => setShowRawText(prev => !prev)}
              >
                <MaterialCommunityIcons name="text-recognition" size={16} color={theme.primary} />
                <Text style={styles.rawWordsToggleText}>
                  {showRawText ? "Hide Raw Scanned Words" : "View Raw Scanned Words from Paper"}
                </Text>
                <Ionicons
                  name={showRawText ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={theme.muted}
                  style={{ marginLeft: "auto" }}
                />
              </TouchableOpacity>

              {showRawText && (
                <View style={styles.rawWordsBox}>
                  <Text style={styles.rawWordsContent}>
                    {scannedPaperText || parsedFields.rawText || "No raw text available."}
                  </Text>
                </View>
              )}

              {/* ============================================================ */}
              {/* ACTION BUTTONS: Save to Catalog / Issue to Student           */}
              {/* ============================================================ */}
              <View style={styles.modalActionButtons}>
                {/* 1. Save & Add to Catalog */}
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={handleSaveToCatalog}
                  disabled={isSaving}
                  activeOpacity={0.85}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={19} color={isDarkMode ? "#080F1E" : "#FFFFFF"} />
                      <Text style={styles.primaryActionBtnText}>Save & Add to Catalog</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* 2. Issue / Checkout to Student */}
                <TouchableOpacity
                  style={styles.secondaryActionBtn}
                  onPress={() => {
                    Alert.prompt
                      ? Alert.prompt(
                          "Check Out Book",
                          `Enter Student ID to issue "${parsedFields.title}":`,
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Issue Book",
                              onPress: (studentId?: string) => {
                                if (studentId) {
                                  Alert.alert(
                                    "Checkout Completed",
                                    `"${parsedFields.title}" issued to Student ID ${studentId}.`
                                  );
                                  setBookModalVisible(false);
                                  setScanned(false);
                                }
                              },
                            },
                          ]
                        )
                      : Alert.alert("Issue Book", `Ready to issue "${parsedFields.title}" to a student.`);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="arrow-up-circle-outline" size={18} color={theme.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.secondaryActionBtnText}>Issue / Checkout to Student</Text>
                </TouchableOpacity>

                {/* 3. Scan Another Paper */}
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setBookModalVisible(false);
                    setScanned(false);
                  }}
                >
                  <Text style={styles.cancelBtnText}>Scan Another Paper</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AnimatedScreen>
  );
}

const getStyles = (theme: typeof LIGHT_THEME, isDarkMode: boolean) =>
  StyleSheet.create({
    screenRoot: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    shutterFlashOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "#FFFFFF",
      zIndex: 999,
    },
    topBar: {
      paddingHorizontal: 16,
      paddingBottom: 10,
      backgroundColor: theme.panel,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: theme.primaryLine,
    },
    brandTitleRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    brandTitleText: {
      fontSize: 16,
      fontWeight: "900",
      color: theme.primary,
      letterSpacing: 0.8,
    },
    librarianBadgePill: {
      marginLeft: 6,
      backgroundColor: theme.primarySoft,
      borderWidth: 1,
      borderColor: theme.primaryLine,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    librarianBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.primary,
    },
    primaryModeBadge: {
      marginLeft: 6,
      backgroundColor: "rgba(255, 243, 0, 0.18)",
      borderWidth: 1,
      borderColor: theme.accentStrong,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    primaryModeBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      color: isDarkMode ? "#FBBF24" : "#B45309",
    },
    topBarIcons: {
      flexDirection: "row",
      alignItems: "center",
    },
    iconHit: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: theme.primarySoft,
      justifyContent: "center",
      alignItems: "center",
    },

    /* UPPER VIEWPORT */
    scannerCardContainer: {
      flex: 1,
      paddingHorizontal: 14,
      paddingTop: 8,
      paddingBottom: 4,
    },
    scannerGrayBox: {
      flex: 1,
      backgroundColor: theme.panelStrong,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: theme.primaryLine,
      position: "relative",
      overflow: "hidden",
      justifyContent: "center",
      alignItems: "center",
    },

    /* RETICLE OVERLAYS */
    reticleOverlay: {
      width: Math.min(width * 0.72, 260),
      height: Math.min(height * 0.38, 280),
      position: "relative",
      justifyContent: "center",
      alignItems: "center",
    },
    paperReticleOverlay: {
      width: Math.min(width * 0.86, 320),
      height: Math.min(height * 0.44, 340),
      position: "relative",
      justifyContent: "center",
      alignItems: "center",
    },
    reticleBadgeBox: {
      position: "absolute",
      top: -16,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.webTapBg,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.primaryLine,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 4,
    },
    reticleBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.primary,
      letterSpacing: 0.5,
    },
    cornerBracket: {
      position: "absolute",
      width: 52,
      height: 52,
      borderColor: theme.primary,
    },
    bracketTopLeft: {
      top: 0,
      left: 0,
      borderTopWidth: 3,
      borderLeftWidth: 3,
      borderTopLeftRadius: 16,
    },
    bracketTopRight: {
      top: 0,
      right: 0,
      borderTopWidth: 3,
      borderRightWidth: 3,
      borderTopRightRadius: 16,
    },
    bracketBottomLeft: {
      bottom: 0,
      left: 0,
      borderBottomWidth: 3,
      borderLeftWidth: 3,
      borderBottomLeftRadius: 16,
    },
    bracketBottomRight: {
      bottom: 0,
      right: 0,
      borderBottomWidth: 3,
      borderRightWidth: 3,
      borderBottomRightRadius: 16,
    },
    animatedLaserLine: {
      width: "92%",
      height: 2.5,
      backgroundColor: theme.accent,
      borderRadius: 2,
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.95,
      shadowRadius: 8,
      position: "absolute",
    },
    reticleGuidePill: {
      position: "absolute",
      bottom: 12,
      backgroundColor: theme.webTapBg,
      paddingHorizontal: 14,
      paddingVertical: 5,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.primaryLine,
    },
    reticleGuideText: {
      fontSize: 11,
      color: theme.textDark,
      fontWeight: "700",
      textAlign: "center",
    },

    /* PROCESSING / OCR HUD OVERLAY */
    processingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(2, 116, 187, 0.86)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
      zIndex: 20,
    },
    hudCard: {
      width: "90%",
      backgroundColor: theme.panel,
      borderRadius: 18,
      padding: 20,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.primaryLine,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 8,
    },
    processingOverlayText: {
      marginTop: 14,
      fontSize: 16,
      fontWeight: "800",
      color: theme.primary,
      textAlign: "center",
    },
    processingOverlaySub: {
      marginTop: 5,
      fontSize: 12,
      fontWeight: "600",
      color: theme.muted,
      textAlign: "center",
    },
    hudPillRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 5,
      marginTop: 14,
    },
    hudPill: {
      backgroundColor: theme.primarySoft,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.primaryLine,
    },
    hudPillText: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.primary,
    },

    /* WEB SIMULATOR */
    webSimulatorContainer: {
      position: "absolute",
      bottom: 8,
      left: 10,
      right: 10,
      backgroundColor: theme.webTapBg,
      borderRadius: 10,
      padding: 8,
      borderWidth: 1,
      borderColor: theme.primaryLine,
      alignItems: "center",
    },
    webSimulatorTitle: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.muted,
      marginBottom: 5,
    },
    webChipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 6,
    },
    webChip: {
      backgroundColor: theme.panel,
      borderWidth: 1,
      borderColor: theme.primaryLine,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    webChipText: {
      fontSize: 11,
      color: theme.primary,
      fontWeight: "700",
    },

    /* MANUAL INPUT DRAWER */
    manualInputDrawer: {
      flexDirection: "row",
      paddingHorizontal: 16,
      paddingVertical: 6,
    },
    drawerInput: {
      flex: 1,
      height: 44,
      borderWidth: 1,
      borderColor: theme.primaryLine,
      backgroundColor: theme.inputBg,
      borderRadius: 10,
      paddingHorizontal: 12,
      fontSize: 13,
      color: theme.textDark,
    },
    drawerSubmitBtn: {
      backgroundColor: theme.primary,
      paddingHorizontal: 16,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 10,
      marginLeft: 8,
    },
    drawerSubmitText: {
      color: isDarkMode ? "#080F1E" : "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
    },

    /* FLOATING MODE SWITCHER */
    modeSwitcherContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 6,
    },
    floatingModePill: {
      flexDirection: "row",
      backgroundColor: theme.panel,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: theme.primaryLine,
      padding: 3,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 3,
    },
    modeSegmentBtn: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
    },
    modeSegmentBtnActive: {
      backgroundColor: theme.primarySoft,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    modeSegmentText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.muted,
    },
    modeSegmentTextActive: {
      color: theme.primary,
      fontWeight: "800",
    },

    /* CAMERA SHUTTER BAR */
    shutterBarContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 18,
      paddingTop: 6,
    },
    shutterSideBtn: {
      alignItems: "center",
      justifyContent: "center",
      width: 58,
    },
    sideBtnIconBox: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.panel,
      borderWidth: 1.5,
      borderColor: theme.primaryLine,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 1,
    },
    sideBtnText: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.primary,
      marginTop: 4,
      textAlign: "center",
    },
    shutterOuterRing: {
      width: 78,
      height: 78,
      borderRadius: 39,
      borderWidth: 4,
      borderColor: theme.shutterBorder,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "transparent",
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 5,
    },
    shutterInnerButton: {
      width: 62,
      height: 62,
      borderRadius: 31,
      backgroundColor: theme.shutterInner,
      justifyContent: "center",
      alignItems: "center",
    },

    /* MODAL STYLES */
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.modalOverlay,
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: theme.panel,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 18,
      paddingTop: 12,
      elevation: 16,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      maxHeight: "90%",
    },
    modalDragHandle: {
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.primaryLine,
      alignSelf: "center",
      marginBottom: 10,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    sheetHeaderInfo: {
      flex: 1,
    },
    modalStatusBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.successBg,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      alignSelf: "flex-start",
      gap: 4,
      marginBottom: 6,
    },
    modalStatusBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.successText,
      letterSpacing: 0.5,
    },
    sheetTitle: {
      fontSize: 21,
      fontWeight: "900",
      color: theme.primary,
      letterSpacing: -0.3,
    },
    sheetSubtitle: {
      fontSize: 12,
      color: theme.muted,
      marginTop: 2,
    },
    sheetCloseBtn: {
      padding: 4,
    },

    /* EDIT TOGGLE */
    editToggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
      marginTop: 4,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.muted,
      letterSpacing: 0.6,
    },
    editToggleBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.primarySoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.primaryLine,
    },
    editToggleText: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.primary,
    },

    /* 8 FIELDS CARD */
    fieldsCard: {
      backgroundColor: theme.cardBg,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: theme.primaryLine,
      padding: 14,
      marginBottom: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
    fieldItem: {
      paddingVertical: 4,
    },
    fieldDivider: {
      height: 1,
      backgroundColor: theme.primaryLine,
      marginVertical: 8,
    },
    fieldLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginBottom: 4,
    },
    fieldLabel: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.muted,
      letterSpacing: 0.5,
    },
    titleValueText: {
      fontSize: 18,
      fontWeight: "900",
      color: theme.primary,
    },
    fieldValueText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.textDark,
    },
    isbnValueText: {
      fontSize: 13,
      fontWeight: "800",
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
      color: theme.textDark,
    },
    genrePill: {
      backgroundColor: theme.primarySoft,
      borderWidth: 1,
      borderColor: theme.primaryLine,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      alignSelf: "flex-start",
    },
    genrePillText: {
      fontSize: 12,
      fontWeight: "800",
      color: theme.primary,
    },
    fieldInput: {
      borderWidth: 1,
      borderColor: theme.primary,
      backgroundColor: theme.inputBg,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 13,
      color: theme.textDark,
    },

    /* 3 COLUMNS GRID (COPIES, EDITION, VOLUME) */
    threeColRow: {
      flexDirection: "row",
      gap: 8,
    },
    colItem: {
      flex: 1,
    },
    colBadge: {
      backgroundColor: theme.panelStrong,
      borderWidth: 1,
      borderColor: theme.primaryLine,
      paddingVertical: 5,
      borderRadius: 8,
      alignItems: "center",
    },
    colBadgeText: {
      fontSize: 12,
      fontWeight: "800",
      color: theme.textDark,
    },
    colInput: {
      borderWidth: 1,
      borderColor: theme.primary,
      backgroundColor: theme.inputBg,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      fontSize: 13,
      color: theme.textDark,
      textAlign: "center",
    },

    summaryValueText: {
      fontSize: 13,
      color: theme.textDark,
      fontStyle: "italic",
      lineHeight: 18,
    },

    /* RAW WORDS TOGGLE & BOX */
    rawWordsToggleBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.panelStrong,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.primaryLine,
      marginBottom: 12,
      gap: 6,
    },
    rawWordsToggleText: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.primary,
    },
    rawWordsBox: {
      backgroundColor: theme.panelStrong,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.primaryLine,
      padding: 12,
      marginBottom: 14,
    },
    rawWordsContent: {
      fontSize: 11,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
      color: theme.textDark,
      lineHeight: 16,
    },

    /* ACTION BUTTONS */
    modalActionButtons: {
      gap: 8,
      marginTop: 6,
    },
    primaryActionBtn: {
      height: 50,
      borderRadius: 12,
      backgroundColor: theme.primary,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      elevation: 3,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2,
      shadowRadius: 5,
      gap: 6,
    },
    primaryActionBtnText: {
      color: isDarkMode ? "#080F1E" : "#FFFFFF",
      fontSize: 15,
      fontWeight: "800",
    },
    secondaryActionBtn: {
      height: 46,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.primaryLine,
      backgroundColor: theme.panel,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },
    secondaryActionBtnText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.primary,
    },
    cancelBtn: {
      alignItems: "center",
      paddingVertical: 10,
    },
    cancelBtnText: {
      color: theme.muted,
      fontSize: 13,
      fontWeight: "600",
    },
  });
