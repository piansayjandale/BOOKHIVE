import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Constants from "expo-constants";
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
  status?: string;
  token?: string;
  avatar?: string;
  qrCode?: string;
};

const CURRENT_USER_KEY = "CURRENT_USER";

// Dynamically resolve the backend URL from Expo host URI or backendConfig
const getBackendUrl = () => {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(":")[0];
    // Check if the host is a standard IPv4 address
    const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(host);
    if (isIp) {
      return `http://${host}:4000`;
    }
  }

  // If hostUri is a tunnel (domain name) or not available, use the pre-detected local IP
  if (backendConfig && backendConfig.localIp) {
    return `http://${backendConfig.localIp}:4000`;
  }

  return "http://localhost:4000"; // fallback
};

export const API_URL = getBackendUrl();

export const isValidEmail = (email: string) =>
  /\S+@\S+\.\S+/.test(email);

export const isSchoolEmail = (email: string) =>
  isValidEmail(email) &&
  (email.toLowerCase().endsWith("@sti.edu.ph") ||
   email.toLowerCase().endsWith("@stiwnu.edu.ph") ||
   email.toLowerCase().endsWith("@wnu.sti.edu.ph") ||
   email.toLowerCase().includes(".sti."));

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
  const qrCode = base.qrCode || base.qr_code || "";

  return {
    id: String(id),
    fullName: String(fullName).trim(),
    studentId: String(studentId).trim(),
    email: String(email).trim().toLowerCase(),
    role: String(role),
    department: String(department),
    course: String(course),
    status: String(status),
    token: userToken ? String(userToken).trim() : undefined,
    avatar: avatar ? String(avatar) : undefined,
    qrCode: qrCode ? String(qrCode) : undefined,
  };
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
  ) => {
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedFullName = fullName.trim();
      const trimmedStudentId = studentId.trim();
      const trimmedPassword = password.trim();

      if (!trimmedFullName || !trimmedStudentId) {
        return {
          success: false,
          message: "Full name and student ID are required.",
        };
      }

      if (trimmedPassword.length < 6) {
        return {
          success: false,
          message: "Password must be at least 6 characters long.",
        };
      }

      if (!isValidEmail(trimmedEmail)) {
        return {
          success: false,
          message: "Invalid email format.",
        };
      }

      if (!isSchoolEmail(trimmedEmail)) {
        return {
          success: false,
          message: "Please use a school email (e.g., @sti.edu.ph or @wnu.sti.edu.ph).",
        };
      }

      // Call Express registration API
      const response = await axios.post(`${API_URL}/api/student/register`, {
        email: trimmedEmail,
        password: trimmedPassword,
        name: trimmedFullName,
        idNumber: trimmedStudentId,
      });

      if (response.status === 201) {
        return {
          success: true,
          message: "Account created successfully.",
        };
      }

      return {
        success: false,
        message: "Signup failed.",
      };
    } catch (error: any) {
      console.log("Signup Error:", error);
      const msg = error.response?.data?.message || "Signup failed.";
      return {
        success: false,
        message: msg,
      };
    }
  },

  login: async (identifierInput: string, password: string) => {
    try {
      const trimmedIdentifier = identifierInput.trim();
      const trimmedPassword = password.trim();

      if (!trimmedIdentifier) {
        return {
          success: false,
          message: "Please enter your school email or Student ID.",
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

      // Call Express student login endpoint
      const response = await axios.post(`${API_URL}/api/student/login`, {
        email: trimmedIdentifier.toLowerCase(),
        identifier: trimmedIdentifier,
        password: trimmedPassword,
      });

      if (response.status === 200 && response.data) {
        const normalized = normalizeUserSession(response.data);

        if (normalized && normalized.token) {
          // Persist session to AsyncStorage
          await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(normalized));

          // Also update cached STUDENT_PROFILE for immediate synchronization
          try {
            const currentProfileStr = await AsyncStorage.getItem("STUDENT_PROFILE");
            const existingProfile = currentProfileStr ? JSON.parse(currentProfileStr) : {};
            const mergedProfile = {
              ...existingProfile,
              name: normalized.fullName,
              email: normalized.email,
              studentId: normalized.studentId,
              department: normalized.department,
              course: normalized.course,
              avatar: normalized.avatar || existingProfile.avatar,
            };
            await AsyncStorage.setItem("STUDENT_PROFILE", JSON.stringify(mergedProfile));
          } catch (profileSyncErr) {
            console.warn("Failed to pre-sync STUDENT_PROFILE:", profileSyncErr);
          }

          return {
            success: true,
            user: normalized,
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
      const msg = error.response?.data?.message || "Invalid credentials.";
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
            await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(clientUser));
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
              await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(clientUser));
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
        // Update stored session if structure was normalized
        await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(normalized));
        return normalized;
      }
      return null;
    } catch (error) {
      console.log("Init Auth Error:", error);
      return null;
    }
  },

  logout: async () => {
    try {
      await AsyncStorage.removeItem(CURRENT_USER_KEY);
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

  clearAllUsers: async () => {
    return {
      success: true,
    };
  },
};

