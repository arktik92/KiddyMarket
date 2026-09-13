import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import { Avatar } from "@/src/components/avatar";
import { Button } from "@/src/components/button";
import { Sheet } from "@/src/components/sheet";
import { useToast } from "@/src/components/toast";
import { childByNfc, usePurchase, type Child, type PurchaseItem } from "@/src/api";
import { formatEuros } from "@/src/format";
import { fakeUid, isNfcSupported, readNfcUid } from "@/src/nfc";
import type { IoniconName } from "@/src/options";
import { fonts, makeStyles, useTheme } from "@/src/theme";

type Step = "identify" | "confirm" | "success" | "insufficient";

export function PaymentSheet({
  visible,
  onClose,
  onPaid,
  items,
  totalCents,
  kids,
}: {
  visible: boolean;
  onClose: () => void;
  onPaid: () => void;
  items: PurchaseItem[];
  totalCents: number;
  kids: Child[];
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const purchase = usePurchase();

  const [step, setStep] = useState<Step>("identify");
  const [child, setChild] = useState<Child | null>(null);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep("identify");
      setChild(null);
      isNfcSupported().then(setNfcSupported);
    }
  }, [visible]);

  const pickChild = (c: Child) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setChild(c);
    if (totalCents > c.balance_cents) setStep("insufficient");
    else setStep("confirm");
  };

  const scanReal = async () => {
    setScanning(true);
    try {
      const uid = await readNfcUid();
      const c = await childByNfc(uid);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      pickChild(c);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      toast.show(e?.message === "Carte non reconnue" ? "Carte non reconnue. Demande à un parent de la configurer." : "Scan annulé", "error");
    } finally {
      setScanning(false);
    }
  };

  const confirmPay = async () => {
    if (!child) return;
    try {
      await purchase.mutateAsync({ child_id: child.id, items });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStep("success");
    } catch (e: any) {
      toast.show(e?.message || "Paiement impossible", "error");
    }
  };

  const remaining = child ? child.balance_cents - totalCents : 0;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={
        step === "identify"
          ? "Qui paie cet achat ?"
          : step === "confirm"
          ? "Vérifie ton paiement"
          : step === "insufficient"
          ? "Oups !"
          : "Bravo !"
      }
      testID="payment-sheet"
    >
      {step === "identify" ? (
        <View style={{ gap: 16 }}>
          <Text style={styles.help}>Approche ta Carte Bleue, ou choisis ton profil pour simuler.</Text>

          <Button
            label={scanning ? "Approche ta carte..." : nfcSupported ? "Scanner la carte (NFC)" : "NFC (build requis)"}
            icon="scan-circle"
            variant="secondary"
            disabled={!nfcSupported || scanning}
            onPress={scanReal}
            testID="scan-nfc-button"
          />

          <View style={styles.dividerRow}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>ou simuler</Text>
            <View style={styles.line} />
          </View>

          <View style={styles.childGrid}>
            {kids.map((c) => (
              <Pressable key={c.id} style={styles.childPick} onPress={() => pickChild(c)} testID={`pay-child-${c.id}`}>
                <Avatar icon={c.avatar_icon} color={c.color} size={64} />
                <Text style={styles.childPickName}>{c.name}</Text>
                <Text style={styles.childPickBal}>{formatEuros(c.balance_cents)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {step === "confirm" && child ? (
        <Animated.View entering={FadeIn} style={{ gap: 18, paddingBottom: 8 }}>
          <View style={styles.childHeader}>
            <Avatar icon={child.avatar_icon} color={child.color} size={64} />
            <Text style={styles.childHeaderName}>{child.name}</Text>
          </View>

          <View style={styles.summary}>
            <Row label="Tu vas payer" value={formatEuros(totalCents)} bold color={colors.brandPrimary} />
            <View style={styles.hr} />
            <Row label="Solde avant" value={formatEuros(child.balance_cents)} />
            <Row label="Il te restera" value={formatEuros(remaining)} bold color={colors.success} />
          </View>

          <Button
            label={purchase.isPending ? "Paiement..." : "Confirmer le paiement"}
            icon="checkmark-circle"
            disabled={purchase.isPending}
            onPress={confirmPay}
            testID="confirm-payment-button"
          />
          <Button label="Annuler" variant="ghost" size="md" onPress={onClose} testID="cancel-payment-button" />
        </Animated.View>
      ) : null}

      {step === "insufficient" && child ? (
        <Animated.View entering={FadeIn} style={styles.centerBlock}>
          <View style={[styles.bigIcon, { backgroundColor: colors.warning }]}>
            <Ionicons name="sad-outline" size={44} color={colors.onWarning} />
          </View>
          <Text style={styles.bigMsg}>Tu n'as pas assez d'argent pour cet achat.</Text>
          <Text style={styles.subMsg}>Parles-en à tes parents. Il te faut {formatEuros(totalCents)} mais tu as {formatEuros(child.balance_cents)}.</Text>
          <Button label="Retour" variant="secondary" onPress={() => setStep("identify")} testID="insufficient-back-button" />
        </Animated.View>
      ) : null}

      {step === "success" && child ? (
        <Animated.View entering={FadeIn} style={styles.centerBlock}>
          <Animated.View entering={ZoomIn.springify().damping(10)} style={[styles.bigIcon, { backgroundColor: colors.success }]}>
            <Ionicons name="checkmark" size={54} color={colors.onSuccess} />
          </Animated.View>
          <Text style={styles.bigMsg}>Achat réussi !</Text>
          <Text style={styles.subMsg}>Bravo {child.name} ! Il te reste {formatEuros(remaining)}.</Text>
          <Button
            label="Terminé"
            icon="happy"
            onPress={() => {
              onPaid();
              toast.show(`Achat de ${formatEuros(totalCents)} par ${child.name}`, "success");
            }}
            testID="payment-done-button"
          />
        </Animated.View>
      ) : null}
    </Sheet>
  );
}

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bold && { fontFamily: fonts.display, fontSize: 22 }, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  help: { fontFamily: fonts.text, fontSize: 15, color: colors.muted, textAlign: "center" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: fonts.text, fontSize: 13, color: colors.muted },
  childGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" },
  childPick: {
    width: "30%",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 18,
    paddingVertical: 14,
  },
  childPickName: { fontFamily: fonts.display, fontSize: 16, fontWeight: "500", color: colors.onSurface },
  childPickBal: { fontFamily: fonts.text, fontSize: 13, fontWeight: "700", color: colors.muted },
  childHeader: { alignItems: "center", gap: 10 },
  childHeaderName: { fontFamily: fonts.display, fontSize: 24, fontWeight: "500", color: colors.onSurface },
  summary: { backgroundColor: colors.surfaceSecondary, borderRadius: 20, padding: 18, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowLabel: { fontFamily: fonts.text, fontSize: 16, color: colors.muted },
  rowValue: { fontFamily: fonts.text, fontSize: 17, fontWeight: "700", color: colors.onSurface },
  hr: { height: 1, backgroundColor: colors.border },
  centerBlock: { alignItems: "center", gap: 14, paddingVertical: 12 },
  bigIcon: { width: 96, height: 96, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  bigMsg: { fontFamily: fonts.display, fontSize: 24, fontWeight: "500", color: colors.onSurface, textAlign: "center" },
  subMsg: { fontFamily: fonts.text, fontSize: 16, color: colors.muted, textAlign: "center", paddingHorizontal: 10 },
}));
