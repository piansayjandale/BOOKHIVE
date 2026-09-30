import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authService, type User, normalizeUserSession } from "./authService";
import { clearLocalCache, resetProfileCache } from "./store";

type AuthContextType = {
  user: User | null;
  isSignedIn: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<any>;
  resetPassword: (identifier: string, newPassword: string) => Promise<any>;
  signup: (
    fullName: string,
    studentId: string,
    email: string,
    password: string
  ) => Promise<any>;
  logout: () => Promise<any>;
  clearAllUsers: () => Promise<any>;
  updateUser: (updatedUser: Partial<User>) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export const AuthProvider = ({ children }: any) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const u = await authService.initAuth();
        if (u) {
          setUser(u);
        }
      } catch (error) {
        console.log("AuthProvider init error:", error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const login = async (email: string, password: string) => {
    // Clear local cache FIRST before login to prevent any state leakage from previous session
    await clearLocalCache();
    const result = await authService.login(email, password);

    if (result.success && result.user) {
      resetProfileCache({
        name: result.user.fullName,
        email: result.user.email,
        studentId: result.user.studentId,
        department: result.user.department,
        course: result.user.course,
        yearLevel: result.user.yearLevel,
        yearlevel: result.user.yearLevel,
        section: result.user.section,
        status: result.user.status,
        role: result.user.role,
        avatar: result.user.avatar || "",
        qrCode: result.user.qrCode || "",
      });
      setUser(result.user);
    }

    return result;
  };

  const resetPassword = async (identifier: string, newPassword: string) => {
    return await authService.resetPassword(identifier, newPassword);
  };

  const signup = async (
    fullName: string,
    studentId: string,
    email: string,
    password: string
  ) => {
    return await authService.signup(
      fullName,
      studentId,
      email,
      password
    );
  };

  const logout = async () => {
    try {
      const res = await authService.logout();
      await clearLocalCache();
      setUser(null);
      return res;
    } catch (err) {
      console.warn("Logout error:", err);
      await clearLocalCache();
      setUser(null);
      return { success: true };
    }
  };

  const clearAllUsers = async () => {
    const res = await authService.clearAllUsers();
    await clearLocalCache();
    setUser(null);
    return res;
  };

  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem("@bookhive_theme_dark")
      .then((val) => {
        if (val !== null) {
          setIsDarkMode(val === "true");
        }
      })
      .catch(() => {});
  }, []);

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      AsyncStorage.setItem("@bookhive_theme_dark", String(next)).catch(() => {});
      return next;
    });
  };

  const updateUser = (updatedUser: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...updatedUser };
      AsyncStorage.setItem("CURRENT_USER", JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  const value: AuthContextType = {
    user,
    isSignedIn: !!user,
    loading,
    login,
    resetPassword,
    signup,
    logout,
    clearAllUsers,
    updateUser,
    isDarkMode,
    toggleTheme,
  };

  if (loading) {
    return (
      <AuthContext.Provider value={value}>
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return ctx;
};

export default AuthContext;
