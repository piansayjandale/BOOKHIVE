import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimatedScreen from "../components/AnimatedScreen";

import { Feather } from '@expo/vector-icons';
import { useRouter } from "expo-router";
import {
  getStudentProfile,
  updateStudentProfile,
  COURSE_DATA,
  getCourseLabel,
} from "../data/store";
import { useThemeColors } from "../hooks/useThemeColors";

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = getStudentProfile();
  const { theme, isDarkMode } = useThemeColors();
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(
    profile.email
  );
  const [phone, setPhone] = useState(
    profile.phone
  );
  const [dateOfBirth, setDateOfBirth] = useState(
    profile.dateOfBirth
  );
  const [address, setAddress] = useState(
    profile.address
  );
  const [course, setCourse] = useState(
    profile.course
  );
  const [department, setDepartment] = useState(
    profile.department
  );
  const [yearlevel, setYearlevel] = useState(
    profile.yearlevel
  );
  const [avatar, setAvatar] = useState(profile.avatar);

  // Auto-select department whenever course changes
  React.useEffect(() => {
    if (course) {
      const matchingDept = COURSE_DATA.find((group) => 
        group.courses.some((c) => c.code.toLowerCase() === course.toLowerCase())
      );
      if (matchingDept) {
        setDepartment(matchingDept.department);
      }
    }
  }, [course]);

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Required", "Please allow gallery access to upload a profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const base64Uri = `data:image/jpeg;base64,${asset.base64}`;
      setAvatar(base64Uri);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Name is required");
      return;
    }

    if (!email.trim()) {
      Alert.alert("Error", "Email is required");
      return;
    }

    if (!phone.trim()) {
      Alert.alert("Error", "Phone is required");
      return;
    }

    const res = await updateStudentProfile({
      name,
      email,
      phone,
      dateOfBirth,
      address,
      course,
      department,
      yearlevel,
      avatar,
    });

    if (res.success) {
      Alert.alert(
        "Success",
        "Profile updated successfully",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      Alert.alert("Error", res.message || "Failed to update profile");
    }
  };

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: 16 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder, borderBottomWidth: 1 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather
            name="arrow-left"
            size={22}
            color={theme.accentGold}
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          EDIT PROFILE
        </Text>

        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: 40,
        }}
      >
        {/* AVATAR SELECTOR */}
        <View style={styles.avatarContainer}>
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} style={styles.avatarWrapper}>
            <Image source={{ uri: avatar }} style={[styles.avatar, { borderColor: theme.accentGold }]} />
            <View style={[styles.cameraIconBadge, { backgroundColor: theme.accentGold, borderColor: theme.cardBg }]}>
              <Feather name="camera" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.avatarText, { color: theme.textSecondary }]}>Tap to change profile picture</Text>
        </View>

        {/* PERSONAL INFORMATION */}
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
          Personal Information
        </Text>

        {/* NAME */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.accentGold }]}>
            Full Name
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.cardBg, color: theme.textPrimary, borderColor: theme.cardBorder }]}
            placeholder="Enter your full name"
            value={name}
            onChangeText={setName}
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        {/* EMAIL */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.accentGold }]}>
            Email Address
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.cardBg, color: theme.textPrimary, borderColor: theme.cardBorder }]}
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        {/* PHONE */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.accentGold }]}>
            Phone Number
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.cardBg, color: theme.textPrimary, borderColor: theme.cardBorder }]}
            placeholder="Enter your phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        {/* DATE OF BIRTH */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.accentGold }]}>
            Date of Birth
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.cardBg, color: theme.textPrimary, borderColor: theme.cardBorder }]}
            placeholder="MM/DD/YYYY"
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        {/* ADDRESS */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.accentGold }]}>
            Address
          </Text>
          <TextInput
            style={[styles.input, { height: 80, backgroundColor: theme.cardBg, color: theme.textPrimary, borderColor: theme.cardBorder }]}
            placeholder="Enter your address"
            value={address}
            onChangeText={setAddress}
            multiline
            numberOfLines={3}
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        {/* ACADEMIC INFORMATION */}
        <Text style={[styles.sectionTitle, { marginTop: 28, color: theme.textPrimary }]}>
          Academic Information
        </Text>

        {/* COURSE */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.accentGold }]}>
            Course
          </Text>
          <TouchableOpacity
            style={[
              styles.input,
              { 
                flexDirection: "row", 
                justifyContent: "space-between", 
                alignItems: "center",
                paddingVertical: 12,
                backgroundColor: theme.cardBg,
                borderColor: theme.cardBorder
              }
            ]}
            activeOpacity={0.8}
            onPress={() => setShowCourseDropdown(!showCourseDropdown)}
          >
            <Text style={{ 
              fontSize: 14, 
              color: course ? theme.textPrimary : theme.textSecondary,
              fontWeight: course ? "600" : "normal"
            }}>
              {course ? getCourseLabel(course) : "Select your course"}
            </Text>
            <Feather
              name={showCourseDropdown ? "chevron-up" : "chevron-down"}
              size={18}
              color={theme.textSecondary}
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
                              setDepartment(deptGroup.department);
                              setShowCourseDropdown(false);
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
        </View>

        {/* DEPARTMENT */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.accentGold }]}>
            Department
          </Text>
          <View style={styles.deptChipsRow}>
            {["CICT", "COE", "CBMA", "CAS", "CED", "CHTM", "CCJE"].map((dept) => {
              const isSelected = department === dept;
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
        </View>

        {/* YEAR LEVEL */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.accentGold }]}>
            Year Level
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.cardBg, color: theme.textPrimary, borderColor: theme.cardBorder }]}
            placeholder="Enter your year level"
            value={yearlevel}
            onChangeText={setYearlevel}
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        {/* SAVE BUTTON */}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.accentGold }]}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>
            Save Changes
          </Text>
        </TouchableOpacity>

        {/* CANCEL BUTTON */}
        <TouchableOpacity
          style={[styles.cancelButton, { backgroundColor: isDarkMode ? "#1E293B" : "#E5E7EB" }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.cancelButtonText, { color: theme.textPrimary }]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16,
  },

  formGroup: {
    marginBottom: 20,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    letterSpacing: 0.3,
  },

  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    borderWidth: 1,
  },

  saveButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 10,
  },

  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  cancelButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },

  cancelButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },

  deptChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
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
  dropdownContainer: {
    borderRadius: 16,
    marginTop: 8,
    maxHeight: 280,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
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
  avatarContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  avatarWrapper: {
    position: "relative",
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
  },
  cameraIconBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  avatarText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
  },
});
