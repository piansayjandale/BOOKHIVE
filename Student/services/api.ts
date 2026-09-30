import AsyncStorage from "@react-native-async-storage/async-storage";
import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import Constants from "expo-constants";
import { Alert, Platform, ToastAndroid } from "react-native";
import backendConfig from "../data/backendConfig.json";

// =============================================================================
// Central Configuration Constants
// =============================================================================

/**
 * Live Render Production Backend URL.
 * Used for compiled standalone Android APKs and production builds.
 */
export const PRODUCTION_API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://bookhive-backend.onrender.com";

/**
 * Android Emulator loopback alias pointing to the development host machine.
 * Configurable via EXPO_PUBLIC_EMULATOR_URL or LOCAL_ANDROID_EMULATOR_URL.
 */
export const LOCAL_ANDROID_EMULATOR_URL =
  process.env.EXPO_PUBLIC_EMULATOR_URL ||
  process.env.LOCAL_ANDROID_EMULATOR_URL ||
  "http://10.0.2.2:5000";

/**
 * Standard localhost development URL (iOS Simulator, Web, Metro).
 * Configurable via EXPO_PUBLIC_LOCAL_DEV_URL or LOCAL_DEV_URL.
 */
export const LOCAL_DEV_URL =
  process.env.EXPO_PUBLIC_LOCAL_DEV_URL ||
  process.env.LOCAL_DEV_URL ||
  "http://localhost:5000";

/**
 * Port used for local backend communication during development.
 */
export const DEV_API_PORT =
  process.env.EXPO_PUBLIC_API_PORT ||
  process.env.PORT ||
  "5000";

/**
 * HTTP Request Timeout (60,000ms / 60 seconds).
 *
 * RATIONALE:
 * Render's free tier spins down web services after 15 minutes of inactivity.
 * When a user opens the mobile app, the first request may wake the service,
 * taking 25-50 seconds to complete cold-start boot, database connection pool,
 * and SSL handshakes. A 60-second timeout ensures the app gracefully waits for
 * the backend to wake up instead of prematurely failing with an immediate network error.
 */
export const API_TIMEOUT_MS = 60000;

export const TIMEOUT_USER_MESSAGE =
  "Connecting to server, please wait a moment...";

// =============================================================================
// URL Resolution Logic
// =============================================================================

function normalizeUrl(url: string): string {
  if (!url) return "";
  const trimmed = url.trim().replace(/\/+$/, "");
  // If the user specifies /api at the end, strip it so `${API_URL}/api/...` calls don't duplicate
  return trimmed.replace(/\/api$/, "");
}

/**
 * Resolves local backend URL for development (LAN IP, Android emulator, or localhost).
 */
