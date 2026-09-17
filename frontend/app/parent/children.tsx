import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Avatar } from "@/src/components/avatar";
import { Button } from "@/src/components/button";
import { Input } from "@/src/components/input";
import { Sheet } from "@/src/components/sheet";
import { ColorPicker, IconPicker } from "@/src/components/pickers";
import { useToast } from "@/src/components/toast";
import {
  useAssociateNfc,
  useChildren,
  useCreateChild,
  useCredit,
  useDebit,
  useDeleteChild,
  useUpdateChild,
  type Child,
} from "@/src/api";
import { formatEuros, parseAmountToCents } from "@/src/format";
import { AVATAR_ICONS, PALETTE } from "@/src/options";
import { isNfcSupported, readNfcUid } from "@/src/nfc";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export default function Children() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();

  const { data: children, isLoading } = useChildren();
  const createChild = useCreateChild();
  const updateChild = useUpdateChild();
  const deleteChild = useDeleteChild();
  const credit = useCredit();
  const debit = useDebit();
  const associateNfc = useAssociateNfc();

  const [nfcSupported, setNfcSupported] = useState(false);
  useEffect(() => {
    isNfcSupported().then(setNfcSupported);
  }, []);

  // child form
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Child | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string>(AVATAR_ICONS[0]);
  const [color, setColor] = useState<string>(PALETTE[0]);

  // money form
  const [moneyMode, setMoneyMode] = useState<"credit" | "debit" | null>(null);
  const [moneyChild, setMoneyChild] = useState<Child | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  // nfc
  const [nfcChild, setNfcChild] = useState<Child | null>(null);
  const [scanning, setScanning] = useState(false);

  // delete
  const [toDelete, setToDelete] = useState<Child | null>(null);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setIcon(AVATAR_ICONS[0]);
    setColor(PALETTE[0]);
    setFormOpen(true);
  };
  const openEdit = (c: Child) => {
    setEditing(c);
    setName(c.name);
    setIcon(c.avatar_icon);
    setColor(c.color);
    setFormOpen(true);
  };

  const saveChild = async () => {
    if (!name.trim()) return toast.show("Donne un nom", "error");
    try {
      if (editing) {
        await updateChild.mutateAsync({ id: editing.id, name: name.trim(), avatar_icon: icon, color });
        toast.show("Profil modifié", "success");
      } else {
        await createChild.mutateAsync({ name: name.trim(), avatar_icon: icon, color });
        toast.show("Enfant ajouté", "success");
      }
      setFormOpen(false);
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    }
  };

  const openMoney = (c: Child, mode: "credit" | "debit") => {
    setMoneyChild(c);
    setMoneyMode(mode);
    setAmount("");
    setReason("");
  };

  const saveMoney = async () => {
    if (!moneyChild || !moneyMode) return;
    const cents = parseAmountToCents(amount);
    if (cents === null || cents <= 0) return toast.show("Montant invalide", "error");
    try {
      if (moneyMode === "credit") {
        await credit.mutateAsync({ child_id: moneyChild.id, amount_cents: cents, reason: reason.trim() || undefined });
        toast.show(`Tu as crédité ${formatEuros(cents)} à ${moneyChild.name}`, "success");
      } else {
        await debit.mutateAsync({ child_id: moneyChild.id, amount_cents: cents, reason: reason.trim() || undefined });
        toast.show(`Tu as débité ${formatEuros(cents)} à ${moneyChild.name}`, "success");
      }
      setMoneyMode(null);
      setMoneyChild(null);
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    }
  };

  const doAssociate = async (uid: string) => {
    if (!nfcChild) return;
    try {
      await associateNfc.mutateAsync({ id: nfcChild.id, nfc_uid: uid });
      toast.show(`Carte associée à ${nfcChild.name}`, "success");
      setNfcChild(null);
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    }
  };

  const scanRealNfc = async () => {
    setScanning(true);
    try {
      const uid = await readNfcUid();
      await doAssociate(uid);
    } catch (e: any) {
      toast.show("Scan annulé", "error");
    } finally {
      setScanning(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteChild.mutateAsync(toDelete.id);
      toast.show("Profil supprimé", "success");
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setToDelete(null);
    }
  };

  const savingChild = createChild.isPending || updateChild.isPending;
  const savingMoney = credit.isPending || debit.isPending;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]} testID="children-screen">
      <Text style={styles.title}>Mes enfants</Text>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.brandPrimary} /></View>
      ) : !children || children.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={54} color={colors.brandSecondary} />
          <Text style={styles.muted}>Ajoute ton premier enfant !</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingTop: 10, paddingBottom: insets.bottom + 100 }}>
          {children.map((c, idx) => (
            <Animated.View key={c.id} entering={FadeInDown.delay(idx * 50)} style={styles.card}>
              <View style={styles.cardTop}>
                <Avatar icon={c.avatar_icon} color={c.color} size={56} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{c.name}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.balance}>{formatEuros(c.balance_cents)}</Text>
                    <View style={[styles.nfcBadge, { backgroundColor: c.nfc_uid ? colors.success : colors.surfaceTertiary }]}>
                      <Ionicons name="card" size={12} color={c.nfc_uid ? colors.onSuccess : colors.muted} />
                      <Text style={[styles.nfcBadgeText, { color: c.nfc_uid ? colors.onSuccess : colors.muted }]}>
                        {c.nfc_uid ? "Carte OK" : "Pas de carte"}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              <View style={styles.actions}>
                <ActionBtn icon="add-circle" label="Créditer" color={colors.success} onPress={() => openMoney(c, "credit")} testID={`credit-${c.id}`} />
                <ActionBtn icon="remove-circle" label="Débiter" color={colors.warning} onPress={() => openMoney(c, "debit")} testID={`debit-${c.id}`} />
                <ActionBtn icon="card" label="Carte" color={colors.info} onPress={() => setNfcChild(c)} testID={`nfc-${c.id}`} />
                <ActionBtn icon="create" label="Modifier" color={colors.muted} onPress={() => openEdit(c)} testID={`edit-child-${c.id}`} />
                <ActionBtn icon="trash" label="Suppr." color={colors.error} onPress={() => setToDelete(c)} testID={`delete-child-${c.id}`} />
              </View>
            </Animated.View>
          ))}
        </ScrollView>
      )}

      <Pressable style={[styles.fab, { bottom: insets.bottom + 20 }]} onPress={openCreate} testID="add-child-fab">
        <Ionicons name="add" size={32} color={colors.onBrandPrimary} />
      </Pressable>

      {/* Child form */}
      <Sheet visible={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Modifier le profil" : "Nouvel enfant"} testID="child-form-sheet">
        <View style={styles.avatarPreviewWrap}>
          <Avatar icon={icon} color={color} size={80} />
        </View>
        <Input label="Nom / pseudo" value={name} onChangeText={setName} placeholder="Ex. Lucas" testID="child-name-input" />
        <View style={{ gap: 8 }}>
          <Text style={styles.fieldLabel}>Avatar</Text>
          <IconPicker icons={AVATAR_ICONS} value={icon} color={color} onChange={setIcon} testID="child-icon-picker" />
        </View>
        <View style={{ gap: 8 }}>
          <Text style={styles.fieldLabel}>Couleur</Text>
          <ColorPicker colors={PALETTE} value={color} onChange={setColor} testID="child-color-picker" />
        </View>
        <Button label={savingChild ? "Enregistrement..." : "Enregistrer"} icon="save" disabled={savingChild} onPress={saveChild} testID="save-child-button" />
      </Sheet>

      {/* Money form */}
      <Sheet
        visible={!!moneyMode}
        onClose={() => setMoneyMode(null)}
        title={moneyMode === "credit" ? `Créditer ${moneyChild?.name ?? ""}` : `Débiter ${moneyChild?.name ?? ""}`}
        testID="money-sheet"
      >
        <View style={styles.avatarPreviewWrap}>
          {moneyChild ? <Avatar icon={moneyChild.avatar_icon} color={moneyChild.color} size={70} /> : null}
          <Text style={styles.currentBalance}>Solde : {moneyChild ? formatEuros(moneyChild.balance_cents) : ""}</Text>
        </View>
        <Input label="Montant (€)" value={amount} onChangeText={setAmount} placeholder="Ex. 5,00" keyboardType="decimal-pad" testID="money-amount-input" />
        <Input label="Motif (optionnel)" value={reason} onChangeText={setReason} placeholder={moneyMode === "credit" ? "Argent de poche" : "Ajustement"} testID="money-reason-input" />
        <Button
          label={savingMoney ? "..." : moneyMode === "credit" ? "Créditer" : "Débiter"}
          icon={moneyMode === "credit" ? "add-circle" : "remove-circle"}
          variant={moneyMode === "credit" ? "primary" : "secondary"}
          disabled={savingMoney}
          onPress={saveMoney}
          testID="save-money-button"
        />
      </Sheet>

      {/* NFC associate */}
      <Sheet visible={!!nfcChild} onClose={() => setNfcChild(null)} title="Carte NFC" testID="nfc-sheet">
        <View style={styles.avatarPreviewWrap}>
          {nfcChild ? <Avatar icon={nfcChild.avatar_icon} color={nfcChild.color} size={70} /> : null}
          <Text style={styles.nfcStatus}>
            {nfcChild?.nfc_uid ? `Carte actuelle : ${nfcChild.nfc_uid}` : "Aucune carte associée"}
          </Text>
        </View>
        <Text style={styles.help}>Demande à l'enfant d'approcher sa carte de l'appareil pour l'associer.</Text>
        <Button
          label={scanning ? "Approche la carte..." : nfcSupported ? "Scanner la carte (NFC)" : "NFC indisponible sur cet appareil"}
          icon="scan-circle"
          disabled={!nfcSupported || scanning}
          onPress={scanRealNfc}
          testID="scan-associate-button"
        />
      </Sheet>

      {/* Delete */}
      <Sheet visible={!!toDelete} onClose={() => setToDelete(null)} title="Supprimer ce profil ?" testID="delete-child-sheet">
        <Text style={styles.confirmText}>Es-tu sûr de vouloir supprimer le profil de « {toDelete?.name} » ?</Text>
        <Button label="Supprimer" icon="trash" variant="danger" onPress={confirmDelete} testID="confirm-delete-child-button" />
        <Button label="Annuler" variant="ghost" size="md" onPress={() => setToDelete(null)} />
      </Sheet>
    </View>
  );
}

