// Bottom sheet built as an in-tree overlay (plays well with the keyboard
// controller and the toast provider, unlike RN Modal on iOS).
import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, makeStyles, useTheme } from "@/src/theme";

export function Sheet({
  visible,
  onClose,
  title,
  children,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <View style={styles.root} testID={testID}>
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.backdropWrap}>
        <Pressable style={styles.backdrop} onPress={onClose} testID="sheet-backdrop" />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.springify().damping(18)}
        exiting={SlideOutDown}
        style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}
      >
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12} testID="sheet-close">
            <Ionicons name="close-circle" size={30} color={colors.muted} />
          </Pressable>
        </View>
        <KeyboardAwareScrollView
          bottomOffset={20}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 16, paddingTop: 8 }}
        >
          {children}
        </KeyboardAwareScrollView>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { ...StyleSheetAbsolute(), zIndex: 1000 },
  backdropWrap: { ...StyleSheetAbsolute() },
  backdrop: { flex: 1, backgroundColor: "rgba(29,32,36,0.45)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "88%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "500",
    color: colors.onSurface,
  },
}));

function StyleSheetAbsolute() {
  return { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };
}