export const getLocalBackendUrl = (): string => {
  // 1. Dynamic Expo Go hostUri (for live testing on physical phones over Wi-Fi)
  try {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
      (Constants as any).manifest?.debuggerHost ||
      (Constants as any).experienceUrl;

    if (hostUri && typeof hostUri === "string") {
      const cleanHost = hostUri.replace(/^[a-z]+:\/\//i, "");
      const host = cleanHost.split(":")[0];
      const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(host);
      if (isIp) {
        return `http://${host}:${DEV_API_PORT}`;
      }
    }
  } catch (err) {
    console.warn("[API Config] Could not parse dynamic hostUri:", err);
  }

  // 2. Android Emulator loopback
  if (Platform.OS === "android") {
    return LOCAL_ANDROID_EMULATOR_URL;
  }

  // 3. Pre-detected local IP from backendConfig.json
  if (backendConfig && (backendConfig as any).localIp) {
    return `http://${(backendConfig as any).localIp}:${DEV_API_PORT}`;
  }

  // 4. Default localhost
  return LOCAL_DEV_URL;
};

/**
 * Dynamically resolves the base API URL depending on the runtime environment:
 * - EXPO_PUBLIC_USE_LOCAL === "true" -> Forces local machine resolution
 * - EXPO_PUBLIC_USE_PRODUCTION === "true" -> Forces live Render URL
 * - Explicit EXPO_PUBLIC_API_URL -> Custom override (e.g., https://bookhive-backend.onrender.com/api)
 * - Standalone compiled APK / Production build (!__DEV__) -> Live Render backend
 * - Expo Go / Dev mode -> Dynamic local IP / emulator / localhost
 */
export const getBackendUrl = (): string => {
  // Explicit toggle: Force local development
  if (process.env.EXPO_PUBLIC_USE_LOCAL === "true") {
    return getLocalBackendUrl();
  }

  // Explicit toggle: Force production Render service
  if (process.env.EXPO_PUBLIC_USE_PRODUCTION === "true") {
    return normalizeUrl(PRODUCTION_API_URL);
  }

  // 1. Explicit environment variable override
  if (process.env.EXPO_PUBLIC_API_URL) {
    return normalizeUrl(process.env.EXPO_PUBLIC_API_URL);
  }

  // 2. Standalone APK or Production Build (not running in Expo Go development mode)
  if (!__DEV__) {
    return normalizeUrl(PRODUCTION_API_URL);
  }

  // 3. Default local development cascade
  return getLocalBackendUrl();
};

export const getApiUrl = (): string => `${getBackendUrl()}/api`;

/**
 * Dynamic string wrapper for backward compatibility with existing codebase.
 * Evaluates to getBackendUrl() in template literals: `${API_URL}/api/...`
 */
export const API_URL = {
  toString() {
    return getBackendUrl();
  },
  valueOf() {
    return getBackendUrl();
  },
  [Symbol.toPrimitive]() {
    return getBackendUrl();
  },
} as unknown as string;

// =============================================================================
// Global Error Notification (Debounced)
// =============================================================================

let lastToastTime = 0;
const TOAST_COOLDOWN_MS = 6000;

export const showServerWakeupNotification = (
  message = TIMEOUT_USER_MESSAGE
) => {
  const now = Date.now();
  if (now - lastToastTime < TOAST_COOLDOWN_MS) {
    return;
  }
  lastToastTime = now;

  try {
    if (Platform.OS === "android") {
      ToastAndroid.show(message, ToastAndroid.LONG);
    } else if (Platform.OS === "ios") {
      console.warn(`[Server Wakeup] ${message}`);
    } else {
      console.warn(`[Server Wakeup] ${message}`);
    }
  } catch (err) {
    console.warn("[Toast Error]", err);
  }
};

// =============================================================================
// Interceptors & Error Handlers
// =============================================================================

const handleResponseError = (error: AxiosError | any) => {
  const isTimeout =
    error.code === "ECONNABORTED" ||
    (error.message && error.message.toLowerCase().includes("timeout")) ||
    (!error.response &&
      error.request &&
      (error.code === "ERR_NETWORK" ||
        error.message?.includes("Network Error")));

  if (isTimeout) {
    // Attach friendly message so component try/catch blocks render it cleanly
    error.message = TIMEOUT_USER_MESSAGE;
    error.userMessage = TIMEOUT_USER_MESSAGE;
    error.isTimeout = true;

    showServerWakeupNotification(TIMEOUT_USER_MESSAGE);
  }

  return Promise.reject(error);
};

// Apply 60s timeout and response interceptor to global axios
axios.defaults.timeout = API_TIMEOUT_MS;
axios.interceptors.response.use((res) => res, handleResponseError);

// =============================================================================
// Centralized Axios Client Instance
// =============================================================================

export const apiClient: AxiosInstance = axios.create({
  timeout: API_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Attach dynamic baseURL and auth token to apiClient requests
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // If URL is relative, prepend resolved backend URL
    if (config.url && !config.url.startsWith("http")) {
      const base = getBackendUrl();
      config.url = `${base}${config.url.startsWith("/") ? "" : "/"}${config.url}`;
    }

    // Attach Authorization header from storage if available
    try {
      const userJson = await AsyncStorage.getItem("CURRENT_USER");
      if (userJson) {
        const user = JSON.parse(userJson);
        const token = user?.token;
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch {
      // Ignore token read error
    }

    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use((res) => res, handleResponseError);

export default apiClient;
