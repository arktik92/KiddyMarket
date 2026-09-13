// Labeled text input with a soft rounded background.
import React from "react";
import { Text, TextInput, TextInputProps, View } from "react-native";

import { fonts, makeStyles, useTheme } from "@/src/theme";

export function Input({
  label,
  style,
  ...props
}: TextInputProps & { label: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  label: {
    fontFamily: fonts.text,
    fontSize: 15,
    fontWeight: "600",
    color: colors.onSurfaceTertiary,
    marginLeft: 4,
  },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontFamily: fonts.text,
    fontSize: 18,
    color: colors.onSurface,
  },
}));
