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
  Modal,
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
    fontSize: 15,
    fontWeight: "500",
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

  signupText: {
    marginTop: 20,
    textAlign: "center",
    fontWeight: "700",
    fontSize: 14,
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

  const { login, resetPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot password modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

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

  const handleResetPassword = async () => {
    if (!resetIdentifier.trim()) {
      setResetError("Please enter your school email or Student ID.");
      return;
    }
    if (!resetNewPassword.trim() || resetNewPassword.trim().length < 6) {
      setResetError("New password must be at least 6 characters long.");
      return;
    }

    try {
      setResetLoading(true);
      setResetError("");
      setResetSuccess("");

      const res = await resetPassword(resetIdentifier.trim(), resetNewPassword.trim());
      if (res.success) {
        setResetSuccess(res.message || "Password reset successfully!");
        setTimeout(() => {
          setShowResetModal(false);
          setEmail(resetIdentifier.trim());
          setResetIdentifier("");
          setResetNewPassword("");
          setResetSuccess("");
        }, 1500);
      } else {
        setResetError(res.message || "Failed to reset password.");
      }
    } catch (err: any) {
      setResetError("An error occurred during password reset.");
    } finally {
      setResetLoading(false);
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
            Welcome back
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
              placeholder="School Email or Student ID"
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

          <TouchableOpacity
            style={{ alignSelf: "flex-end", marginBottom: 16, marginTop: -4 }}
            onPress={() => {
              setResetIdentifier(email);
              setResetError("");
              setResetSuccess("");
              setShowResetModal(true);
            }}
          >
            <Text style={{ color: theme.accentGold, fontSize: 13, fontWeight: "600" }}>
              Forgot Password?
            </Text>
          </TouchableOpacity>

          {errorMessage ? (
            <Text style={styles.errorText}>
              {errorMessage}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: theme.accentGold }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={[styles.loginButtonText, { color: isDarkMode ? "#090D16" : "#FFFFFF" }]}>
              {loading ? "Logging in..." : "Log In"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace("/signup")}>
            <Text style={[styles.signupText, { color: theme.accentGold }]}>
              Don't have an account? Sign up
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Reset Password Modal */}
      <Modal
        visible={showResetModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowResetModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 20 }}>
          <View style={{ width: "100%", maxWidth: 400, backgroundColor: theme.cardBg, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: theme.cardBorder }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: theme.textPrimary }}>Reset Password</Text>
              <TouchableOpacity onPress={() => setShowResetModal(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 16 }}>
              Enter your registered School Email or Student ID and a new password to recover access.
            </Text>

            <View style={[styles.inputContainer, { borderColor: theme.cardBorder, marginBottom: 12 }]}>
              <Ionicons name="person-outline" size={20} color={theme.textSecondary} />
              <TextInput
                style={[styles.input, { color: theme.textPrimary }]}
                placeholder="School Email or Student ID"
                placeholderTextColor={theme.textSecondary}
                value={resetIdentifier}
                onChangeText={setResetIdentifier}
                autoCapitalize="none"
              />
            </View>

            <View style={[styles.inputContainer, { borderColor: theme.cardBorder, marginBottom: 16 }]}>
              <Ionicons name="key-outline" size={20} color={theme.textSecondary} />
              <TextInput
                style={[styles.input, { color: theme.textPrimary }]}
                placeholder="New Password (min 6 chars)"
                placeholderTextColor={theme.textSecondary}
                value={resetNewPassword}
                onChangeText={setResetNewPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            {resetError ? (
              <Text style={[styles.errorText, { marginBottom: 12 }]}>{resetError}</Text>
            ) : null}

            {resetSuccess ? (
              <Text style={{ color: "#10B981", fontSize: 13, marginBottom: 12, textAlign: "center" }}>{resetSuccess}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.loginButton, { backgroundColor: theme.accentGold, marginTop: 4 }]}
              onPress={handleResetPassword}
              disabled={resetLoading}
            >
              <Text style={[styles.loginButtonText, { color: isDarkMode ? "#090D16" : "#FFFFFF" }]}>
                {resetLoading ? "Resetting..." : "Reset Password"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </KeyboardAvoidingView>
    </AnimatedScreen>
  );
}

export default function LoginScreen() {
  return <LoginScreenContent />;
}
