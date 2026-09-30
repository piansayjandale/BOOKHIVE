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
import { useRouter, useLocalSearchParams } from "expo-router";
import AnimatedScreen from "../components/AnimatedScreen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../data/AuthContext";
import { updateStudentProfile, clearLocalCache } from "../data/store";
import { Ionicons } from "@expo/vector-icons";

const DEPARTMENTS = [
  { code: "CICT", name: "College of Information & Communications Technology" },
  { code: "COE", name: "College of Engineering" },
  { code: "CBMA", name: "College of Business Management & Accountancy" },
  { code: "CAS", name: "College of Arts & Sciences" },
  { code: "CED", name: "College of Education" },
  { code: "CHTM", name: "College of Hospitality & Tourism Management" },
  { code: "CCJE", name: "College of Criminal Justice Education" },
];

const DEPARTMENT_COURSES: Record<string, { code: string; name: string }[]> = {
  CICT: [
    { code: "BSIT", name: "BS Information Technology" },
    { code: "BSCS", name: "BS Computer Science" },
    { code: "BLIS", name: "Bachelor of Library & Information Science" },
    { code: "ACT", name: "Associate in Computer Technology" },
  ],
  COE: [
    { code: "BSCPE", name: "BS Computer Engineering" },
    { code: "BSEE", name: "BS Electrical Engineering" },
    { code: "BSECE", name: "BS Electronics Engineering" },
  ],
  CBMA: [
    { code: "BSA", name: "BS Accountancy" },
    { code: "BSBA", name: "BS Business Administration" },
    { code: "BSMA", name: "BS Management Accounting" },
    { code: "BSE", name: "BS Entrepreneurship" },
  ],
  CAS: [
    { code: "BACOMM", name: "BA Communication" },
    { code: "BAPsych", name: "BS Psychology" },
    { code: "BAPos", name: "BA Political Science" },
  ],
  CED: [
    { code: "BSED", name: "Bachelor of Secondary Education" },
    { code: "BEED", name: "Bachelor of Elementary Education" },
  ],
  CHTM: [
    { code: "BSHM", name: "BS Hospitality Management" },
    { code: "BSTM", name: "BS Tourism Management" },
  ],
  CCJE: [
    { code: "BSCrim", name: "BS Criminology" },
  ],
};

const YEAR_LEVELS = ["1ST", "2ND", "3RD", "4TH"];
const SECTIONS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F19",
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  topHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
    width: "100%",
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#121A2C",
    borderWidth: 1.5,
    borderColor: "#1E2A42",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  backButtonPlaceholder: {
    width: 42,
    height: 42,
  },
  card: {
    backgroundColor: "#121A2C",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#1E2A42",
    paddingHorizontal: 22,
    paddingVertical: 26,
    flexGrow: 1,
    justifyContent: "space-between",
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    color: "#E2E8F0",
    letterSpacing: 0.8,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  underlineInput: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    borderBottomWidth: 1.5,
    borderBottomColor: "#4B5563",
    paddingVertical: 6,
    paddingHorizontal: 0,
  },
  gridRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 16,
  },
  dropdownBox: {
    flex: 1,
    backgroundColor: "#1E283E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2D3852",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dropdownHeaderLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#E2E8F0",
    textAlign: "center",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  dropdownValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1.5,
    borderBottomColor: "#64748B",
    paddingBottom: 4,
  },
  dropdownValueText: {
    fontSize: 19,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  spacer: {
    flex: 1,
    minHeight: 50,
  },
  errorText: {
    color: "#EF4444",
    marginBottom: 12,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  doneButton: {
    backgroundColor: "#FFC800",
    height: 56,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFC800",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  doneButtonText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#000000",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "75%",
    backgroundColor: "#141D30",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#25334E",
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#222F46",
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  modalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: "#1A253C",
  },
  modalItemActive: {
    backgroundColor: "#223354",
    borderWidth: 1,
    borderColor: "#FFC800",
  },
  modalItemText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#CBD5E1",
  },
  modalItemTextActive: {
    color: "#FFC800",
    fontWeight: "800",
  },
  modalItemSub: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
});

