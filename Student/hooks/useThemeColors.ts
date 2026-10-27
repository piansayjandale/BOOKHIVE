import { useAuth } from "../data/AuthContext";

export function useThemeColors() {
  const { isDarkMode, toggleTheme } = useAuth();
  
  const theme = {
    // Primary Backgrounds
    background: isDarkMode ? "#090E1A" : "#F8FAFC",
    cardBg: isDarkMode ? "#111A2E" : "#FFFFFF",
    cardBgElevated: isDarkMode ? "#17233D" : "#FFFFFF",
    cardBorder: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "#E2E8F0",
    
    // Typography
    textPrimary: isDarkMode ? "#F8FAFC" : "#0F172A",
    textSecondary: isDarkMode ? "#94A3B8" : "#64748B",
    textMuted: isDarkMode ? "#64748B" : "#94A3B8",
    
    // Brand & Accent Colors (STI Theme: Deep Navy Blue & Golden Yellow)
    brandBlue: "#0274BB",
    brandBlueDark: "#015488",
    accentBlue: isDarkMode ? "#38BDF8" : "#0274BB",
    accentBlueLight: isDarkMode ? "rgba(56, 189, 248, 0.12)" : "rgba(2, 116, 187, 0.08)",
    accentBlueSurface: isDarkMode ? "rgba(56, 189, 248, 0.08)" : "#E0F2FE",
    
    accentGold: isDarkMode ? "#FFD700" : "#FCD400",
    accentGoldText: isDarkMode ? "#FFD700" : "#854D0E",
    accentGoldBright: isDarkMode ? "#FFD700" : "#FCD400",
    accentGoldLight: isDarkMode ? "rgba(255, 215, 0, 0.15)" : "#FEF9C3",
    accentGoldSurface: isDarkMode ? "rgba(255, 215, 0, 0.10)" : "#FEF9C3",
    starColor: isDarkMode ? "#FFD700" : "#F59E0B",
    
    // Greeting & Headline Primary Accent
    greetingAccent: isDarkMode ? "#F8FAFC" : "#0F172A",

    // Status Badges & Indicators
    statusSuccess: isDarkMode ? "#10B981" : "#16A34A",
    statusSuccessBg: isDarkMode ? "rgba(16, 185, 129, 0.15)" : "#DCFCE7",
    statusWarning: isDarkMode ? "#F59E0B" : "#D97706",
    statusWarningBg: isDarkMode ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7",
    statusDanger: isDarkMode ? "#EF4444" : "#DC2626",
    statusDangerBg: isDarkMode ? "rgba(239, 68, 68, 0.15)" : "#FEE2E2",
    statusInfo: isDarkMode ? "#38BDF8" : "#0274BB",
    statusInfoBg: isDarkMode ? "rgba(56, 189, 248, 0.15)" : "#E0F2FE",
    
    // Category Pills
    badgeCategoryBg: isDarkMode ? "rgba(56, 189, 248, 0.12)" : "#E0F2FE",
    badgeCategoryText: isDarkMode ? "#38BDF8" : "#0274BB",
    badgeCategoryBorder: isDarkMode ? "rgba(56, 189, 248, 0.25)" : "rgba(2, 116, 187, 0.20)",

    // Book Cover Container
    bookCoverBg: isDarkMode ? "#0E1729" : "#F1F5F9",
    bookCoverBorder: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "#E2E8F0",
    bookCoverIcon: isDarkMode ? "#FFD700" : "#0274BB",
    bookCoverIconBg: isDarkMode ? "rgba(255, 215, 0, 0.18)" : "#FEF9C3",
    bookCoverIconBorder: isDarkMode ? "rgba(255, 215, 0, 0.40)" : "#FDE047",

    // Form Inputs & Containers
    inputBg: isDarkMode ? "#111A2E" : "#FFFFFF",
    inputBorder: isDarkMode ? "#1F2E47" : "#E2E8F0",
    chipBg: isDarkMode ? "#17233D" : "#F1F5F9",
    chipBorder: isDarkMode ? "#1F2E47" : "#E2E8F0",
    
    // Headers & Layout
    headerBg: isDarkMode ? "#090E1A" : "#FFFFFF",
    headerBorder: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "#E2E8F0",
    headerTitle: isDarkMode ? "#F8FAFC" : "#0F172A",
    sectionTitle: isDarkMode ? "#F8FAFC" : "#0F172A",
    shadowColor: isDarkMode ? "#000000" : "#0F172A",

    // Bottom Navigation Bar
    tabBarBg: isDarkMode ? "#0B132B" : "#FFFFFF",
    tabBarBorder: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "#E2E8F0",
    tabBarActive: isDarkMode ? "#FFD700" : "#0274BB",
    tabBarInactive: isDarkMode ? "#64748B" : "#94A3B8",
    tabBarActivePill: isDarkMode ? "rgba(255, 215, 0, 0.14)" : "rgba(2, 116, 187, 0.08)",

    // Buttons (Brand CTA)
    buttonPrimaryBg: isDarkMode ? "#FFD700" : "#FCD400",
    buttonPrimaryText: isDarkMode ? "#090D16" : "#0B1A2C",
    buttonPrimaryBorder: isDarkMode ? "#FFD700" : "#FCD400",

    // STI Yellow Highlights (Warm, Eye-Pleasing Golden Yellow)
    accentYellow: "#FCD400",
    accentYellowBg: "#FCD400",
    accentYellowText: "#0B1A2C",
    accentYellowBorder: "#FCD400",
    badgeYellowBg: isDarkMode ? "rgba(252, 212, 0, 0.15)" : "#FEF9C3",
    badgeYellowText: isDarkMode ? "#FFD700" : "#854D0E",
    badgeYellowBorder: isDarkMode ? "rgba(252, 212, 0, 0.4)" : "#FDE047",
  };
  
  return { isDarkMode, toggleTheme, theme };
}
