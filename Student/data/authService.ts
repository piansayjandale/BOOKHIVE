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

const isValidEmail = (email: string) =>
  /\S+@\S+\.\S+/.test(email);

const isSchoolEmail = (email: string) =>
  isValidEmail(email) &&
  (email.toLowerCase().endsWith("@sti.edu.ph") ||
   email.toLowerCase().endsWith("@stiwnu.edu.ph") ||
   email.toLowerCase().endsWith("@wnu.sti.edu.ph"));

export const getAuthHeaders = async () => {
  try {
    const userJson = await AsyncStorage.getItem(CURRENT_USER_KEY);
    if (userJson) {
      const userObj = JSON.parse(userJson);
      if (userObj && userObj.token) {
        return {
          headers: {
            Authorization: `Bearer ${userObj.token}`,
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

  login: async (email: string, password: string) => {
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPassword = password.trim();

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

      // Call Express login API
      const response = await axios.post(`${API_URL}/api/student/login`, {
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (response.status === 200 && response.data?.token) {
        const backendUser = response.data.user;
        const clientUser: User = {
          fullName: backendUser.name,
          studentId: backendUser.idNumber,
          email: backendUser.email,
          id: backendUser.id,
          role: backendUser.role,
          department: backendUser.department,
          course: backendUser.course,
          status: backendUser.status,
          token: response.data.token,
        };

        await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(clientUser));

        return {
          success: true,
          user: clientUser,
          message: "Login successful.",
        };
      }

      return {
        success: false,
        message: "Invalid email or password.",
      };
    } catch (error: any) {
      console.log("Login Error:", error);
      const msg = error.response?.data?.message || "Invalid email or password.";
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
          const backendUser = signupRes.data.user;
          const clientUser: User = {
            fullName: backendUser.name,
            studentId: backendUser.idNumber,
            email: backendUser.email,
            id: backendUser.id,
            role: backendUser.role,
            department: backendUser.department,
            course: backendUser.course,
            status: backendUser.status,
            token: signupRes.data.token,
          };
          
          await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(clientUser));
          
          return {
            success: true,
            user: clientUser,
            message: "Account created via Microsoft.",
          };
        }
      } catch (signupErr: any) {
        // If email already exists, try to log in
        if (signupErr.response?.status === 409) {
          const loginRes = await axios.post(`${API_URL}/api/student/login`, {
            email: trimmedEmail,
            password: defaultPassword,
          });
          
          if (loginRes.status === 200 && loginRes.data?.token) {
            const backendUser = loginRes.data.user;
            const clientUser: User = {
              fullName: backendUser.name,
              studentId: backendUser.idNumber,
              email: backendUser.email,
              id: backendUser.id,
              role: backendUser.role,
              department: backendUser.department,
              course: backendUser.course,
              status: backendUser.status,
              token: loginRes.data.token,
            };
            
            await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(clientUser));
            
            return {
              success: true,
              user: clientUser,
              message: "Login successful.",
            };
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
      return JSON.parse(user);
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
    // No-op for DB backed mode since users live in database
    return {
      success: true,
    };
  },
};
