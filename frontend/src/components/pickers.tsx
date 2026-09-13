// Reusable icon + color pickers used in the parent forms.
import React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import type { IoniconName } from "@/src/options";
import { useTheme } from "@/src/theme";

export function ColorPicker({
  colors: palette,
  value,
  onChange,
  testID,
}: {
  colors: string[];
  value: string;
  onChange: (c: string) => void;
  testID?: string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 12, paddingHorizontal: 4, paddingVertical: 4 }}
      testID={testID}
    >
      {palette.map((c) => {
        const selected = c === value;
        return (
          <Pressable
            key={c}
            onPress={() => onChange(c)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              backgroundColor: c,
              flexShrink: 0,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: selected ? 4 : 0,
              borderColor: "#FFFFFF",
            }}
          >
            {selected ? <Ionicons name="checkmark" size={22} color="#FFFFFF" /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function IconPicker({
  icons,
  value,
  color,
  onChange,
  testID,
}: {
  icons: IoniconName[];
  value: string;
  color: string;
  onChange: (i: string) => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 12, paddingHorizontal: 4, paddingVertical: 4 }}
      testID={testID}
    >
      {icons.map((i) => {
        const selected = i === value;
        return (
          <Pressable
            key={i}
            onPress={() => onChange(i)}
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              backgroundColor: selected ? color : colors.surfaceTertiary,
              flexShrink: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name={i} size={26} color={selected ? "#FFFFFF" : colors.onSurfaceTertiary} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
