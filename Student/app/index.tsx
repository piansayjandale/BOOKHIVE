import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../data/AuthContext";
import { loadStudentIdCardsForUser } from "../data/store";

export default function Index() {
  const { isSignedIn, loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // Small timeout to allow the navigation context to settle
      const timer = setTimeout(async () => {
        if (isSignedIn && user) {
          const userRole = (user.role || "").toLowerCase().trim();
          const isStaff = userRole === "librarian" || userRole === "admin" || userRole === "super admin" || userRole === "staff";

          if (isStaff) {
            // Opening the app must never automatically jump to the librarian dashboard on cold launch
            // Staff members sign in explicitly via the login screen
            router.replace("/login");
            return;
          }

          const rawStudentId = user.studentId || "";
          const isNew = Boolean(
            user.isNewUser ||
            !rawStudentId ||
            rawStudentId.startsWith("TEMP-")
          );

          if (isNew) {
            router.replace("/complete-profile");
            return;
          }

          const existingIdCards = await loadStudentIdCardsForUser(user);
          if (!existingIdCards) {
            router.replace({
              pathname: "/(tabs)/profile",
              params: { requireIdUpload: "1" },
            });
          } else {
            router.replace("/(tabs)");
          }
        } else {
          // Intro page removed on mobile: go directly to login
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