function ActionBtn({ icon, label, color, onPress, testID }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; color: string; onPress: () => void; testID?: string }) {
  const styles = useStyles();
  return (
    <Pressable style={styles.actionBtn} onPress={onPress} testID={testID}>
      <Ionicons name={icon} size={24} color={color} />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: 20 },
  title: { fontFamily: fonts.display, fontSize: 30, fontWeight: "500", color: colors.onSurface },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: 22, padding: 16, gap: 14 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  name: { fontFamily: fonts.display, fontSize: 22, fontWeight: "500", color: colors.onSurface },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  balance: { fontFamily: fonts.text, fontSize: 16, fontWeight: "700", color: colors.brandSecondary },
  nfcBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  nfcBadgeText: { fontFamily: fonts.text, fontSize: 12, fontWeight: "700" },
  actions: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  actionBtn: { alignItems: "center", gap: 4, flex: 1 },
  actionLabel: { fontFamily: fonts.text, fontSize: 11, fontWeight: "700", color: colors.muted },
  fab: {
    position: "absolute",
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 999,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.brandPrimary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  avatarPreviewWrap: { alignItems: "center", gap: 10, paddingVertical: 4 },
  currentBalance: { fontFamily: fonts.text, fontSize: 15, fontWeight: "700", color: colors.muted },
  fieldLabel: { fontFamily: fonts.text, fontSize: 15, fontWeight: "600", color: colors.onSurfaceTertiary, marginLeft: 4 },
  help: { fontFamily: fonts.text, fontSize: 14, color: colors.muted, textAlign: "center" },
  nfcStatus: { fontFamily: fonts.text, fontSize: 14, color: colors.muted },
  confirmText: { fontFamily: fonts.text, fontSize: 16, color: colors.onSurface, textAlign: "center", paddingVertical: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  muted: { fontFamily: fonts.text, fontSize: 16, color: colors.muted, textAlign: "center" },
}));
