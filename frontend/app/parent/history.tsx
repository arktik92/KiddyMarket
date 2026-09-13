import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Avatar } from "@/src/components/avatar";
import { useAllTransactions, useChildren, type Transaction } from "@/src/api";
import { formatDate, formatEuros } from "@/src/format";
import type { IoniconName } from "@/src/options";
import { fonts, makeStyles, useTheme } from "@/src/theme";

const TYPE_META: Record<Transaction["type"], { icon: IoniconName; label: string; sign: string }> = {
  credit: { icon: "arrow-down-circle", label: "Crédit", sign: "+" },
  debit_manuel: { icon: "arrow-up-circle", label: "Débit", sign: "-" },
  achat: { icon: "bag-check", label: "Achat", sign: "-" },
};

export default function History() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();

  const { data: children } = useChildren();
  const [filter, setFilter] = useState<string>("Tout");
  const childId = filter === "Tout" ? undefined : filter;
  const { data: transactions, isLoading } = useAllTransactions(childId);

  const childMap = useMemo(() => {
    const m: Record<string, { name: string; icon: string; color: string }> = {};
    (children ?? []).forEach((c) => (m[c.id] = { name: c.name, icon: c.avatar_icon, color: c.color }));
    return m;
  }, [children]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]} testID="history-screen">
      <Text style={styles.title}>Historique</Text>

      <View style={styles.chipRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContent}>
          <FilterChip label="Tout" active={filter === "Tout"} onPress={() => setFilter("Tout")} testID="history-filter-Tout" />
          {(children ?? []).map((c) => (
            <FilterChip key={c.id} label={c.name} active={filter === c.id} onPress={() => setFilter(c.id)} testID={`history-filter-${c.id}`} />
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.brandPrimary} /></View>
      ) : !transactions || transactions.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={54} color={colors.brandSecondary} />
          <Text style={styles.muted}>Aucune transaction pour l'instant.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingTop: 6, paddingBottom: insets.bottom + 24 }}>
          {transactions.map((tx, idx) => {
            const meta = TYPE_META[tx.type];
            const c = childMap[tx.child_id];
            const positive = tx.type === "credit";
            return (
              <Animated.View key={tx.id} entering={FadeInDown.delay(idx * 30)} style={styles.row}>
                {c ? <Avatar icon={c.icon} color={c.color} size={44} /> : <View style={{ width: 44 }} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{c?.name ?? "Enfant"}</Text>
                  <Text style={styles.rowDetail} numberOfLines={1}>
                    {tx.type === "achat"
                      ? tx.items.map((i) => (i.qty > 1 ? `${i.name} x${i.qty}` : i.name)).join(", ")
                      : tx.reason || meta.label}
                  </Text>
                  <Text style={styles.rowDate}>{formatDate(tx.created_at)}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={[styles.rowAmount, { color: positive ? colors.success : colors.onSurface }]}>
                    {meta.sign}{formatEuros(tx.amount_cents)}
                  </Text>
                  <View style={[styles.typeBadge, { backgroundColor: colors.surfaceTertiary }]}>
                    <Ionicons name={meta.icon} size={12} color={colors.onSurfaceTertiary} />
                    <Text style={styles.typeBadgeText}>{meta.label}</Text>
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function FilterChip({ label, active, onPress, testID }: { label: string; active: boolean; onPress: () => void; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary }]}
      testID={testID}
    >
      <Text style={[styles.chipText, { color: active ? colors.onBrandPrimary : colors.onSurfaceTertiary }]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: 20 },
  title: { fontFamily: fonts.display, fontSize: 30, fontWeight: "500", color: colors.onSurface },
  chipRow: { height: 56, marginTop: 4 },
  chipContent: { gap: 10, paddingVertical: 10, paddingRight: 8 },
  chip: { height: 36, flexShrink: 0, paddingHorizontal: 18, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: fonts.text, fontSize: 15, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 18,
    padding: 14,
  },
  rowName: { fontFamily: fonts.display, fontSize: 18, fontWeight: "500", color: colors.onSurface },
  rowDetail: { fontFamily: fonts.text, fontSize: 14, color: colors.onSurfaceTertiary, marginTop: 2 },
  rowDate: { fontFamily: fonts.text, fontSize: 12, color: colors.muted, marginTop: 2 },
  rowAmount: { fontFamily: fonts.display, fontSize: 18, fontWeight: "500" },
  typeBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  typeBadgeText: { fontFamily: fonts.text, fontSize: 11, fontWeight: "700", color: colors.onSurfaceTertiary },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  muted: { fontFamily: fonts.text, fontSize: 16, color: colors.muted, textAlign: "center" },
}));
