import { useAuth } from "../data/AuthContext";

export function useThemeColors() {
  const { isDarkMode, toggleTheme } = useAuth();
  
  const theme = {
    // Primary Backgrounds
    background: isDarkMode ? "#090D16" : "#F8FAFC",
    cardBg: isDarkMode ? "#111827" : "#FFFFFF",
    cardBgElevated: isDarkMode ? "#1F2937" : "#FFFFFF",
    cardBorder: isDarkMode ? "#1F2937" : "rgba(2, 116, 187, 0.15)",
    
    // Typography
    textPrimary: isDarkMode ? "#F9FAFB" : "#0F172A",
    textSecondary: isDarkMode ? "#9CA3AF" : "#64748B",
    textMuted: isDarkMode ? "#6B7280" : "#94A3B8",
    
    // Brand & Accent Colors
    brandBlue: "#0274BB",
    accentBlue: isDarkMode ? "#38BDF8" : "#0274BB",
    accentBlueLight: isDarkMode ? "rgba(56, 189, 248, 0.15)" : "rgba(2, 116, 187, 0.08)",
    accentGold: isDarkMode ? "#FFD700" : "#D97706",
    accentGoldBright: isDarkMode ? "#FFD700" : "#F59E0B",
    accentGoldLight: isDarkMode ? "rgba(255, 215, 0, 0.15)" : "rgba(255, 243, 0, 0.28)",
    accentGoldSurface: isDarkMode ? "rgba(255, 215, 0, 0.12)" : "rgba(255, 243, 0, 0.28)",
    starColor: isDarkMode ? "#FFD700" : "#F59E0B",
    
    // Greeting & Headline Primary Accent
    greetingAccent: isDarkMode ? "#FFD700" : "#0274BB",

    // Status Badges & Indicators
    statusSuccess: isDarkMode ? "#10B981" : "#059669",
    statusSuccessBg: isDarkMode ? "rgba(16, 185, 129, 0.15)" : "rgba(5, 150, 105, 0.10)",
    statusWarning: isDarkMode ? "#F59E0B" : "#D97706",
    statusWarningBg: isDarkMode ? "rgba(245, 158, 11, 0.15)" : "rgba(245, 158, 11, 0.12)",
    statusDanger: isDarkMode ? "#EF4444" : "#DC2626",
    statusDangerBg: isDarkMode ? "rgba(239, 68, 68, 0.15)" : "rgba(220, 38, 38, 0.10)",
    statusInfo: isDarkMode ? "#38BDF8" : "#0274BB",
    statusInfoBg: isDarkMode ? "rgba(56, 189, 248, 0.15)" : "rgba(2, 116, 187, 0.08)",
    
    // Category Pills
    badgeCategoryBg: isDarkMode ? "rgba(56, 189, 248, 0.12)" : "rgba(2, 116, 187, 0.08)",
    badgeCategoryText: isDarkMode ? "#38BDF8" : "#0274BB",
    badgeCategoryBorder: isDarkMode ? "rgba(56, 189, 248, 0.25)" : "rgba(2, 116, 187, 0.20)",

    // Book Cover Placeholder Container
    bookCoverBg: isDarkMode ? "#0B1528" : "#F1F5F9",
    bookCoverBorder: isDarkMode ? "#142347" : "rgba(2, 116, 187, 0.15)",
    bookCoverIcon: isDarkMode ? "#FFD700" : "#0274BB",

    // Form Inputs & Containers
    inputBg: isDarkMode ? "#111827" : "#FFFFFF",
    inputBorder: isDarkMode ? "#374151" : "rgba(2, 116, 187, 0.20)",
    chipBg: isDarkMode ? "#1F2937" : "#F1F5F9",
    chipBorder: isDarkMode ? "#374151" : "rgba(2, 116, 187, 0.15)",
    
    // Headers & Layout
    headerBg: isDarkMode ? "#090D16" : "#FFFFFF",
    headerBorder: isDarkMode ? "#1F2937" : "rgba(2, 116, 187, 0.15)",
    headerTitle: isDarkMode ? "#F9FAFB" : "#0274BB",
    sectionTitle: isDarkMode ? "#FFD700" : "#0274BB",
    shadowColor: isDarkMode ? "#000000" : "#0F172A",

    // Bottom Navigation Bar
    tabBarBg: isDarkMode ? "#030C1C" : "#FFFFFF",
    tabBarBorder: isDarkMode ? "#0C172C" : "rgba(2, 116, 187, 0.15)",
    tabBarActive: isDarkMode ? "#FFD700" : "#0274BB",
    tabBarInactive: isDarkMode ? "#8E9DAE" : "#64748B",
    tabBarActivePill: isDarkMode ? "#142347" : "#FFF300",

    // Buttons (Brand CTA)
    buttonPrimaryBg: isDarkMode ? "#FFD700" : "#FFF300",
    buttonPrimaryText: isDarkMode ? "#090D16" : "#0274BB",
    buttonPrimaryBorder: isDarkMode ? "#FFD700" : "#FFF300",

    // STI Yellow Highlights (Identical shade to Web System)
    accentYellow: "#FFF300",
    accentYellowBg: "#FFF300",
    accentYellowText: "#0274BB",
    accentYellowBorder: "#FFF300",
    badgeYellowBg: isDarkMode ? "rgba(252, 212, 0, 0.15)" : "#FFF300",
    badgeYellowText: isDarkMode ? "#FFD700" : "#0274BB",
    badgeYellowBorder: isDarkMode ? "rgba(252, 212, 0, 0.4)" : "#FFF300",
  };
  
  return { isDarkMode, toggleTheme, theme };
}
