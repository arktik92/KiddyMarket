import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { resetPin, verifyPin } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { fonts, makeStyles, useTheme } from "@/src/theme";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

export default function PinScreen() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const shake = useSharedValue(0);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const triggerShake = () => {
    shake.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-6, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  };

  const submit = async (code: string) => {
    setChecking(true);
    try {
      if (resetMode) {
        await resetPin(code);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        toast.show("Nouveau code enregistré", "success");
        router.replace("/parent");
        return;
      }
      const res = await verifyPin(code);
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.replace("/parent");
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        triggerShake();
        toast.show("Code incorrect", "error");
        setPin("");
      }
    } catch {
      toast.show("Erreur de connexion", "error");
      setPin("");
    } finally {
      setChecking(false);
    }
  };

  const onKey = (k: string) => {
    if (checking) return;
    Haptics.selectionAsync().catch(() => {});
    if (k === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) submit(next);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} testID="pin-screen">
      <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={12} testID="pin-close">
        <Ionicons name="chevron-down" size={28} color={colors.muted} />
      </Pressable>

      <View style={styles.top}>
        <View style={styles.lockBadge}>
          <Ionicons name="lock-closed" size={30} color={colors.onBrandSecondary} />
        </View>
        <Text style={styles.title}>{resetMode ? "Nouveau code" : "Accès Parent"}</Text>
        <Text style={styles.subtitle}>
          {resetMode ? "Choisis un nouveau code à 4 chiffres" : "Entre ton code à 4 chiffres"}
        </Text>

        <Animated.View style={[styles.dots, shakeStyle]}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[styles.dot, { backgroundColor: i < pin.length ? colors.brandPrimary : colors.border }]}
            />
          ))}
        </Animated.View>
        <Pressable
          onPress={() => {
            setResetMode((m) => !m);
            setPin("");
          }}
          hitSlop={8}
          testID="forgot-pin-button"
        >
          <Text style={styles.hint}>{resetMode ? "Annuler" : "Code oublié ?"}</Text>
        </Pressable>
      </View>

      <View style={styles.keypad}>
        {KEYS.map((k, idx) => {
          if (k === "") return <View key={idx} style={styles.key} />;
          return (
            <Pressable
              key={idx}
              style={({ pressed }) => [styles.key, k !== "del" && styles.keyFilled, pressed && styles.keyPressed]}
              onPress={() => onKey(k)}
              testID={k === "del" ? "pin-delete" : `pin-key-${k}`}
            >
              {k === "del" ? (
                <Ionicons name="backspace-outline" size={28} color={colors.onSurface} />
              ) : (
                <Text style={styles.keyText}>{k}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: 24, justifyContent: "space-between" },
  closeBtn: { position: "absolute", top: 16, right: 20, zIndex: 2 },
  top: { alignItems: "center", gap: 12, marginTop: 20 },
  lockBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: fonts.display, fontSize: 28, fontWeight: "500", color: colors.onSurface },
  subtitle: { fontFamily: fonts.text, fontSize: 16, color: colors.muted },
  dots: { flexDirection: "row", gap: 18, marginTop: 20 },
  dot: { width: 18, height: 18, borderRadius: 999 },
  hint: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, marginTop: 8 },
  keypad: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 16 },
  key: {
    width: "30%",
    aspectRatio: 1.6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  keyFilled: { backgroundColor: colors.surfaceSecondary },
  keyPressed: { opacity: 0.6 },
  keyText: { fontFamily: fonts.display, fontSize: 32, fontWeight: "500", color: colors.onSurface },
}));
