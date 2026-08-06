import { useAuth } from "../data/AuthContext";

export function useThemeColors() {
  const { isDarkMode, toggleTheme } = useAuth();
  
  const theme = {
    // Primary Backgrounds
    background: isDarkMode ? "#090D16" : "#F8FAFC",
    cardBg: isDarkMode ? "#111827" : "#FFFFFF",
    cardBgElevated: isDarkMode ? "#1F2937" : "#F8FAFC",
    cardBorder: isDarkMode ? "#1F2937" : "#E2E8F0",
    
    // Typography
    textPrimary: isDarkMode ? "#F9FAFB" : "#0F172A",
    textSecondary: isDarkMode ? "#9CA3AF" : "#334155",
    textMuted: isDarkMode ? "#6B7280" : "#64748B",
    
    // Brand & Accent Colors
    accentGold: isDarkMode ? "#FFD700" : "#D97706",
    accentGoldBright: isDarkMode ? "#FFD700" : "#F59E0B",
    accentGoldLight: isDarkMode ? "rgba(255, 215, 0, 0.15)" : "#FEF3C7",
    accentBlue: isDarkMode ? "#3B82F6" : "#2563EB",
    accentBlueLight: isDarkMode ? "rgba(59, 130, 246, 0.15)" : "rgba(37, 99, 235, 0.12)",
    
    // Greeting & Headline Primary Accent
    greetingAccent: isDarkMode ? "#FFD700" : "#0F172A",

    // Status Badges & Indicators
    statusSuccess: isDarkMode ? "#10B981" : "#059669",
    statusSuccessBg: isDarkMode ? "rgba(16, 185, 129, 0.15)" : "rgba(5, 150, 105, 0.12)",
    statusWarning: isDarkMode ? "#F59E0B" : "#D97706",
    statusWarningBg: isDarkMode ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7",
    statusDanger: isDarkMode ? "#EF4444" : "#DC2626",
    statusDangerBg: isDarkMode ? "rgba(239, 68, 68, 0.15)" : "rgba(220, 38, 38, 0.12)",
    statusInfo: isDarkMode ? "#06B6D4" : "#0284C7",
    statusInfoBg: isDarkMode ? "rgba(6, 182, 212, 0.15)" : "rgba(2, 132, 199, 0.12)",
    
    // Category Pills
    badgeCategoryBg: isDarkMode ? "rgba(255, 215, 0, 0.15)" : "#FEF3C7",
    badgeCategoryText: isDarkMode ? "#FFD700" : "#D97706",
    badgeCategoryBorder: isDarkMode ? "rgba(255, 215, 0, 0.3)" : "#FDE68A",

    // Book Cover Placeholder Container
    bookCoverBg: isDarkMode ? "#0B1528" : "#EEF2F6",
    bookCoverBorder: isDarkMode ? "#142347" : "#CBD5E1",
    bookCoverIcon: isDarkMode ? "#FFD700" : "#D97706",

    // Form Inputs & Containers
    inputBg: isDarkMode ? "#111827" : "#FFFFFF",
    inputBorder: isDarkMode ? "#374151" : "#E2E8F0",
    chipBg: isDarkMode ? "#1F2937" : "#F1F5F9",
    chipBorder: isDarkMode ? "#374151" : "#E2E8F0",
    
    // Headers & Layout
    headerBg: isDarkMode ? "#090D16" : "#FFFFFF",
    headerBorder: isDarkMode ? "#1F2937" : "#E2E8F0",
    shadowColor: isDarkMode ? "#000000" : "rgba(0, 0, 0, 0.08)",

    // Bottom Navigation Bar
    tabBarBg: isDarkMode ? "#030C1C" : "#FFFFFF",
    tabBarBorder: isDarkMode ? "#0C172C" : "#E2E8F0",
    tabBarActive: isDarkMode ? "#FFD700" : "#D97706",
    tabBarInactive: isDarkMode ? "#8E9DAE" : "#64748B",
    tabBarActivePill: isDarkMode ? "#142347" : "#FEF3C7",
  };
  
  return { isDarkMode, toggleTheme, theme };
}
