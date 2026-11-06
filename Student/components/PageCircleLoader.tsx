import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  StyleProp,
  ViewStyle,
} from "react-native";
import { useThemeColors } from "../hooks/useThemeColors";

interface PageCircleLoaderProps {
  label?: string;
  size?: "small" | "large";
  color?: string;
  style?: StyleProp<ViewStyle>;
  inline?: boolean;
}

export default function PageCircleLoader({
  label = "Loading...",
  size = "large",
  color,
  style,
  inline = false,
}: PageCircleLoaderProps) {
  const { isDarkMode, theme } = useThemeColors();
  const spinAnim = useRef(new Animated.Value(0)).current;

  const activeColor =
    color || (isDarkMode ? theme.accentGold || "#FFD600" : "#0274BB");

  useEffect(() => {
    // 60fps continuous native rotation
    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 850,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    spinLoop.start();

    return () => {
      spinLoop.stop();
    };
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const spinnerDimension = size === "small" ? 28 : 46;
  const strokeWidth = size === "small" ? 2.5 : 3.5;

  return (
    <View
      style={[
        inline ? styles.inlineContainer : styles.fullContainer,
        { backgroundColor: inline ? "transparent" : theme.background },
        style,
      ]}
    >
      <View style={[styles.spinnerCenterWrapper, { width: spinnerDimension, height: spinnerDimension }]}>
        {/* Circular background track */}
        <View
          style={[
            styles.trackCircle,
            {
              width: spinnerDimension,
              height: spinnerDimension,
              borderRadius: spinnerDimension / 2,
              borderWidth: strokeWidth,
              borderColor: isDarkMode
                ? "rgba(255, 255, 255, 0.12)"
                : "rgba(2, 116, 187, 0.12)",
            },
          ]}
        />

        {/* Rotating Circular Arc Spinner - Unified design */}
        <Animated.View
          style={[
            styles.arcSpinner,
            {
              width: spinnerDimension,
              height: spinnerDimension,
              borderRadius: spinnerDimension / 2,
              borderWidth: strokeWidth,
              borderColor: "transparent",
              borderTopColor: activeColor,
              borderRightColor: activeColor,
              transform: [{ rotate: spin }],
            },
          ]}
        />
      </View>

      {label ? (
        <Text
          style={[
            styles.labelText,
            {
              color: isDarkMode ? theme.textSecondary || "#94A3B8" : "#64748B",
            },
          ]}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    minHeight: 180,
  },
  inlineContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  spinnerCenterWrapper: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  trackCircle: {
    position: "absolute",
  },
  arcSpinner: {
    position: "absolute",
  },
  labelText: {
    marginTop: 14,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
});
