// Design tokens for KiddyMarket — Tactile / Playful LIGHT personality.
// Keys match the "color" block of /app/design_guidelines.json.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FFFAF3",
  onSurface: "#1D2024",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#1D2024",
  surfaceTertiary: "#FFF0DD",
  onSurfaceTertiary: "#1D2024",
  surfaceInverse: "#1D2024",
  onSurfaceInverse: "#FFFFFF",
  muted: "#7A828A",

  brand: "#FF6B6B",
  onBrand: "#FFFFFF",
  brandPrimary: "#FF6B6B",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#4ECDC4",
  onBrandSecondary: "#1D2024",
  brandTertiary: "#FFE66D",
  onBrandTertiary: "#1D2024",

  success: "#2BB3A3",
  onSuccess: "#FFFFFF",
  warning: "#E0A500",
  onWarning: "#1D2024",
  error: "#FF6B6B",
  onError: "#FFFFFF",
  info: "#4D96FF",
  onInfo: "#FFFFFF",

  border: "#F0E5D8",
  borderStrong: "#D6C7B8",
  divider: "#F0E5D8",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme);
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

// Font family names (loaded in app/_layout.tsx via expo-font)
export const fonts = {
  display: "Fredoka",
  text: "Nunito",
};
