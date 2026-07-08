import { useAuth } from "../data/AuthContext";

export function useThemeColors() {
  const { isDarkMode, toggleTheme } = useAuth();
  
  const theme = {
    background: isDarkMode ? "#080F1E" : "#F8FAFC",
    cardBg: isDarkMode ? "#111A2E" : "#FFFFFF",
    cardBorder: isDarkMode ? "#1E293B" : "#E2E8F0",
    textPrimary: isDarkMode ? "#F8FAFC" : "#0F172A",
    textSecondary: isDarkMode ? "#94A3B8" : "#475569",
    accentGold: isDarkMode ? "#FCD34D" : "#0B5A8E", 
    headerBg: isDarkMode ? "#080F1E" : "#FFFFFF",
    headerBorder: isDarkMode ? "#111A2E" : "#E2E8F0",
  };
  
  return { isDarkMode, toggleTheme, theme };
}
