import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  BackHandler,
  Image,
  Animated,
  ScrollView,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../hooks/useThemeColors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function IntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, toggleTheme } = useThemeColors();

  // Entrance Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;


  useEffect(() => {
    const backAction = () => {
      BackHandler.exitApp();
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    // Run entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      backHandler.remove();
    };
  }, [fadeAnim, slideAnim]);

  const features = [
    {
      img: require("../assets/sti-elms/icon-modules.png"),
      title: "AI Catalog Discovery",
      desc: "Instant book queries using natural language and semantic course classification across thousands of volumes.",
      badge: "AI Powered",
    },
    {
      img: require("../assets/sti-elms/icon-assessments.png"),
      title: "Fast Loans & Queues",
      desc: "Reserve in-demand textbooks in advance, monitor live queue position, and track automated due dates.",
      badge: "One-Click",
    },
    {
      img: require("../assets/sti-elms/icon-attendance.png"),
      title: "Digital QR Credentials",
      desc: "Contactless desk checkouts with personalized student QR cards.",
      badge: "Contactless",
    },
    {
      img: require("../assets/sti-elms/icon-collaborate.png"),
      title: "Live Circulation Vitals",
      desc: "High-visibility monitoring for library personnel featuring live transaction logs and inventory sync.",
      badge: "Real-Time",
    },
  ];

  const stats = [
    { value: "10,000+", label: "Volumes", icon: "book-outline" as const },
    { value: "Real-Time", label: "Speed", icon: "flash-outline" as const },
    { value: "AI-Powered", label: "Search", icon: "sparkles-outline" as const },
    { value: "QR Enabled", label: "Checkouts", icon: "qr-code-outline" as const },
  ];

  const handleSignIn = () => {
    router.replace("/login");
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: "#030A14" },
      ]}
    >
      {/* =========================================================================
          TOP NAVBAR
         ========================================================================= */}
      <View
        style={[
          styles.navbar,
          {
            paddingTop: insets.top + 6,
            backgroundColor: "#0B1528",
            borderBottomColor: "#17263F",
          },
        ]}
      >
        {/* Left: Brand with STI & BookHive Logos */}
        <View style={styles.brandRow}>
          <View style={styles.logoBadgeSTI}>
            <Image
              source={require("../assets/sti-logo.png")}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>
          <View
            style={[
              styles.logoBadgeBookHive,
              {
                backgroundColor: isDarkMode ? "#13233D" : "#FFFFFF",
                borderColor: isDarkMode ? "#223A61" : "#E2E8F0",
              },
            ]}
          >
            <Image
              source={require("../assets/logo.png")}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>
          <Text
            style={[
              styles.brandName,
              { color: "#FFFFFF" },
            ]}
          >
            BookHive
          </Text>
        </View>

        {/* Right: FAQ Link + Theme Toggle + Sign In Pill */}
        <View style={styles.navRight}>
          <TouchableOpacity
            style={styles.faqLink}
            onPress={handleSignIn}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.faqLinkText,
                { color: isDarkMode ? "#94A3B8" : "#475569" },
              ]}
            >
              FAQ
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.themeToggleBtn,
              {
                backgroundColor: isDarkMode ? "#13233D" : "#F1F5F9",
                borderColor: isDarkMode ? "#223A61" : "#CBD5E1",
              },
            ]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isDarkMode ? "sunny" : "moon"}
              size={15}
              color={isDarkMode ? "#FACC15" : "#0F172A"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navSignInBtn}
            onPress={handleSignIn}
            activeOpacity={0.8}
          >
            <Ionicons name="log-in-outline" size={13} color="#FFFFFF" />
            <Text style={styles.navSignInText}>Log In</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* =========================================================================
          SCROLLABLE CONTENT
         ========================================================================= */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* =====================================================================
              SECTION 1: HERO (STI Campus Background - VISIBLE & VIBRANT)
             ===================================================================== */}
          <View style={styles.heroSection}>
            {/* Campus Background Photo */}
            <Image
              source={require("../assets/sti-campus-building.jpg")}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            {/* Soft, translucent gradient overlay so the building architecture is clearly visible */}
            <View
              style={[
                styles.heroOverlay,
                {
                  backgroundColor: isDarkMode
                    ? "rgba(0, 20, 40, 0.65)"
                    : "rgba(0, 20, 40, 0.45)",
                },
              ]}
            />

            <View style={styles.heroContent}>
              {/* Kicker Pill: "Open a Book, Unlock your World" */}
              <View style={styles.kickerPill}>
                <Ionicons name="book" size={12} color="#FFF200" />
                <Text style={styles.kickerText}>
                  Open a Book, Unlock your World
                </Text>
              </View>

              {/* BIG LETTERS: "Welcome to BookHive" */}
              <Text style={styles.heroBigTitle}>
                Welcome to{" "}
                <Text style={styles.heroYellowTitle}>BookHive</Text>
              </Text>

              {/* small letters: "An AI Powered Search With Descriptive Analytics..." */}
              <Text style={styles.heroSubTitle}>
                An AI Powered Search With Descriptive Analytics for STI West
                Negros University Library
              </Text>

              {/* Short Description */}
              <Text style={styles.heroLead}>
                Welcome to{" "}
                <Text style={{ fontWeight: "800", color: "#FFF200" }}>
                  BookHive
                </Text>
                , the smart digital ecosystem of STI West Negros University
                Library. Delivering AI-assisted catalog search, instant
                reservations, digital QR credentials, and real-time circulation
                intelligence.
              </Text>

              {/* Sign In CTA Button */}
              <TouchableOpacity
                style={styles.heroCtaBtn}
                onPress={handleSignIn}
                activeOpacity={0.85}
              >
                <Ionicons name="log-in" size={16} color="#001B33" />
                <Text style={styles.heroCtaText}>Sign In to BookHive</Text>
                <Ionicons name="arrow-forward" size={16} color="#001B33" />
              </TouchableOpacity>

              {/* Campus Building Showcase Card */}
              <View style={styles.campusCardWrapper}>
                <Image
                  source={require("../assets/sti-campus-building.jpg")}
                  style={styles.campusCardImg}
                  resizeMode="cover"
                />
              </View>
            </View>
          </View>

          {/* =====================================================================
              SECTION 2: 4 FEATURES (Modules, Assessments, Attendance, Collaborate)
             ===================================================================== */}
          <View
            style={[
              styles.featuresSection,
              { backgroundColor: isDarkMode ? "#030A14" : "#FFFFFF" },
            ]}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionBadge}>
                <Ionicons name="sparkles" size={11} color="#0072CE" />
                <Text style={styles.sectionBadgeText}>
                  SMART LIBRARY CAPABILITIES
                </Text>
              </View>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDarkMode ? "#FFFFFF" : "#0F172A" },
                ]}
              >
                Designed for STIers Academic Excellence
              </Text>
            </View>

            <View style={styles.featureGrid}>
              {features.map((feat, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.featureCard,
                    {
                      backgroundColor: isDarkMode ? "#0B1528" : "#FFFFFF",
                      borderColor: isDarkMode ? "#17263F" : "#E2E8F0",
                      shadowColor: isDarkMode ? "#000" : "#64748B",
                    },
                  ]}
                >
                  <View style={styles.featureIconBox}>
                    <Image
                      source={feat.img}
                      style={styles.featureIconImg}
                      resizeMode="contain"
                    />
                  </View>

                  <View style={styles.cardBadge}>
                    <Text style={styles.cardBadgeText}>{feat.badge}</Text>
                  </View>

                  <Text
                    style={[
                      styles.cardTitle,
                      { color: isDarkMode ? "#FFFFFF" : "#0F172A" },
                    ]}
                  >
                    {feat.title}
                  </Text>
                  <Text
                    style={[
                      styles.cardDesc,
                      { color: isDarkMode ? "#94A3B8" : "#64748B" },
                    ]}
                  >
                    {feat.desc}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* =====================================================================
              SECTION 3: CASE STUDY BANNER (Dark Navy with Card & learn more)
             ===================================================================== */}
          <View style={styles.caseStudySection}>
            <View style={styles.caseStudyCardWrapper}>
              <Image
                source={require("../assets/sti-elms/case-study-card.png")}
                style={styles.caseStudyImg}
                resizeMode="cover"
              />
            </View>

            <View style={styles.caseStudyContent}>
              <Text style={styles.caseStudyKicker}>
                STI WEST NEGROS UNIVERSITY • LIBRARY PLATFORM
              </Text>
              <Text style={styles.caseStudyText}>
                For STI West Negros University, BookHive&apos;s blended library
                ecosystem delivers AI-assisted catalog search, instant
                reservations, digital QR credentials, and real-time circulation
                intelligence — making academic resources effective and
                accessible anytime, anywhere.
              </Text>

              <TouchableOpacity
                style={styles.learnMoreBtn}
                onPress={handleSignIn}
                activeOpacity={0.8}
              >
                <Text style={styles.learnMoreText}>LEARN MORE</Text>
                <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* =====================================================================
              SECTION 4: STATS SECTION (Big Numbers with Background)
             ===================================================================== */}
          <View style={styles.statsSection}>
            <Image
              source={require("../assets/sti-elms/stats-bg.png")}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            <View style={styles.statsOverlay} />

            <View style={styles.statsRow}>
              {stats.map((s, idx) => (
                <View key={idx} style={styles.statCol}>
                  <Text style={styles.statValueText}>{s.value}</Text>
                  <View style={styles.statLabelRow}>
                    <Ionicons name={s.icon} size={11} color="#FFF200" />
                    <Text style={styles.statLabelText}>{s.label}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* =====================================================================
              SECTION 5: FOOTER
             ===================================================================== */}
          <View style={styles.footerSection}>
            <Text style={styles.footerText}>
              &copy; 2026 STI West Negros University • BookHive LMS
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // NAVBAR
  navbar: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 20,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoBadgeSTI: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FFF200",
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  logoBadgeBookHive: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImg: {
    width: "100%",
    height: "100%",
  },
  brandName: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  navRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  faqLink: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  faqLinkText: {
    fontSize: 12,
    fontWeight: "700",
  },
  themeToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  navSignInBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#0072CE",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  navSignInText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  // HERO SECTION
  heroSection: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 28,
    position: "relative",
    overflow: "hidden",
  },
  heroOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 20, 40, 0.55)",
  },
  heroContent: {
    zIndex: 10,
  },
  kickerPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 10,
  },
  kickerText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  heroBigTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  heroYellowTitle: {
    color: "#FFF200",
  },
  heroSubTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#FDE047",
    marginTop: 6,
    lineHeight: 18,
  },
  heroLead: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.92)",
    marginTop: 8,
    lineHeight: 17,
  },
  heroCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FFF200",
    borderWidth: 2,
    borderColor: "#FCD34D",
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  heroCtaText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#001B33",
  },
  campusCardWrapper: {
    marginTop: 18,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.35)",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  campusCardImg: {
    width: "100%",
    height: 180,
  },

  // FEATURES SECTION
  featuresSection: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  sectionHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  sectionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0, 114, 206, 0.08)",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 114, 206, 0.2)",
    marginBottom: 6,
  },
  sectionBadgeText: {
    fontSize: 9.5,
    fontWeight: "900",
    color: "#0072CE",
    letterSpacing: 0.8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  featureCard: {
    width: (SCREEN_WIDTH - 42) / 2,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  featureIconBox: {
    width: 60,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  featureIconImg: {
    width: "100%",
    height: "100%",
  },
  cardBadge: {
    backgroundColor: "rgba(0, 114, 206, 0.08)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0, 114, 206, 0.18)",
    marginBottom: 6,
  },
  cardBadgeText: {
    fontSize: 8.5,
    fontWeight: "900",
    color: "#0072CE",
  },
  cardTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: "center",
  },

  // CASE STUDY SECTION
  caseStudySection: {
    backgroundColor: "#071932",
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  caseStudyCardWrapper: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    marginBottom: 14,
  },
  caseStudyImg: {
    width: "100%",
    height: 160,
  },
  caseStudyContent: {
    alignItems: "flex-start",
  },
  caseStudyKicker: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFF200",
    letterSpacing: 1,
    marginBottom: 6,
  },
  caseStudyText: {
    fontSize: 12.5,
    lineHeight: 18,
    color: "#E2E8F0",
  },
  learnMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  learnMoreText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  // STATS SECTION
  statsSection: {
    position: "relative",
    paddingVertical: 24,
    paddingHorizontal: 14,
    overflow: "hidden",
  },
  statsOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(6, 24, 47, 0.90)",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statCol: {
    alignItems: "center",
    flex: 1,
  },
  statValueText: {
    fontSize: 18,
    fontWeight: "300",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  statLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  statLabelText: {
    fontSize: 9.5,
    fontWeight: "600",
    color: "#94A3B8",
  },

  // FOOTER
  footerSection: {
    backgroundColor: "#030A14",
    paddingVertical: 14,
    alignItems: "center",
  },
  footerText: {
    fontSize: 10,
    color: "#64748B",
    textAlign: "center",
  },
});
