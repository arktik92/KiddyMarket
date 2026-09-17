import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/src/components/button";
import { Input } from "@/src/components/input";
import { useToast } from "@/src/components/toast";
import { changePinRequest } from "@/src/api";
import { useAuth } from "@/src/auth/auth-context";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export default function Settings() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const { user, logout } = useAuth();

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [busy, setBusy] = useState(false);

  const savePin = async () => {
    if (!/^\d{4}$/.test(newPin)) return toast.show("Le nouveau code doit contenir 4 chiffres", "error");
    setBusy(true);
    try {
      await changePinRequest(currentPin, newPin);
      toast.show("Code PIN modifié", "success");
      setCurrentPin("");
      setNewPin("");
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setBusy(false);
    }
  };

  const doLogout = async () => {
    await logout();
  };

  return (
    <View style={styles.container} testID="settings-screen">
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Réglages</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="settings-close">
          <Ionicons name="close-circle" size={32} color={colors.muted} />
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: insets.bottom + 32 }}
      >
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Compte parent</Text>
          <View style={styles.accountRow}>
            <View style={styles.accountBadge}>
              <Ionicons name="person" size={24} color={colors.onBrandSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountName}>{user?.name || "Parent"}</Text>
              <Text style={styles.accountEmail}>{user?.email}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Modifier le code PIN</Text>
          <Input
            label="Code actuel"
            value={currentPin}
            onChangeText={(t) => setCurrentPin(t.replace(/\D/g, "").slice(0, 4))}
            placeholder="1234"
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry
            testID="current-pin-input"
          />
          <Input
            label="Nouveau code (4 chiffres)"
            value={newPin}
            onChangeText={(t) => setNewPin(t.replace(/\D/g, "").slice(0, 4))}
            placeholder="••••"
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry
            testID="new-pin-input"
          />
          <Button label={busy ? "..." : "Enregistrer le code"} icon="key" disabled={busy} onPress={savePin} testID="save-pin-button" />
          <Text style={styles.hint}>Code oublié ? Tu peux aussi le réinitialiser depuis l'écran du code parent.</Text>
        </View>

        <Button label="Se déconnecter" icon="log-out" variant="danger" onPress={doLogout} testID="logout-account-button" />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: { fontFamily: fonts.display, fontSize: 28, fontWeight: "500", color: colors.onSurface },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: 22, padding: 18, gap: 14 },
  cardLabel: { fontFamily: fonts.display, fontSize: 18, fontWeight: "500", color: colors.onSurface },
  accountRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  accountBadge: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  accountName: { fontFamily: fonts.display, fontSize: 20, fontWeight: "500", color: colors.onSurface },
  accountEmail: { fontFamily: fonts.text, fontSize: 14, color: colors.muted, marginTop: 2 },
  hint: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, textAlign: "center" },
}));
