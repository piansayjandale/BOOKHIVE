import React, { createContext, useContext, useEffect, useState } from "react";
import { authService, type User, normalizeUserSession } from "./authService";
import { clearLocalCache } from "./store";

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
    const result = await authService.login(email, password);

    if (result.success && result.user) {
      await clearLocalCache();
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
    const res = await authService.logout();

    if (res.success) {
      await clearLocalCache();
      setUser(null);
    }

    return res;
  };

  const clearAllUsers = async () => {
    return await authService.clearAllUsers();
  };

  const [isDarkMode, setIsDarkMode] = useState(true);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const updateUser = (updatedUser: Partial<User>) => {
    setUser((prev) => prev ? { ...prev, ...updatedUser } : null);
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
