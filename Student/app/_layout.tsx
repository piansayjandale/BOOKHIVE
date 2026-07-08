import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../data/AuthContext";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="complete-profile" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="(tabs)" />
          
          {/* Modal/Non-tab screens */}
          <Stack.Screen name="scanner" />
          <Stack.Screen name="borrow" />
          <Stack.Screen name="feedback" />
          <Stack.Screen name="edit-profile" />
          <Stack.Screen name="help" />
          <Stack.Screen name="history" />
          <Stack.Screen name="librarian" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="privacy-security" />
          <Stack.Screen name="queue-details" />
          <Stack.Screen name="request-confirmation" />
          <Stack.Screen name="reservation-details" />
          <Stack.Screen name="return-history" />
          <Stack.Screen name="saved-citations" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="modal" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
