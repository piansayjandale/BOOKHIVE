import React, { useMemo, useState } from "react";
import { View, Text, Image, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useThemeColors } from "../hooks/useThemeColors";
import { getUniqueBookCover, isCustomUploadedCover } from "../data/bookCovers";

export interface BookCoverImageProps {
  uri?: string | null;
  title: string;
  author: string;
  category?: string;
  department?: string;
  style?: StyleProp<ViewStyle>;
  iconSize?: number;
  showText?: boolean;
  isHero?: boolean;
}

/**
 * Palette mapping based on category/department to give each genre an authentic physical cover feel
 */
function getGenreTheme(category?: string, title?: string, isDarkMode = false) {
  const norm = ((category || "") + " " + (title || "")).toLowerCase();

  if (norm.includes("fiction") || norm.includes("novel") || norm.includes("literature") || norm.includes("story")) {
    return {
      bg: isDarkMode ? "#0F172A" : "#1E293B",
      accent: "#FCD34D", // Gold
      authorColor: "#FEF08A",
      ribbon: "#EF4444", // Crimson ribbon
      tag: "FICTION",
      stamp: "BOOKHIVE FICTION",
    };
  }
  if (norm.includes("filipiniana") || norm.includes("history") || norm.includes("philippine") || norm.includes("adarna")) {
    return {
      bg: isDarkMode ? "#451A03" : "#7C2D12",
      accent: "#FBBF24", // Warm sun gold
      authorColor: "#FEF08A",
      ribbon: "#2563EB", // Philippine Blue
      tag: "FILIPINIANA",
      stamp: "HERITAGE EDITION",
    };
  }
  if (norm.includes("special") || norm.includes("archive") || norm.includes("rare") || norm.includes("gaming") || norm.includes("brichoox")) {
    return {
      bg: isDarkMode ? "#3B0764" : "#581C87",
      accent: "#F0ABFC", // Amethyst / Neon Violet
      authorColor: "#F5D0FE",
      ribbon: "#EC4899",
      tag: "SPECIAL",
      stamp: "SPECIAL COLLECTION",
    };
  }
  if (norm.includes("reference") || norm.includes("encyclopedia") || norm.includes("dictionary") || norm.includes("academic") || norm.includes("study")) {
    return {
      bg: isDarkMode ? "#0C2340" : "#1E3A8A",
      accent: "#38BDF8", // Cyan / Academic Sky
      authorColor: "#E0F2FE",
      ribbon: "#F59E0B",
      tag: "REFERENCE",
      stamp: "ACADEMIC REFERENCE",
    };
  }
  if (norm.includes("account") || norm.includes("finance") || norm.includes("business") || norm.includes("economic")) {
    return {
      bg: isDarkMode ? "#064E3B" : "#065F46",
      accent: "#6EE7B7", // Mint emerald
      authorColor: "#D1FAE5",
      ribbon: "#10B981",
      tag: "BUSINESS",
      stamp: "BUSINESS & FINANCE",
    };
  }
  if (norm.includes("tech") || norm.includes("computer") || norm.includes("code") || norm.includes("program") || norm.includes("matrix") || norm.includes("dale")) {
    return {
      bg: isDarkMode ? "#091E2F" : "#0F2942",
      accent: "#22D3EE", // Electric Cyan
      authorColor: "#CFFAFE",
      ribbon: "#6366F1",
      tag: "TECHNOLOGY",
      stamp: "DIGITAL EDITION",
    };
  }

  // Default Circulation
  return {
    bg: isDarkMode ? "#0E1E38" : "#1E3050",
    accent: "#FCD34D", // Classic library gold
    authorColor: "#FEF08A",
    ribbon: "#EAB308",
    tag: "CIRCULATION",
    stamp: "BOOKHIVE EDITIONS",
  };
}

/**
 * Cleans author string for clean display on a physical book jacket
 */
function cleanAuthorName(authorStr?: string): string {
  if (!authorStr || !authorStr.trim()) return "Unknown Author";
  let cleaned = authorStr
    .replace(/\s*\([^)]*Goodreads[^)]*\)/gi, "")
    .replace(/\s*\([^)]*Author[^)]*\)/gi, "")
    .replace(/\s*\([^)]*Illustrator[^)]*\)/gi, "")
    .replace(/\s*\([^)]*Editor[^)]*\)/gi, "")
    .replace(/\s*\([^)]*Translator[^)]*\)/gi, "")
    .trim();

  // If multiple authors, take primary for front jacket
  if (cleaned.includes(",")) {
    cleaned = cleaned.split(",")[0].trim();
  }
  if (cleaned.includes(";")) {
    cleaned = cleaned.split(";")[0].trim();
  }
  if (!cleaned) return "Unknown Author";

  if (cleaned.toLowerCase().startsWith("by ")) {
    return cleaned;
  }
  return `by ${cleaned}`;
}

