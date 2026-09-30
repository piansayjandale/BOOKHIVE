import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../data/AuthContext";
import AnimatedScreen from "../components/AnimatedScreen";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../hooks/useThemeColors";

const isValidEmail = (email: string) =>
  /\S+@\S+\.\S+/.test(email);

const isSchoolEmail = (email: string) =>
  isValidEmail(email) &&
  (email.toLowerCase().endsWith("@sti.edu.ph") ||
   email.toLowerCase().endsWith("@stiwnu.edu.ph") ||
   email.toLowerCase().endsWith("@wnu.sti.edu.ph"));

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },

  topSection: {
    alignItems: "center",
    marginBottom: 32,
  },

  title: {
    fontSize: 38,
    fontWeight: "800",
    marginTop: 12,
    letterSpacing: -0.5,
  },

  subtitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 12,
  },

  card: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    elevation: 8,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },

  loginTitle: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 20,
  },

  inputContainer: {
    height: 54,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
  },

  loginButton: {
    height: 54,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    elevation: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },

  loginButtonText: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  errorText: {
    color: "#EF4444",
    marginBottom: 12,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },


  eyeButton: {
    padding: 8,
  },
  themeToggle: {
    position: "absolute",
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
});

function LoginScreenContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode, toggleTheme } = useThemeColors();

  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const backAction = () => {
      BackHandler.exitApp();
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => backHandler.remove();
  }, []);

  const showAlert = (
    title: string,
    message: string
  ) => {
    Alert.alert(title, message);
  };

  const handleLogin = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();

      if (!trimmedEmail) {
        const message = "Please enter your school email or Student ID.";
        setErrorMessage(message);
        showAlert("Missing input", message);
        return;
      }

      if (!trimmedPassword) {
        const message = "Please enter your password.";
        setErrorMessage(message);
        showAlert("Missing password", message);
        return;
      }

      if (trimmedEmail.includes("@")) {
        if (!isValidEmail(trimmedEmail)) {
          const message = "Please enter a valid school email address (e.g., student@sti.edu.ph or @wnu.sti.edu.ph).";
          setErrorMessage(message);
          showAlert("Invalid email format", message);
          return;
        }
      }

      const result = await login(
        trimmedEmail,
        trimmedPassword
      );

      if (result.success) {
        setErrorMessage("");

        // Differentiate role: Librarian / Staff vs Student
        const userRole = (result.user?.role || "").toLowerCase().trim();
        const isStaff = userRole === "librarian" || userRole === "admin" || userRole === "super admin" || userRole === "staff";

        if (isStaff) {
          showAlert("Welcome", `Logged in as ${result.user?.role || "Librarian"}`);
          router.replace("/librarian");
          return;
        }

        const rawStudentId = result.user?.studentId || "";
        const isNew = Boolean(
          (result.isNewUser || result.user?.isNewUser) &&
          (rawStudentId.startsWith("TEMP-") || !rawStudentId)
        );

        if (isNew) {
          router.replace({
            pathname: "/complete-profile",
            params: { email: trimmedEmail },
          });
          return;
        }

        showAlert(
          "Success",
          "Logged in successfully."
        );

        router.replace("/(tabs)");
        return;
      }

      const message =
        result.message ??
        "Unable to login. Please check your credentials.";

      setErrorMessage(message);

      showAlert("Error", message);
    } catch (error) {
      console.log("Login Error:", error);

      showAlert(
        "Error",
        "Something went wrong during login."
      );
    } finally {
      setLoading(false);
    }
  };


  return (
    <AnimatedScreen style={{ flex: 1 }}>
      <TouchableOpacity
        style={[
          styles.themeToggle,
          {
            top: insets.top + 10,
            right: 20,
          }
        ]}
        onPress={() => toggleTheme()}
      >
        <Ionicons
          name={isDarkMode ? "sunny-outline" : "moon-outline"}
          size={24}
          color={theme.accentGold}
        />
      </TouchableOpacity>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { backgroundColor: theme.background }]}
      >
      <ScrollView
        contentContainerStyle={[styles.scrollContainer, { paddingTop: 40 + insets.top }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topSection}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            BookHive
          </Text>

          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Welcome to BookHive
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
          <Text style={[styles.loginTitle, { color: theme.textPrimary }]}>
            Log in to your account
          </Text>

          <View style={[styles.inputContainer, { borderColor: theme.cardBorder }]}>
            <Ionicons name="mail-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder="School Email or ID (Student or Staff)"
              placeholderTextColor={isDarkMode ? "rgba(255, 255, 255, 0.35)" : "rgba(0, 0, 0, 0.35)"}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setErrorMessage("");
              }}
              keyboardType="default"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={[styles.inputContainer, { borderColor: theme.cardBorder }]}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder="••••••••"
              placeholderTextColor={isDarkMode ? "rgba(255, 255, 255, 0.35)" : "rgba(0, 0, 0, 0.35)"}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setErrorMessage("");
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
            >
              <Ionicons
                name={showPassword ? "eye" : "eye-off"}
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {errorMessage ? (
            <Text style={styles.errorText}>
              {errorMessage}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: theme.buttonPrimaryBg }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={[styles.loginButtonText, { color: theme.buttonPrimaryText }]}>
              {loading ? "Logging in..." : "Log In"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </AnimatedScreen>
  );
}

export default function LoginScreen() {
  return <LoginScreenContent />;
}