export default function CompleteProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { user, updateUser, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const handleBackToLogin = async () => {
    try {
      await logout();
    } catch (err) {
      console.log("Error during back to login:", err);
    }
    router.replace("/login");
  };

  const [name, setName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("CICT");
  const [course, setCourse] = useState("BSIT");
  const [yearLevel, setYearLevel] = useState("4TH");
  const [section, setSection] = useState("H");

  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [activePicker, setActivePicker] = useState<"department" | "course" | "yearLevel" | "section" | null>(null);

  useEffect(() => {
    clearLocalCache();
  }, []);

  useEffect(() => {
    const passedEmail = params.email || user?.email || "";
    if (passedEmail) {
      setEmail(passedEmail);
    }
    if (user) {
      if (user.fullName && user.fullName !== "STI Student") {
        setName(user.fullName);
      }
      if (user.studentId && !user.studentId.startsWith("STI-") && !user.studentId.startsWith("MS-")) {
        setIdNumber(user.studentId);
      }
      if (user.department && DEPARTMENTS.some((d) => d.code === user.department)) {
        setDepartment(user.department);
      }
      if (user.course) {
        setCourse(user.course);
      }
      if (user.yearLevel) {
        setYearLevel(user.yearLevel);
      }
      if (user.section) {
        setSection(user.section);
      }
    }
  }, [user, params.email]);

  useEffect(() => {
    const backAction = () => {
      handleBackToLogin();
      return true;
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, []);

  const handleIdNumberChange = (raw: string) => {
    const digitsOnly = raw.replace(/[^0-9]/g, "");
    let formatted = "";
    if (digitsOnly.length > 0) {
      formatted += digitsOnly.substring(0, 2);
    }
    if (digitsOnly.length > 2) {
      formatted += "-" + digitsOnly.substring(2, 6);
    }
    if (digitsOnly.length > 6) {
      formatted += "-" + digitsOnly.substring(6, 9);
    }
    setIdNumber(formatted);
    setErrorMessage("");
  };

  const handleDepartmentSelect = (deptCode: string) => {
    setDepartment(deptCode);
    const available = DEPARTMENT_COURSES[deptCode];
    if (available && available.length > 0) {
      setCourse(available[0].code);
    }
    setActivePicker(null);
  };

  const handleDone = async () => {
    try {
      setErrorMessage("");
      const cleanName = name.trim();
      const cleanId = idNumber.trim();
      const cleanEmail = email.trim().toLowerCase();

      if (!cleanName) {
        setErrorMessage("Please enter your full name.");
        return;
      }

      const idRegex = /^\d{2}-\d{4}-\d{3}$/;
      if (!idRegex.test(cleanId)) {
        setErrorMessage("ID Number must be formatted as 23-1111-111.");
        return;
      }

      if (!cleanEmail) {
        setErrorMessage("University email is required.");
        return;
      }

      setLoading(true);

      const res = await updateStudentProfile({
        name: cleanName,
        studentId: cleanId,
        email: cleanEmail,
        department,
        course,
        yearLevel,
        yearlevel: `${yearLevel} Year`,
        section,
      });

      if (!res.success) {
        setErrorMessage(res.message || "Failed to update profile. Please try again.");
        setLoading(false);
        return;
      }

      const userJson = await AsyncStorage.getItem("CURRENT_USER");
      if (userJson) {
        const currentUser = JSON.parse(userJson);
        currentUser.fullName = cleanName;
        currentUser.studentId = cleanId;
        currentUser.email = cleanEmail;
        currentUser.department = department;
        currentUser.course = course;
        currentUser.yearLevel = yearLevel;
        currentUser.section = section;
        currentUser.isNewUser = false;
        await AsyncStorage.setItem("CURRENT_USER", JSON.stringify(currentUser));
      }

      updateUser({
        fullName: cleanName,
        studentId: cleanId,
        email: cleanEmail,
        department,
        course,
        yearLevel,
        section,
        isNewUser: false,
      });

      // Directly redirect to home screen as requested
      router.replace("/(tabs)");
    } catch (err) {
      console.log("Setup Error:", err);
      setErrorMessage("Something went wrong while saving details.");
    } finally {
      setLoading(false);
    }
  };

  const currentCourses = DEPARTMENT_COURSES[department] || DEPARTMENT_COURSES.CICT;

  return (
    <AnimatedScreen style={{ flex: 1 }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContainer,
            {
              paddingTop: Math.max(insets.top + 10, 28),
              paddingBottom: Math.max(insets.bottom + 10, 24),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* TOP HEADER ROW WITH BACK BUTTON */}
          <View style={styles.topHeaderRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackToLogin}
              activeOpacity={0.7}
              accessibilityLabel="Back to Login"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={22} color="#FFC800" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>BOOKHIVE</Text>

            <View style={styles.backButtonPlaceholder} />
          </View>

          <View style={styles.card}>
            <View>
              {/* NAME: */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>NAME:</Text>
                <TextInput
                  style={styles.underlineInput}
                  placeholder="Juan Dela Cruz"
                  placeholderTextColor="#475569"
                  value={name}
                  onChangeText={(v) => {
                    setName(v);
                    setErrorMessage("");
                  }}
                  autoCapitalize="words"
                />
              </View>

              {/* ID NO. */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>ID NO.</Text>
                <TextInput
                  style={styles.underlineInput}
                  placeholder="23-1111-111"
                  placeholderTextColor="#475569"
                  value={idNumber}
                  onChangeText={handleIdNumberChange}
                  keyboardType="numeric"
                  maxLength={11}
                  autoCapitalize="none"
                />
              </View>

              {/* UNIVERSITY EMAIL: */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>UNIVERSITY EMAIL:</Text>
                <TextInput
                  style={styles.underlineInput}
                  placeholder="student@wnu.sti.edu.ph"
                  placeholderTextColor="#475569"
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

              {/* 2x2 GRID OF DROPDOWNS */}
              <View style={styles.gridRow}>
                {/* DEPARTMENT */}
                <TouchableOpacity
                  style={styles.dropdownBox}
                  activeOpacity={0.8}
                  onPress={() => setActivePicker("department")}
                >
                  <Text style={styles.dropdownHeaderLabel}>DEPARTMENT</Text>
                  <View style={styles.dropdownValueRow}>
                    <Text style={styles.dropdownValueText}>{department}</Text>
                    <Ionicons name="chevron-down" size={18} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>

                {/* COURSE */}
                <TouchableOpacity
                  style={styles.dropdownBox}
                  activeOpacity={0.8}
                  onPress={() => setActivePicker("course")}
                >
                  <Text style={styles.dropdownHeaderLabel}>COURSE</Text>
                  <View style={styles.dropdownValueRow}>
                    <Text style={styles.dropdownValueText}>{course}</Text>
                    <Ionicons name="chevron-down" size={18} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.gridRow}>
                {/* YEAR LEVEL */}
                <TouchableOpacity
                  style={styles.dropdownBox}
                  activeOpacity={0.8}
                  onPress={() => setActivePicker("yearLevel")}
                >
                  <Text style={styles.dropdownHeaderLabel}>YEAR LEVEL</Text>
                  <View style={styles.dropdownValueRow}>
                    <Text style={styles.dropdownValueText}>{yearLevel}</Text>
                    <Ionicons name="chevron-down" size={18} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>

                {/* SECTION */}
                <TouchableOpacity
                  style={styles.dropdownBox}
                  activeOpacity={0.8}
                  onPress={() => setActivePicker("section")}
                >
                  <Text style={styles.dropdownHeaderLabel}>SECTION</Text>
                  <View style={styles.dropdownValueRow}>
                    <Text style={styles.dropdownValueText}>{section}</Text>
                    <Ionicons name="chevron-down" size={18} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* SPACER */}
            <View style={styles.spacer} />

            {/* Error Message */}
            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}

            {/* DONE BUTTON */}
            <TouchableOpacity
              style={styles.doneButton}
              activeOpacity={0.85}
              onPress={handleDone}
              disabled={loading}
            >
              <Text style={styles.doneButtonText}>
                {loading ? "SAVING..." : "DONE"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* SELECTION MODAL */}
        <Modal
          visible={activePicker !== null}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setActivePicker(null)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setActivePicker(null)}
          >
            <TouchableOpacity
              style={styles.modalContent}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {activePicker === "department" && "Select Department"}
                  {activePicker === "course" && "Select Course"}
                  {activePicker === "yearLevel" && "Select Year Level"}
                  {activePicker === "section" && "Select Section"}
                </Text>
                <TouchableOpacity onPress={() => setActivePicker(null)}>
                  <Ionicons name="close" size={22} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {activePicker === "department" &&
                  DEPARTMENTS.map((dept) => {
                    const isSelected = department === dept.code;
                    return (
                      <TouchableOpacity
                        key={dept.code}
                        style={[styles.modalItem, isSelected && styles.modalItemActive]}
                        onPress={() => handleDepartmentSelect(dept.code)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.modalItemText, isSelected && styles.modalItemTextActive]}>
                            {dept.code}
                          </Text>
                          <Text style={styles.modalItemSub}>{dept.name}</Text>
                        </View>
                        {isSelected && <Ionicons name="checkmark" size={18} color="#FFC800" />}
                      </TouchableOpacity>
                    );
                  })}

                {activePicker === "course" &&
                  currentCourses.map((c) => {
                    const isSelected = course === c.code;
                    return (
                      <TouchableOpacity
                        key={c.code}
                        style={[styles.modalItem, isSelected && styles.modalItemActive]}
                        onPress={() => {
                          setCourse(c.code);
                          setActivePicker(null);
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.modalItemText, isSelected && styles.modalItemTextActive]}>
                            {c.code}
                          </Text>
                          <Text style={styles.modalItemSub}>{c.name}</Text>
                        </View>
                        {isSelected && <Ionicons name="checkmark" size={18} color="#FFC800" />}
                      </TouchableOpacity>
                    );
                  })}

                {activePicker === "yearLevel" &&
                  YEAR_LEVELS.map((yr) => {
                    const isSelected = yearLevel === yr;
                    return (
                      <TouchableOpacity
                        key={yr}
                        style={[styles.modalItem, isSelected && styles.modalItemActive]}
                        onPress={() => {
                          setYearLevel(yr);
                          setActivePicker(null);
                        }}
                      >
                        <Text style={[styles.modalItemText, isSelected && styles.modalItemTextActive]}>
                          {yr} YEAR
                        </Text>
                        {isSelected && <Ionicons name="checkmark" size={18} color="#FFC800" />}
                      </TouchableOpacity>
                    );
                  })}

                {activePicker === "section" &&
                  SECTIONS.map((sec) => {
                    const isSelected = section === sec;
                    return (
                      <TouchableOpacity
                        key={sec}
                        style={[styles.modalItem, isSelected && styles.modalItemActive]}
                        onPress={() => {
                          setSection(sec);
                          setActivePicker(null);
                        }}
                      >
                        <Text style={[styles.modalItemText, isSelected && styles.modalItemTextActive]}>
                          SECTION {sec}
                        </Text>
                        {isSelected && <Ionicons name="checkmark" size={18} color="#FFC800" />}
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </AnimatedScreen>
  );
}
