import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // When scanning the Expo Go QR code in the terminal or opening the app,
    // always direct the user to the login page first.
    const timer = setTimeout(() => {
      router.replace("/login");
    }, 100);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#001B33" }}>
      <ActivityIndicator size="large" color="#FACC15" />
    </View>
  );
}

