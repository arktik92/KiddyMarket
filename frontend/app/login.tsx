import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/src/components/button";
import { Input } from "@/src/components/input";
import { useToast } from "@/src/components/toast";
import { useAuth } from "@/src/auth/auth-context";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const { login, signup, loginWithGoogle } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim()) return toast.show("Entre ton email", "error");
    if (password.length < 6) return toast.show("Mot de passe : 6 caractères minimum", "error");
    if (mode === "signup" && !name.trim()) return toast.show("Entre ton prénom", "error");
    setBusy(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await signup(email.trim(), password, name.trim());
    } catch (e: any) {
      toast.show(e?.message || "Erreur de connexion", "error");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    try {
      await loginWithGoogle();
    } catch {
      toast.show("Connexion Google annulée", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container} testID="login-screen">
      <KeyboardAwareScrollView
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 }]}
      >
        <View style={styles.logoRow}>
          <View style={styles.logoBadge}>
            <Ionicons name="card" size={30} color={colors.onBrandPrimary} />
          </View>
          <Text style={styles.brand}>KiddyMarket</Text>
        </View>

        <Text style={styles.title}>{mode === "login" ? "Content de te revoir !" : "Créer un compte parent"}</Text>
        <Text style={styles.subtitle}>
          {mode === "login" ? "Connecte-toi pour retrouver tes enfants." : "Un compte parent, tes enfants rien qu'à toi."}
        </Text>

        <View style={styles.form}>
          {mode === "signup" ? (
            <Input label="Prénom du parent" value={name} onChangeText={setName} placeholder="Ex. Papa" testID="signup-name-input" />
          ) : null}
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="parent@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            testID="login-email-input"
          />
          <Input
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••"
            secureTextEntry
            testID="login-password-input"
          />

          <Button
            label={busy ? "..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
            icon={mode === "login" ? "log-in" : "person-add"}
            disabled={busy}
            onPress={submit}
            testID="login-submit-button"
          />

          <View style={styles.dividerRow}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.line} />
          </View>

          <Button
            label="Continuer avec Google"
            icon="logo-google"
            variant="secondary"
            disabled={busy}
            onPress={google}
            testID="google-login-button"
          />
        </View>

        <Pressable
          style={styles.switchBtn}
          onPress={() => setMode((m) => (m === "login" ? "signup" : "login"))}
          testID="toggle-mode-button"
        >
          <Text style={styles.switchText}>
            {mode === "login" ? "Pas encore de compte ? " : "Déjà un compte ? "}
            <Text style={styles.switchLink}>{mode === "login" ? "Créer un compte" : "Se connecter"}</Text>
          </Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 24, gap: 8 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { fontFamily: fonts.display, fontSize: 30, fontWeight: "500", color: colors.onSurface },
  title: { fontFamily: fonts.display, fontSize: 26, fontWeight: "500", color: colors.onSurface, marginTop: 12 },
  subtitle: { fontFamily: fonts.text, fontSize: 16, color: colors.muted, marginBottom: 12 },
  form: { gap: 16, marginTop: 8 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: fonts.text, fontSize: 13, color: colors.muted },
  switchBtn: { alignItems: "center", paddingVertical: 20 },
  switchText: { fontFamily: fonts.text, fontSize: 15, color: colors.muted },
  switchLink: { color: colors.brandPrimary, fontWeight: "700" },
}));
