import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../data/AuthContext";
import AnimatedScreen from "../components/AnimatedScreen";
import { useThemeColors } from "../hooks/useThemeColors";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 24,
    justifyContent: "center",
  },

  topSection: {
    alignItems: "center",
    marginBottom: 20,
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
    height: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
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
});

const isValidEmail = (email: string) => /\S+@\S+\.\S+/.test(email);

const isSchoolEmail = (email: string) =>
  isValidEmail(email) &&
  (email.toLowerCase().endsWith("@sti.edu.ph") || email.toLowerCase().endsWith("@stiwnu.edu.ph"));

function SignupScreenContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useThemeColors();

  const { signup, login } = useAuth();

  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const showAlert = (title: string, message: string) => {
    Alert.alert(title, message);
  };

  const handleSignup = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      if (!fullName.trim() || !studentId.trim()) {
        const message = "Please provide your full name and student ID.";
        setErrorMessage(message);
        showAlert("Missing fields", message);
        return;
      }

      const trimmedEmail = email.trim().toLowerCase();

      if (!isValidEmail(trimmedEmail)) {
        const message = "Please enter a valid email.";
        setErrorMessage(message);
        showAlert("Invalid email", message);
        return;
      }

      if (!isSchoolEmail(trimmedEmail)) {
        const message = "Please use your school email ending in .sti.edu.ph.";
        setErrorMessage(message);
        showAlert("Invalid email", message);
        return;
      }

      if (!password) {
        const message = "Please enter a password.";
        setErrorMessage(message);
        showAlert("Missing password", message);
        return;
      }

      if (password !== confirmPassword) {
        const message = "Passwords do not match.";
        setErrorMessage(message);
        showAlert("Password mismatch", message);
        return;
      }

      const result = await signup(fullName, studentId, trimmedEmail, password);

      if (!result.success) {
        const message = result.message ?? "Unable to sign up.";
        setErrorMessage(message);
        showAlert("Error", message);
        return;
      }

      // Auto-login after signup
      const loginResult = await login(trimmedEmail, password);

      if (loginResult.success) {
        showAlert("Success", "Account created and logged in.");
        const hasTempId = !loginResult.user || !loginResult.user.studentId || loginResult.user.studentId.startsWith("STI-") || loginResult.user.studentId.startsWith("MS-") || !loginResult.user.studentId.includes("-");
        if (hasTempId) {
          router.replace("/complete-profile");
        } else {
          router.replace("/(tabs)");
        }
        return;
      }

      showAlert("Success", "Account created. Please log in.");
      router.replace("/login");
    } catch (error) {
      console.log("Signup Error:", error);
      showAlert("Error", "Something went wrong during signup.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatedScreen style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      <View style={styles.topSection}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>BookHive</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Create your account</Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
        <Text style={[styles.loginTitle, { color: theme.textPrimary }]}>Sign up</Text>

        <View style={[styles.inputContainer, { borderColor: theme.cardBorder }]}>
          <TextInput
            style={[styles.input, { color: theme.textPrimary }]}
            placeholder="Full Name"
            placeholderTextColor={theme.textSecondary}
            value={fullName}
            onChangeText={(v) => {
              setFullName(v);
              setErrorMessage("");
            }}
            autoCapitalize="words"
          />
        </View>

        <View style={[styles.inputContainer, { borderColor: theme.cardBorder }]}>
          <TextInput
            style={[styles.input, { color: theme.textPrimary }]}
            placeholder="Student ID"
            placeholderTextColor={theme.textSecondary}
            value={studentId}
            onChangeText={(v) => {
              setStudentId(v);
              setErrorMessage("");
            }}
            autoCapitalize="none"
          />
        </View>

        <View style={[styles.inputContainer, { borderColor: theme.cardBorder }]}>
          <TextInput
            style={[styles.input, { color: theme.textPrimary }]}
            placeholder="School Email"
            placeholderTextColor={theme.textSecondary}
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setErrorMessage("");
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={[styles.inputContainer, { borderColor: theme.cardBorder }]}>
          <TextInput
            style={[styles.input, { color: theme.textPrimary }]}
            placeholder="Password"
            placeholderTextColor={theme.textSecondary}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setErrorMessage("");
            }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={[styles.inputContainer, { borderColor: theme.cardBorder }]}>
          <TextInput
            style={[styles.input, { color: theme.textPrimary }]}
            placeholder="Confirm Password"
            placeholderTextColor={theme.textSecondary}
            value={confirmPassword}
            onChangeText={(v) => {
              setConfirmPassword(v);
              setErrorMessage("");
            }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <TouchableOpacity style={[styles.loginButton, { backgroundColor: theme.accentGold }]} onPress={handleSignup} disabled={loading}>
          <Text style={[styles.loginButtonText, { color: isDarkMode ? "#090D16" : "#FFFFFF" }]}>{loading ? "Creating..." : "Create account"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace("/login")}>
          <Text style={{ marginTop: 18, textAlign: "center", color: theme.accentGold, fontWeight: "700" }}>
            Already have an account? Log in
          </Text>
        </TouchableOpacity>
      </View>
    </AnimatedScreen>
  );
}

export default function SignupScreen() {
  return <SignupScreenContent />;
}
