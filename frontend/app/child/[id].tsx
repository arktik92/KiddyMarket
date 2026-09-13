import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Avatar } from "@/src/components/avatar";
import { useChildren, useChildTransactions, type Transaction } from "@/src/api";
import { formatDate, formatEuros } from "@/src/format";
import type { IoniconName } from "@/src/options";
import { fonts, makeStyles, useTheme } from "@/src/theme";

const TYPE_META: Record<Transaction["type"], { icon: IoniconName; label: string; sign: string }> = {
  credit: { icon: "arrow-down-circle", label: "Argent reçu", sign: "+" },
  debit_manuel: { icon: "arrow-up-circle", label: "Retrait", sign: "-" },
  achat: { icon: "bag-check", label: "Achat", sign: "-" },
};

export default function ChildDashboard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();

  const { data: children } = useChildren();
  const child = children?.find((c) => c.id === id);
  const { data: transactions, isLoading } = useChildTransactions(id);

  if (!child) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]} testID="child-dashboard">
      <View style={styles.topBar}>
        <View style={styles.userRow}>
          <Avatar icon={child.avatar_icon} color={child.color} size={44} />
          <Text style={styles.hello}>Salut {child.name} !</Text>
        </View>
        <Pressable style={styles.logout} onPress={() => router.replace("/")} testID="logout-button">
          <Ionicons name="log-out-outline" size={22} color={colors.onSurfaceTertiary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {/* Carte Bleue */}
        <Animated.View entering={FadeInDown.springify()} style={styles.card} testID="balance-card">
          <View style={styles.cardTopRow}>
            <Text style={styles.cardLabel}>Ma Carte Bleue</Text>
            <Ionicons name="wifi" size={22} color="rgba(255,255,255,0.9)" style={{ transform: [{ rotate: "90deg" }] }} />
          </View>
          <Text style={styles.cardBalanceLabel}>Mon argent</Text>
          <Text style={styles.cardBalance} testID="balance-amount">{formatEuros(child.balance_cents)}</Text>
          <View style={styles.cardBottomRow}>
            <View style={styles.chip} />
            <Text style={styles.cardName}>{child.name.toUpperCase()}</Text>
          </View>
        </Animated.View>

        <Text style={styles.sectionTitle}>Mes achats</Text>

        {isLoading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 24 }} />
        ) : !transactions || transactions.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="bag-handle-outline" size={54} color={colors.brandSecondary} />
            <Text style={styles.emptyText}>Tu n'as rien acheté pour l'instant !</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {transactions.map((tx, idx) => {
              const meta = TYPE_META[tx.type];
              const positive = tx.type === "credit";
              const firstIcon = tx.items[0]?.icon ?? meta.icon;
              const firstColor = tx.items[0]?.color ?? child.color;
              return (
                <Animated.View key={tx.id} entering={FadeInDown.delay(idx * 50)} style={styles.txRow}>
                  <View style={[styles.txIcon, { backgroundColor: firstColor }]}>
                    <Ionicons name={(tx.type === "achat" ? firstIcon : meta.icon) as IoniconName} size={24} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txTitle} numberOfLines={1}>
                      {tx.type === "achat"
                        ? tx.items.map((i) => (i.qty > 1 ? `${i.name} x${i.qty}` : i.name)).join(", ")
                        : tx.reason || meta.label}
                    </Text>
                    <Text style={styles.txDate}>{formatDate(tx.created_at)}</Text>
                  </View>
                  <Text style={[styles.txAmount, { color: positive ? colors.success : colors.onSurface }]}>
                    {meta.sign}{formatEuros(tx.amount_cents)}
                  </Text>
                </Animated.View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: 20 },
  center: { alignItems: "center", justifyContent: "center" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  hello: { fontFamily: fonts.display, fontSize: 22, fontWeight: "500", color: colors.onSurface },
  logout: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: colors.info,
    borderRadius: 28,
    padding: 24,
    gap: 6,
    shadowColor: colors.info,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardLabel: { fontFamily: fonts.display, fontSize: 18, fontWeight: "500", color: "#FFFFFF" },
  cardBalanceLabel: { fontFamily: fonts.text, fontSize: 15, color: "rgba(255,255,255,0.85)", marginTop: 16 },
  cardBalance: { fontFamily: fonts.display, fontSize: 48, fontWeight: "500", color: "#FFFFFF" },
  cardBottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  chip: { width: 42, height: 30, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.35)" },
  cardName: { fontFamily: fonts.text, fontSize: 16, fontWeight: "700", color: "#FFFFFF", letterSpacing: 1 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 22, fontWeight: "500", color: colors.onSurface, marginTop: 28, marginBottom: 14 },
  emptyBox: { alignItems: "center", gap: 12, paddingVertical: 40 },
  emptyText: { fontFamily: fonts.text, fontSize: 16, color: colors.muted },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 20,
    padding: 14,
  },
  txIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  txTitle: { fontFamily: fonts.text, fontSize: 16, fontWeight: "700", color: colors.onSurface },
  txDate: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, marginTop: 2 },
  txAmount: { fontFamily: fonts.display, fontSize: 18, fontWeight: "500" },
}));
