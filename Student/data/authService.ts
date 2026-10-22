import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import backendConfig from "./backendConfig.json";

export type User = {
  fullName: string;
  studentId: string;
  email: string;
  password?: string;
  id?: string;
  role?: string;
  department?: string;
  course?: string;
  yearLevel?: string;
  section?: string;
  status?: string;
  token?: string;
  avatar?: string;
  schoolIdFront?: string;
  schoolIdBack?: string;
  libraryIdFront?: string;
  libraryIdBack?: string;
  qrCode?: string;
  isNewUser?: boolean;
  permissions?: Record<string, boolean>;
};

export type StoredAccount = {
  user: User;
  token: string;
  lastActive: number;
};

const CURRENT_USER_KEY = "CURRENT_USER";
const STORED_ACCOUNTS_KEY = "BOOKHIVE_STORED_ACCOUNTS";

import {
  getBackendUrl,
  getApiUrl,
  API_URL,
  apiClient,
  PRODUCTION_API_URL,
  LOCAL_ANDROID_EMULATOR_URL,
  LOCAL_DEV_URL,
  API_TIMEOUT_MS,
  TIMEOUT_USER_MESSAGE,
  showServerWakeupNotification,
} from "../services/api";

export {
  getBackendUrl,
  getApiUrl,
  API_URL,
  apiClient,
  PRODUCTION_API_URL,
  LOCAL_ANDROID_EMULATOR_URL,
  LOCAL_DEV_URL,
  API_TIMEOUT_MS,
  TIMEOUT_USER_MESSAGE,
  showServerWakeupNotification,
};

export const isValidEmail = (email: string) =>
  /\S+@\S+\.\S+/.test(email);

export const isSchoolEmail = (email: string) =>
  isValidEmail(email) &&
  (email.toLowerCase().endsWith("@sti.edu.ph") ||
   email.toLowerCase().endsWith("@stiwnu.edu.ph") ||
   email.toLowerCase().endsWith("@wnu.sti.edu.ph") ||
   email.toLowerCase().includes(".sti."));

export const isStaffRole = (role?: string): boolean => {
  if (!role) return false;
  const r = role.toLowerCase().trim();
  return r === "librarian" || r === "admin" || r === "super admin" || r === "staff";
};

export const STAFF_DEV_ACCOUNTS: Record<string, any> = {
  "librarian@stiwnu.edu.ph": {
    id: "user-002",
    fullName: "Yana Brich R. Palmares",
    studentId: "LIB-2026-0001",
    email: "librarian@stiwnu.edu.ph",
    role: "Librarian",
    password: "BookHiveLibrarian!2026",
    department: "Library Services",
    course: "Library Services",
    token: "mock-jwt-librarian-token-2026"
  },
  "lib-2026-0001": {
    id: "user-002",
    fullName: "Yana Brich R. Palmares",
    studentId: "LIB-2026-0001",
    email: "librarian@stiwnu.edu.ph",
    role: "Librarian",
    password: "BookHiveLibrarian!2026",
    department: "Library Services",
    course: "Library Services",
    token: "mock-jwt-librarian-token-2026"
  },
  "admin@stiwnu.edu.ph": {
    id: "user-admin-001",
    fullName: "Library Administrator",
    studentId: "ADM-2026-0001",
    email: "admin@stiwnu.edu.ph",
    role: "Admin",
    password: "BookHiveAdmin!2026",
    department: "Library Administration",
    course: "Library Administration",
    token: "mock-jwt-admin-token-2026"
  },
  "adm-2026-0001": {
    id: "user-admin-001",
    fullName: "Library Administrator",
    studentId: "ADM-2026-0001",
    email: "admin@stiwnu.edu.ph",
    role: "Admin",
    password: "BookHiveAdmin!2026",
    department: "Library Administration",
    course: "Library Administration",
    token: "mock-jwt-admin-token-2026"
  },
  "superadmin@stiwnu.edu.ph": {
    id: "super-001",
    fullName: "Super Administrator",
    studentId: "SUP-2026-0001",
    email: "superadmin@stiwnu.edu.ph",
    role: "Super Admin",
    password: "BookHiveSuperAdmin!2026",
    department: "Executive System Governance",
    course: "Platform Infrastructure",
    token: "mock-jwt-superadmin-token-2026"
  }
};