/**
 * Actual Physical Book Cover Component
 * Renders an authentic hardcover book jacket featuring:
 * - 3D spine seam & crease hinge
 * - Category / Department header chip
 * - Actual Book Title in bold, high-contrast, perfectly-scaled book typography
 * - Decorative gold / accent divider motif
 * - Actual Author Name with high-contrast text shadow
 * - Bookmark ribbon
 * - Publisher / Library edition imprint
 */
export function BookCoverImage({
  uri,
  title,
  author,
  category,
  department,
  style,
  isHero = false,
}: BookCoverImageProps) {
  const [customUriFailed, setCustomUriFailed] = useState(false);
  const [poolUriFailed, setPoolUriFailed] = useState(false);
  const { isDarkMode } = useThemeColors();

  const genreTheme = useMemo(
    () => getGenreTheme(category || department, title, isDarkMode),
    [category, department, title, isDarkMode]
  );

  const fallbackPoolCover = useMemo(
    () =>
      getUniqueBookCover({
        title,
        author,
        category: category || department,
      }),
    [title, author, category, department]
  );

  const resolvedCoverUri = useMemo(() => {
    if (
      uri &&
      !customUriFailed &&
      typeof uri === "string" &&
      uri.trim().length > 5 &&
      !uri.includes("null") &&
      !uri.includes("undefined")
    ) {
      return uri.trim();
    }
    return fallbackPoolCover;
  }, [uri, customUriFailed, fallbackPoolCover]);

  const isCustomUpload = useMemo(
    () => !customUriFailed && isCustomUploadedCover(resolvedCoverUri),
    [customUriFailed, resolvedCoverUri]
  );

  const displayTitle = (title || "Untitled Book").trim();
  const displayAuthor = cleanAuthorName(author);
  const categoryTag = (category || department || genreTheme.tag).toUpperCase().trim();

  // Dynamic typography sizing based on title length and display context
  const titleLength = displayTitle.length;
  let titleFontSize = isHero ? 15 : 13;
  let titleLineHeight = isHero ? 18 : 15.5;

  if (titleLength <= 10) {
    titleFontSize = isHero ? 16 : 14;
    titleLineHeight = isHero ? 19 : 16.5;
  } else if (titleLength <= 20) {
    titleFontSize = isHero ? 13 : 11.5;
    titleLineHeight = isHero ? 16 : 14;
  } else if (titleLength <= 35) {
    titleFontSize = isHero ? 11 : 9.5;
    titleLineHeight = isHero ? 13.5 : 12;
  } else {
    titleFontSize = isHero ? 9.5 : 8.5;
    titleLineHeight = isHero ? 12 : 10.5;
  }

  const authorFontSize = isHero ? 9.5 : 8;

  return (
    <View
      style={[
        styles.container,
        {
          borderRadius: isHero ? 12 : 10,
          backgroundColor: genreTheme.bg,
        },
        style,
      ]}
    >
      {/* 1. Underlying aesthetic texture / photography layer */}
      {resolvedCoverUri && !poolUriFailed ? (
        <Image
          source={{ uri: resolvedCoverUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => {
            if (!customUriFailed && uri && resolvedCoverUri === uri.trim()) {
              setCustomUriFailed(true);
            } else {
              setPoolUriFailed(true);
            }
          }}
        />
      ) : null}

      {/* 2. Rich atmospheric darkening scrim (only for pool background covers, NOT custom uploaded cover photos) */}
      {!isCustomUpload && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor:
                resolvedCoverUri && !poolUriFailed
                  ? "rgba(10, 18, 36, 0.62)"
                  : genreTheme.bg,
            },
          ]}
        />
      )}

      {/* 3. Embossed inner frame border (Gilded hardcover jacket effect) */}
      <View
        style={[
          styles.innerFrame,
          {
            top: isHero ? 7 : 5,
            bottom: isHero ? 7 : 5,
            left: isHero ? 13 : 9,
            right: isHero ? 7 : 5,
            borderColor: isCustomUpload ? "rgba(255, 255, 255, 0.16)" : "rgba(255, 255, 255, 0.22)",
          },
        ]}
      />

      {/* 4. Realistic 3D Hardcover Spine Seam (Left Edge) */}
      <View
        style={[
          styles.spineSeam,
          {
            width: isHero ? 6.5 : 5,
            backgroundColor: "rgba(0, 0, 0, 0.58)",
          },
        ]}
      />
      {/* 5. Spine Hinge Highlight / Reflection */}
      <View
        style={[
          styles.spineHinge,
          {
            left: isHero ? 6.5 : 5,
            width: isHero ? 2 : 1.5,
            backgroundColor: "rgba(255, 255, 255, 0.32)",
          },
        ]}
      />

      {/* 6. Decorative Top-Right Bookmark Ribbon */}
      {!isCustomUpload && (
        <View
          style={[
            styles.bookmarkRibbon,
            {
              right: isHero ? 9 : 7,
              width: isHero ? 8 : 6.5,
              height: isHero ? 16 : 13,
              backgroundColor: genreTheme.ribbon,
            },
          ]}
        />
      )}

      {/* 7. Actual Book Cover Content Layout (shown on generated covers; custom uploaded photos display the actual photo clearly) */}
      {!isCustomUpload && (
        <View
          style={[
            styles.contentWrapper,
            {
              paddingLeft: isHero ? 15 : 11,
              paddingRight: isHero ? 10 : 7,
              paddingTop: isHero ? 9 : 6,
              paddingBottom: isHero ? 8 : 5,
            },
          ]}
        >
          {/* Top: Category Tag Pill */}
          <View
            style={[
              styles.categoryBadge,
              {
                backgroundColor: "rgba(0, 0, 0, 0.52)",
                borderColor: "rgba(255, 255, 255, 0.28)",
              },
            ]}
          >
            <Text
              style={[
                styles.categoryBadgeText,
                {
                  fontSize: isHero ? 7 : 6,
                  color: genreTheme.accent,
                },
              ]}
              numberOfLines={1}
            >
              {categoryTag}
            </Text>
          </View>

          {/* Center: The Book's Actual Title, Decorative Divider & Author */}
          <View style={styles.centerSection}>
            <Text
              style={[
                styles.titleText,
                {
                  fontSize: titleFontSize,
                  lineHeight: titleLineHeight,
                },
              ]}
              numberOfLines={isHero ? 4 : 3}
            >
              {displayTitle}
            </Text>

            {/* Decorative Gold Accent Divider */}
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: genreTheme.accent }]} />
              <View
                style={[
                  styles.dividerDiamond,
                  {
                    backgroundColor: genreTheme.accent,
                    width: isHero ? 4.5 : 3.5,
                    height: isHero ? 4.5 : 3.5,
                  },
                ]}
              />
              <View style={[styles.dividerLine, { backgroundColor: genreTheme.accent }]} />
            </View>

            {/* The Book's Actual Author */}
            <Text
              style={[
                styles.authorText,
                {
                  fontSize: authorFontSize,
                  color: genreTheme.authorColor,
                },
              ]}
              numberOfLines={2}
            >
              {displayAuthor}
            </Text>
          </View>

          {/* Bottom: Library / Edition Stamp */}
          <View style={styles.footerSection}>
            <Text
              style={[
                styles.footerText,
                {
                  fontSize: isHero ? 6 : 5,
                },
              ]}
              numberOfLines={1}
            >
              {genreTheme.stamp}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    position: "relative",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  innerFrame: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 4,
    pointerEvents: "none",
  },
  spineSeam: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
  },
  spineHinge: {
    position: "absolute",
    top: 0,
    bottom: 0,
  },
  bookmarkRibbon: {
    position: "absolute",
    top: 0,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    elevation: 2,
    zIndex: 2,
  },
  contentWrapper: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 1,
  },
  categoryBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
    borderWidth: 0.5,
    maxWidth: "88%",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryBadgeText: {
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  centerSection: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: 2,
  },
  titleText: {
    fontWeight: "900",
    letterSpacing: 0.3,
    color: "#FFFFFF",
    textAlign: "center",
    textTransform: "uppercase",
    textShadowColor: "rgba(0, 0, 0, 0.95)",
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
    width: "100%",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "60%",
    marginVertical: 3,
  },
  dividerLine: {
    flex: 1,
    height: 0.8,
    opacity: 0.7,
  },
  dividerDiamond: {
    marginHorizontal: 3,
    transform: [{ rotate: "45deg" }],
  },
  authorText: {
    fontWeight: "700",
    letterSpacing: 0.2,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    width: "100%",
  },
  footerSection: {
    alignItems: "center",
    justifyContent: "center",
  },
  footerText: {
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "rgba(255, 255, 255, 0.65)",
    textTransform: "uppercase",
  },
});

export default BookCoverImage;
