import React from "react";
import { View, StyleProp, ViewStyle } from "react-native";
import { useThemeColors } from "../hooks/useThemeColors";

interface AnimatedScreenProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
}

export default function AnimatedScreen({ children, style }: AnimatedScreenProps) {
  const { theme } = useThemeColors();

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
      {children}
    </View>
  );
}