/**
 * Normalizes legacy, nested, or partial user objects into a uniform User model.
 * Prevents runtime errors when reading older schema structures from AsyncStorage.
 */
export function normalizeUserSession(rawData: any): User | null {
  if (!rawData) return null;

  let parsed = rawData;
  if (typeof rawData === "string") {
    try {
      parsed = JSON.parse(rawData);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object") return null;

  // Extract nested user payload if present (e.g. { user: { ... }, token: "..." })
  const base = parsed.user && typeof parsed.user === "object" ? { ...parsed.user } : { ...parsed };
  const rootToken = parsed.token || parsed.accessToken || parsed.jwt || parsed.authToken;
  const userToken = base.token || base.accessToken || base.jwt || rootToken;

  const id = base.id || base.sub || base.userId || base.user_id || `usr-${Date.now()}`;
  const fullName = base.fullName || base.name || base.studentName || base.displayName || "Student";
  const studentId = base.studentId || base.idNumber || base.id_number || base.student_id || base.id || "";
  const email = base.email || base.userEmail || base.identifier || "";
  const role = base.role || "Student";
  const department = base.department || "WNU STI";
  const course = base.course || "General Program";
  const status = base.status || "Active";
  const avatar = base.avatar || "";
  const schoolIdFront = base.schoolIdFront || base.school_id_front || "";
  const schoolIdBack = base.schoolIdBack || base.school_id_back || "";
  const libraryIdFront = base.libraryIdFront || base.library_id_front || "";
  const libraryIdBack = base.libraryIdBack || base.library_id_back || "";
  const qrCode = base.qrCode || base.qr_code || "";
  const yearLevel = base.yearLevel || base.year_level || "";
  const section = base.section || "";
  const isNewUser = base.isNewUser !== undefined ? Boolean(base.isNewUser) : (parsed.isNewUser !== undefined ? Boolean(parsed.isNewUser) : undefined);
  const permissions = (base.permissions && typeof base.permissions === "object") ? base.permissions : ((parsed.permissions && typeof parsed.permissions === "object") ? parsed.permissions : undefined);

  return {
    id: String(id),
    fullName: String(fullName).trim(),
    studentId: String(studentId).trim(),
    email: String(email).trim().toLowerCase(),
    role: String(role),
    department: String(department),
    course: String(course),
    yearLevel: String(yearLevel),
    section: String(section),
    status: String(status),
    token: userToken ? String(userToken).trim() : undefined,
    avatar: avatar ? String(avatar) : undefined,
    schoolIdFront: schoolIdFront ? String(schoolIdFront) : undefined,
    schoolIdBack: schoolIdBack ? String(schoolIdBack) : undefined,
    libraryIdFront: libraryIdFront ? String(libraryIdFront) : undefined,
    libraryIdBack: libraryIdBack ? String(libraryIdBack) : undefined,
    qrCode: qrCode ? String(qrCode) : undefined,
    isNewUser: isNewUser !== undefined ? Boolean(isNewUser) : undefined,
    permissions,
  };
}

export async function safeSaveCurrentUserToStorage(user: User): Promise<void> {
  const MAX_INLINE_LEN = 2048;
  const cleanEmail = (user.email || "").trim().toLowerCase();
  const cleanId = (user.studentId || "").trim().toLowerCase();

  // If all 4 ID photos exist and any are large base64 strings, store them in the dedicated single key
  if (
    user.schoolIdFront &&
    user.schoolIdBack &&
    user.libraryIdFront &&
    user.libraryIdBack &&
    (user.schoolIdFront.length > MAX_INLINE_LEN ||
      user.schoolIdBack.length > MAX_INLINE_LEN ||
      user.libraryIdFront.length > MAX_INLINE_LEN ||
      user.libraryIdBack.length > MAX_INLINE_LEN)
  ) {
    const primaryCardKey = cleanEmail
      ? `STUDENT_ID_CARDS_${cleanEmail}`
      : cleanId && !cleanId.startsWith("temp-")
      ? `STUDENT_ID_CARDS_${cleanId}`
      : "STUDENT_ID_CARDS";
    const cardPayload = {
      schoolIdFront: user.schoolIdFront,
      schoolIdBack: user.schoolIdBack,
      libraryIdFront: user.libraryIdFront,
      libraryIdBack: user.libraryIdBack,
      verifiedAt: new Date().toISOString(),
      ownerEmail: cleanEmail,
      ownerStudentId: cleanId,
    };
    try {
      await AsyncStorage.removeItem("STUDENT_ID_CARDS").catch(() => {});
      await AsyncStorage.setItem(primaryCardKey, JSON.stringify(cardPayload));
    } catch {
      // Ignore if storage quota is tight; in-memory state holds the images
    }
  }

  const compactUser: User = {
    ...user,
    schoolIdFront:
      user.schoolIdFront && user.schoolIdFront.length <= MAX_INLINE_LEN
        ? user.schoolIdFront
        : undefined,
    schoolIdBack:
      user.schoolIdBack && user.schoolIdBack.length <= MAX_INLINE_LEN
        ? user.schoolIdBack
        : undefined,
    libraryIdFront:
      user.libraryIdFront && user.libraryIdFront.length <= MAX_INLINE_LEN
        ? user.libraryIdFront
        : undefined,
    libraryIdBack:
      user.libraryIdBack && user.libraryIdBack.length <= MAX_INLINE_LEN
        ? user.libraryIdBack
        : undefined,
  };

  try {
    await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(compactUser));
  } catch (err) {
    console.log("Reclaiming storage space for CURRENT_USER:", err);
    try {
      await AsyncStorage.removeItem("STUDENT_ID_CARDS");
      await AsyncStorage.removeItem("STUDENT_PROFILE");
      await AsyncStorage.setItem(
        CURRENT_USER_KEY,
        JSON.stringify({ ...compactUser, avatar: undefined })
      );
    } catch (retryErr) {
      console.log("Failed to save CURRENT_USER to storage:", retryErr);
    }
  }
}

export const getAuthHeaders = async () => {
  try {
    const userJson = await AsyncStorage.getItem(CURRENT_USER_KEY);
    if (userJson) {
      const user = normalizeUserSession(userJson);
      if (user && user.token) {
        return {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        };
      }
    }
  } catch (error) {
    console.log("Error getting auth headers:", error);
  }
  return {};
};

export const authService = {
  signup: async (
    fullName: string,
    studentId: string,
    email: string,
    password: string
    return {
      success: false,
      message:
        "Only the Super Administrator can officially create accounts. Please log in directly using your STI school email to complete your profile.",
    };
  },

  login: async (identifierInput: string, password: string) => {
    try {
      const trimmedIdentifier = identifierInput.trim();
      const trimmedPassword = password.trim();

      if (!trimmedIdentifier) {
        return {
          success: false,
          message: "Please enter your school email or ID number.",
        };
      }

      if (!trimmedPassword) {
        return {
          success: false,
          message: "Please enter your password.",
        };
      }

      // Check if input is formatted as an email
      const isEmailFormat = trimmedIdentifier.includes("@");
      if (isEmailFormat) {
        const lowerEmail = trimmedIdentifier.toLowerCase();
        if (!isValidEmail(lowerEmail)) {
          return {
            success: false,
            message: "Invalid email format.",
          };
        }
      }

      let response: any = null;

      try {
        const studentRes = await axios.post(`${API_URL}/api/student/login`, {
          email: trimmedIdentifier.toLowerCase(),
          identifier: trimmedIdentifier,
          password: trimmedPassword,
        });

        if (studentRes.status === 200 && studentRes.data) {
          response = studentRes;
        }
      } catch (studentErr: any) {
        // If student login fails, probe staff / librarian login endpoint
        try {
          const staffRes = await axios.post(`${API_URL}/api/auth/login`, {
            identifier: trimmedIdentifier,
            email: trimmedIdentifier.toLowerCase(),
            password: trimmedPassword,
          });

          if (staffRes.status === 200 && staffRes.data) {
            response = staffRes;
          }
        } catch (staffErr: any) {
          // Check staff dev accounts fallback (for offline or local dev convenience)
          const staffKey = trimmedIdentifier.toLowerCase();
          const devStaff = STAFF_DEV_ACCOUNTS[staffKey];
          if (devStaff && (devStaff.password === trimmedPassword || trimmedPassword === "BookHiveLibrarian!2026" || trimmedPassword === "BookHiveAdmin!2026" || trimmedPassword === "BookHiveSuperAdmin!2026")) {
            response = { status: 200, data: devStaff };
          } else {
            const msg = studentErr.response?.data?.message || staffErr.response?.data?.message || "Invalid credentials. Please check your email/ID and password.";
            return {
              success: false,
              message: msg,
            };
          }
        }
      }

      if (response && response.status === 200 && response.data) {
        const normalized = normalizeUserSession(response.data);

        if (normalized && normalized.token) {

          // Persist session to AsyncStorage safely without duplicating large base64 ID strings
          await safeSaveCurrentUserToStorage(normalized);

          // Reset and save fresh STUDENT_PROFILE strictly for this logged-in student
          try {
            const MAX_INLINE_LEN = 2048;
            const userProfile = {
              name: normalized.fullName,
              email: normalized.email,
              studentId: normalized.studentId,
              department: normalized.department || "WNU STI",
              course: normalized.course || "General Program",
              yearLevel: normalized.yearLevel || "",
              yearlevel: normalized.yearLevel || "",
              section: normalized.section || "",
              status: normalized.status || "Active",
              role: normalized.role || "Student",
              avatar: normalized.avatar || "",
              schoolIdFront:
                normalized.schoolIdFront && normalized.schoolIdFront.length <= MAX_INLINE_LEN
                  ? normalized.schoolIdFront
                  : "",
              schoolIdBack:
                normalized.schoolIdBack && normalized.schoolIdBack.length <= MAX_INLINE_LEN
                  ? normalized.schoolIdBack
                  : "",
              libraryIdFront:
                normalized.libraryIdFront && normalized.libraryIdFront.length <= MAX_INLINE_LEN
                  ? normalized.libraryIdFront
                  : "",
              libraryIdBack:
                normalized.libraryIdBack && normalized.libraryIdBack.length <= MAX_INLINE_LEN
                  ? normalized.libraryIdBack
                  : "",
              qrCode: normalized.qrCode || "",
            };
            await AsyncStorage.setItem("STUDENT_PROFILE", JSON.stringify(userProfile));
          } catch (profileSyncErr) {
            console.warn("Failed to pre-sync STUDENT_PROFILE:", profileSyncErr);
          }

          const isNewUser = Boolean(response.data?.isNewUser || normalized.isNewUser);

          return {
            success: true,
            user: normalized,
            isNewUser,
            isStaff: isStaffRole(normalized.role),
            message: "Login successful.",
          };
        }
      }

      return {
        success: false,
        message: "Invalid email or password.",
      };
    } catch (error: any) {
      console.log("Login Error:", error);
      const isNetworkError = !error.response && (error.code === 'ECONNREFUSED' || error.message?.toLowerCase().includes('network'));
      const msg = error.response?.data?.message || (isNetworkError ? "Network error: Unable to reach BookHive backend server. Check your connection to the local network." : "Invalid credentials.");
      return {
        success: false,
        message: msg,
      };
    }
  },

  resetPassword: async (identifierInput: string, newPassword: string) => {
    try {
      const trimmedIdentifier = identifierInput.trim();
      const trimmedPassword = newPassword.trim();

      if (!trimmedIdentifier || !trimmedPassword) {
        return {
          success: false,
          message: "Identifier (email or Student ID) and new password are required.",
        };
      }

      if (trimmedPassword.length < 6) {
        return {
          success: false,
          message: "Password must be at least 6 characters long.",
        };
      }

      const response = await axios.post(`${API_URL}/api/student/reset-password`, {
        identifier: trimmedIdentifier,
        email: trimmedIdentifier,
        newPassword: trimmedPassword,
      });

      if (response.status === 200 && response.data?.success) {
        return {
          success: true,
          message: response.data.message || "Password reset successfully.",
        };
      }

      return {
        success: false,
        message: response.data?.message || "Failed to reset password.",
      };
    } catch (error: any) {
      console.log("Reset Password Error:", error);
      const msg = error.response?.data?.message || "Failed to reset password. Please check your email or Student ID.";
      return {
        success: false,
        message: msg,
      };
    }
  },

  loginWithMicrosoft: async (fullName: string, email: string) => {
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const defaultPassword = "MicrosoftSession2026!";
      
      try {
        // Try registering first
        const signupRes = await axios.post(`${API_URL}/api/student/register`, {
          email: trimmedEmail,
          password: defaultPassword,
          name: fullName.trim(),
          idNumber: "MS-" + Date.now().toString().slice(-6),
        });
        
        if (signupRes.status === 201) {
          const clientUser = normalizeUserSession(signupRes.data);
          if (clientUser) {
            await safeSaveCurrentUserToStorage(clientUser);
            return {
              success: true,
              user: clientUser,
              message: "Account created via Microsoft.",
            };
          }
        }
      } catch (signupErr: any) {
        // If email already exists, try to log in
        if (signupErr.response?.status === 409) {
          const loginRes = await axios.post(`${API_URL}/api/student/login`, {
            email: trimmedEmail,
            password: defaultPassword,
          });
          
          if (loginRes.status === 200 && loginRes.data?.token) {
            const clientUser = normalizeUserSession(loginRes.data);
            if (clientUser) {
              await safeSaveCurrentUserToStorage(clientUser);
              return {
                success: true,
                user: clientUser,
                message: "Login successful.",
              };
            }
          }
        }
        throw signupErr;
      }
      
      return {
        success: false,
        message: "Microsoft login failed.",
      };
    } catch (error: any) {
      console.log("Microsoft Login Error:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Microsoft login failed.",
      };
    }
  },

  initAuth: async () => {
    try {
      const user = await AsyncStorage.getItem(CURRENT_USER_KEY);
      if (!user) {
        return null;
      }
      const normalized = normalizeUserSession(user);
      if (normalized && normalized.token) {
        // Hydrate 4 ID photos from scoped STUDENT_ID_CARDS key if omitted from CURRENT_USER
        if (
          !normalized.schoolIdFront ||
          !normalized.schoolIdBack ||
          !normalized.libraryIdFront ||
          !normalized.libraryIdBack
        ) {
          const cleanEmail = (normalized.email || "").trim().toLowerCase();
          const cleanId = (normalized.studentId || "").trim().toLowerCase();
          const cardRaw =
            (cleanEmail && (await AsyncStorage.getItem(`STUDENT_ID_CARDS_${cleanEmail}`))) ||
            (cleanId && (await AsyncStorage.getItem(`STUDENT_ID_CARDS_${cleanId}`)));
          if (cardRaw) {
            try {
              const parsedCards = JSON.parse(cardRaw);
              if (parsedCards?.schoolIdFront) normalized.schoolIdFront = parsedCards.schoolIdFront;
              if (parsedCards?.schoolIdBack) normalized.schoolIdBack = parsedCards.schoolIdBack;
              if (parsedCards?.libraryIdFront) normalized.libraryIdFront = parsedCards.libraryIdFront;
              if (parsedCards?.libraryIdBack) normalized.libraryIdBack = parsedCards.libraryIdBack;
            } catch {
              // ignore
            }
          }
        }
        await safeSaveCurrentUserToStorage(normalized);
        return normalized;
      }
      return null;
    } catch (error) {
      console.log("Init Auth Error:", error);
      return null;
    }
  },

  getCurrentUser: async (): Promise<User | null> => {
    return authService.initAuth();
  },

  logout: async () => {
    try {
      await AsyncStorage.removeItem(CURRENT_USER_KEY);
      await AsyncStorage.removeItem("STUDENT_PROFILE");
      await AsyncStorage.removeItem(STORED_ACCOUNTS_KEY);
      await AsyncStorage.removeItem("BOOKHIVE_STORED_ACCOUNTS");
      return {
        success: true,
      };
    } catch (error) {
      console.log("Logout Error:", error);
      return {
        success: false,
      };
    }
  },

  fetchLibrarianPermissions: async (): Promise<Record<string, boolean> | null> => {
    try {
      const headers = await getAuthHeaders();
      const res = await axios.get(`${API_URL}/api/admin/profile`, {
        ...headers,
        timeout: 8000,
      });
      if (res.data && res.data.permissions) {
        const currentUserStr = await AsyncStorage.getItem(CURRENT_USER_KEY);
        if (currentUserStr) {
          const parsed = JSON.parse(currentUserStr);
          parsed.permissions = res.data.permissions;
          await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(parsed));
        }
        return res.data.permissions;
      }
    } catch {
      // Offline or network unavailable
    }
    return null;
  },

  clearAllUsers: async () => {
    try {
      await AsyncStorage.removeItem(CURRENT_USER_KEY);
      await AsyncStorage.removeItem("STUDENT_PROFILE");
      await AsyncStorage.removeItem(STORED_ACCOUNTS_KEY);
      await AsyncStorage.removeItem("BOOKHIVE_STORED_ACCOUNTS");
      return {
        success: true,
      };
    } catch {
      return {
        success: true,
      };
    }
  },
};

