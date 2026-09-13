// Chunky tactile button with a springy press animation.
import React from "react";
import { Pressable, Text, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { fonts, useTheme } from "@/src/theme";

type Variant = "primary" | "secondary" | "tertiary" | "danger" | "ghost";
type Size = "md" | "lg";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "lg",
  icon,
  disabled = false,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const bg: Record<Variant, string> = {
    primary: colors.brandPrimary,
    secondary: colors.brandSecondary,
    tertiary: colors.brandTertiary,
    danger: colors.error,
    ghost: "transparent",
  };
  const fg: Record<Variant, string> = {
    primary: colors.onBrandPrimary,
    secondary: colors.onBrandSecondary,
    tertiary: colors.onBrandTertiary,
    danger: colors.onError,
    ghost: colors.onSurface,
  };

  return (
    <AnimatedPressable
      testID={testID}
      disabled={disabled}
      onPressIn={() => {
        scale.value = withSpring(0.95, { damping: 14 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12 });
      }}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={[
        {
          backgroundColor: bg[variant],
          borderRadius: 999,
          paddingVertical: size === "lg" ? 18 : 14,
          paddingHorizontal: size === "lg" ? 28 : 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          opacity: disabled ? 0.45 : 1,
          borderWidth: variant === "ghost" ? 2 : 0,
          borderColor: colors.borderStrong,
        },
        animStyle,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={size === "lg" ? 24 : 20} color={fg[variant]} /> : null}
      <Text
        style={{
          color: fg[variant],
          fontFamily: fonts.display,
          fontSize: size === "lg" ? 20 : 17,
          fontWeight: "500",
        }}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}
