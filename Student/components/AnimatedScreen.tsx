import React, { useEffect, useRef } from "react";
import { View, Animated, StyleProp, ViewStyle, Easing } from "react-native";
import { useThemeColors } from "../hooks/useThemeColors";

interface AnimatedScreenProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
}

export default function AnimatedScreen({ children, style, delay = 0 }: AnimatedScreenProps) {
  const { theme } = useThemeColors();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;
  const scaleAnim = useRef(new Animated.Value(0.99)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 240,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 240,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 240,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay]);

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: theme.background,
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          flex: 1,
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}
