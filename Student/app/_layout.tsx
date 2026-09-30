import { useEffect } from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../data/AuthContext";
import { useThemeColors } from "../hooks/useThemeColors";

function RootStack() {
  const { theme } = useThemeColors();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: "slide_from_right",
        animationDuration: 250,
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="complete-profile" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="librarian" />
      <Stack.Screen name="(tabs)" />
      
      {/* Modal/Non-tab screens */}
      <Stack.Screen name="scanner" />
      <Stack.Screen name="scanned-card" />
      <Stack.Screen name="borrow" />
      <Stack.Screen name="feedback" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="help" />
      <Stack.Screen name="history" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="privacy-security" />
      <Stack.Screen name="queue-details" />
      <Stack.Screen name="request-confirmation" />
      <Stack.Screen name="reservation-details" />
      <Stack.Screen name="return-history" />
      <Stack.Screen name="saved-citations" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="terms-agreement" />
      <Stack.Screen name="modal" />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // OTA update checks disabled for 100% reliable local & bundle execution
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootStack />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
