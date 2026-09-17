// Global toast system. Mounted once at the top of the tree so it floats above
// tabs, sheets and modals. Use `const toast = useToast(); toast.show("...")`.
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, makeStyles, useTheme } from "@/src/theme";

type ToastType = "success" | "error" | "info";
type ToastState = { message: string; type: ToastType } | null;

type ToastCtx = { show: (message: string, type?: ToastType) => void };

const Ctx = createContext<ToastCtx>({ show: () => {} });

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();

  const show = useCallback((message: string, type: ToastType = "info") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, type });
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const bg =
    toast?.type === "success" ? colors.success : toast?.type === "error" ? colors.error : colors.surfaceInverse;
  const icon = toast?.type === "success" ? "checkmark-circle" : toast?.type === "error" ? "alert-circle" : "information-circle";

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {toast ? (
        <Animated.View
          entering={FadeInUp.duration(220)}
          exiting={FadeOutUp}
          style={[styles.wrap, { top: insets.top + 10 }]}
          pointerEvents="none"
          testID="toast"
        >
          <View style={[styles.toast, { backgroundColor: bg }]}>
            <Ionicons name={icon} size={22} color="#FFFFFF" />
            <Text style={styles.text}>{toast.message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </Ctx.Provider>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 9999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 999,
    maxWidth: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  text: {
    color: "#FFFFFF",
    fontFamily: fonts.text,
    fontSize: 15,
    fontWeight: "600",
    flexShrink: 1,
  },
}));
