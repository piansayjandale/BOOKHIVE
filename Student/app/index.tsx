import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../data/AuthContext";

export default function Index() {
  const { isSignedIn, loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // Small timeout to allow the navigation context to settle
      const timer = setTimeout(() => {
        if (isSignedIn) {
          const isTempId = !user || !user.studentId || user.studentId.startsWith("STI-") || user.studentId.startsWith("MS-") || !user.studentId.includes("-");
          if (isTempId) {
            router.replace("/complete-profile");
          } else {
            router.replace("/(tabs)");
          }
        } else {
          router.replace("/login");
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, isSignedIn, user, router]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#001B33" }}>
      <ActivityIndicator size="large" color="#FACC15" />
    </View>
  );
}
