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
import AnimatedScreen from "../components/AnimatedScreen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../data/AuthContext";
import { updateStudentProfile, COURSE_DATA, getCourseLabel, clearLocalCache } from "../data/store";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../hooks/useThemeColors";

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  topSection: {
    alignItems: "center",
    marginBottom: 30,
  },

  title: {
    fontSize: 36,
    fontWeight: "800",
    marginTop: 12,
  },

  subtitle: {
    marginTop: 6,
    fontSize: 14,
    textAlign: "center",
  },

  card: {
    borderRadius: 24,
    padding: 24,
    flexGrow: 1,
    borderWidth: 1,
    elevation: 8,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },

  setupTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },

  setupSubtitle: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: "center",
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginLeft: 4,
  },

  deptChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },

  deptChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },

  deptChipActive: {
  },

  deptChipText: {
    fontSize: 13,
    fontWeight: "600",
  },

  deptChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  inputContainer: {
    height: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  input: {
    flex: 1,
    fontSize: 15,
  },

  submitButton: {
    height: 54,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    elevation: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },

  submitButtonText: {
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
  dropdownContainer: {
    borderWidth: 1,
    borderRadius: 16,
    marginTop: -8,
    marginBottom: 16,
    maxHeight: 280,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  dropdownScroll: {
    width: "100%",
  },
  dropdownContent: {
    padding: 12,
  },
  deptGroupContainer: {
    marginBottom: 16,
  },
  deptGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  deptColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  deptGroupTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  courseOptionsContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  courseOptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  courseOptionRowActive: {
  },
  courseOptionText: {
    fontSize: 13,
    flex: 1,
    paddingRight: 8,
  },
  courseOptionTextActive: {
    fontWeight: "600",
  },
  courseOptionCode: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  courseOptionCodeActive: {
  },
});

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useThemeColors();

  const [name, setName] = useState("");
  const [course, setCourse] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<"CICT" | "COE" | "CBMA" | "CAS" | "CED" | "CHTM" | "CCJE">("CICT");
  const [idNumber, setIdNumber] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);

  const DEPARTMENTS = ["CICT", "COE", "CBMA", "CAS", "CED", "CHTM", "CCJE"] as const;

  // Clear local cache on mount to ensure fresh start for new users
  useEffect(() => {
    clearLocalCache();
  }, []);

  // Pre-fill name, course, and department from user session if available
  useEffect(() => {
    if (user) {
      if (user.fullName) {
        setName(user.fullName);
      }
      if (user.course) {
        setCourse(user.course);
      } else if (user.department && ["CICT", "COE", "CBMA", "CAS", "CED", "CHTM", "CCJE"].includes(user.department)) {
        setSelectedDepartment(user.department as any);
      }
    }
  }, [user]);

  // Auto-select department whenever course changes
  useEffect(() => {
    if (course) {
      const matchingDept = COURSE_DATA.find((group) => 
        group.courses.some((c) => c.code.toLowerCase() === course.toLowerCase())
      );
      if (matchingDept) {
        setSelectedDepartment(matchingDept.department as any);
      }
    }
  }, [course]);

  // Block hardware back button on Android so they must complete profile setup
  useEffect(() => {
    const backAction = () => {
      Alert.alert("Hold on!", "You must complete your profile setup to proceed.");
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => backHandler.remove();
  }, []);

  const handleSetupSubmit = async () => {
    try {
      setErrorMessage("");
      const trimmedName = name.trim();
      const trimmedCourse = course.trim().toUpperCase();
      const trimmedId = idNumber.trim();

      if (!trimmedName || !trimmedCourse || !trimmedId) {
        setErrorMessage("All fields are required.");
        return;
      }

      // Validate ID Number format (e.g. 23-1653-705)
      const idRegex = /^\d{2}-\d{4}-\d{3}$/;
      if (!idRegex.test(trimmedId)) {
        setErrorMessage("ID Number must be formatted as XX-XXXX-XXX (e.g. 23-1653-705).");
        return;
      }

      setLoading(true);

      // 1. Save changes to local UserProfile cache & trigger Backend API Profile update
      const res = await updateStudentProfile({
        name: trimmedName,
        course: trimmedCourse,
        studentId: trimmedId,
        department: selectedDepartment,
      });

      if (!res.success) {
        setErrorMessage(res.message || "Failed to update profile on backend.");
        setLoading(false);
        return;
      }

      // 2. Fetch and update the CURRENT_USER auth session storage
      const userJson = await AsyncStorage.getItem("CURRENT_USER");
      if (userJson) {
        const currentUser = JSON.parse(userJson);
        currentUser.fullName = trimmedName;
        currentUser.course = trimmedCourse;
        currentUser.studentId = trimmedId;
        currentUser.department = selectedDepartment;
        await AsyncStorage.setItem("CURRENT_USER", JSON.stringify(currentUser));
      }

      // 3. Update the global context state
      updateUser({
        fullName: trimmedName,
        course: trimmedCourse,
        studentId: trimmedId,
        department: selectedDepartment,
      });

      Alert.alert("Success", "Profile setup completed successfully!", [
        {
          text: "Let's Go",
          onPress: () => router.replace("/(tabs)"),
        },
      ]);
    } catch (err) {
      console.log("Complete Profile Error:", err);
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatedScreen style={{ flex: 1 }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { backgroundColor: theme.background }]}
      >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer, 
          { 
            paddingTop: 40 + insets.top,
            paddingBottom: Math.max(insets.bottom, 24),
          }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topSection}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>BookHive</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Welcome to STI BookHive library portal</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
          <Text style={[styles.setupTitle, { color: theme.textPrimary }]}>Complete Setup</Text>
          <Text style={[styles.setupSubtitle, { color: theme.textSecondary }]}>Please update your real school credentials below.</Text>

          <Text style={[styles.label, { color: theme.accentGold }]}>Full Name</Text>
          <View style={[styles.inputContainer, { borderColor: theme.cardBorder }]}>
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder="e.g. Juan Dela Cruz"
              placeholderTextColor={theme.textSecondary}
              value={name}
              onChangeText={(v) => {
                setName(v);
                setErrorMessage("");
              }}
              autoCapitalize="words"
            />
          </View>

          <Text style={[styles.label, { color: theme.accentGold }]}>Course</Text>
          <TouchableOpacity
            style={[styles.inputContainer, { borderColor: theme.cardBorder }]}
            activeOpacity={0.8}
            onPress={() => {
              setShowCourseDropdown(!showCourseDropdown);
              setErrorMessage("");
            }}
          >
            <Text 
              style={[
                styles.input, 
                { textAlignVertical: "center" },
                !course ? { color: theme.textSecondary } : { color: theme.textPrimary, fontWeight: "600" }
              ]}
            >
              {course ? getCourseLabel(course) : "e.g. BSCS or BSIT"}
            </Text>
            <Ionicons
              name={showCourseDropdown ? "chevron-up" : "chevron-down"}
              size={20}
              color={theme.accentGold}
            />
          </TouchableOpacity>

          {showCourseDropdown && (
            <View style={[styles.dropdownContainer, { backgroundColor: theme.background, borderColor: theme.cardBorder }]}>
              <ScrollView 
                nestedScrollEnabled={true} 
                style={styles.dropdownScroll}
                contentContainerStyle={styles.dropdownContent}
              >
                {COURSE_DATA.map((deptGroup) => (
                  <View key={deptGroup.department} style={styles.deptGroupContainer}>
                    <View style={styles.deptGroupHeader}>
                      <View style={[styles.deptColorDot, { backgroundColor: deptGroup.color }]} />
                      <Text style={[styles.deptGroupTitle, { color: theme.textSecondary }]}>{deptGroup.fullName}</Text>
                    </View>
                    <View style={[styles.courseOptionsContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                      {deptGroup.courses.map((c) => {
                        const isSelected = course === c.code;
                        return (
                          <TouchableOpacity
                            key={c.code}
                            style={[
                              styles.courseOptionRow,
                              { borderBottomColor: theme.cardBorder },
                              isSelected && { backgroundColor: isDarkMode ? "#1E293B" : "#F0F9FF" }
                            ]}
                            onPress={() => {
                              setCourse(c.code);
                              setSelectedDepartment(deptGroup.department as any);
                              setShowCourseDropdown(false);
                              setErrorMessage("");
                            }}
                          >
                            <Text style={[
                              styles.courseOptionText,
                              { color: theme.textPrimary },
                              isSelected && { color: theme.accentGold, fontWeight: "600" }
                            ]}>
                              {c.name}
                            </Text>
                            <Text style={[
                              styles.courseOptionCode,
                              { color: theme.textSecondary, backgroundColor: isDarkMode ? "#1E293B" : "#F1F5F9" },
                              isSelected && { color: "#FFFFFF", backgroundColor: theme.accentGold }
                            ]}>
                              {c.code}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <Text style={[styles.label, { color: theme.accentGold }]}>Department</Text>
          <View style={styles.deptChipsRow}>
            {DEPARTMENTS.map((dept) => {
              const isSelected = selectedDepartment === dept;
              return (
                <TouchableOpacity
                  key={dept}
                  disabled={true}
                  style={[
                    styles.deptChip,
                    { backgroundColor: theme.background, borderColor: theme.cardBorder },
                    isSelected && { backgroundColor: theme.accentGold, borderColor: theme.accentGold }
                  ]}
                >
                  <Text style={[
                    styles.deptChipText,
                    { color: theme.textSecondary },
                    isSelected && { color: "#FFFFFF", fontWeight: "700" }
                  ]}>
                    {dept}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.label, { color: theme.accentGold }]}>Student ID Number</Text>
          <View style={[styles.inputContainer, { borderColor: theme.cardBorder }]}>
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder="XX-XXXX-XXX (e.g. 23-1653-705)"
              placeholderTextColor={theme.textSecondary}
              value={idNumber}
              onChangeText={(v) => {
                setIdNumber(v);
                setErrorMessage("");
              }}
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
          </View>

          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: theme.accentGold }]}
            onPress={handleSetupSubmit}
            disabled={loading}
          >
            <Text style={[styles.submitButtonText, { color: isDarkMode ? "#090D16" : "#FFFFFF" }]}>
              {loading ? "Saving Details..." : "Complete Setup"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </AnimatedScreen>
  );
}
