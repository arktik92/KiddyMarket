import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Button } from "@/src/components/button";
import { PaymentSheet } from "@/src/components/payment-sheet";
import { useChildren, useProducts, type Product, type PurchaseItem } from "@/src/api";
import { formatEuros } from "@/src/format";
import { CATEGORY_FILTERS, type IoniconName } from "@/src/options";
import { fonts, makeStyles, useTheme } from "@/src/theme";

type CartLine = { product: Product; qty: number };

export default function Caisse() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const [category, setCategory] = useState("Tout");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [payOpen, setPayOpen] = useState(false);

  const { data: products, isLoading } = useProducts(category);
  const { data: children } = useChildren();

  const lines = Object.values(cart);
  const totalCents = useMemo(() => lines.reduce((s, l) => s + l.product.price_cents * l.qty, 0), [lines]);
  const totalItems = lines.reduce((s, l) => s + l.qty, 0);

  const add = (p: Product) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setCart((c) => ({ ...c, [p.id]: { product: p, qty: (c[p.id]?.qty ?? 0) + 1 } }));
  };
  const remove = (p: Product) => {
    setCart((c) => {
      const cur = c[p.id];
      if (!cur) return c;
      const next = { ...c };
      if (cur.qty <= 1) delete next[p.id];
      else next[p.id] = { product: p, qty: cur.qty - 1 };
      return next;
    });
  };

  const items: PurchaseItem[] = lines.map((l) => ({
    product_id: l.product.id,
    name: l.product.name,
    price_cents: l.product.price_cents,
    icon: l.product.icon,
    color: l.product.color,
    qty: l.qty,
  }));

  const barSpace = 96 + insets.bottom;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]} testID="caisse-screen">
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Caisse</Text>
          <Text style={styles.subtitle}>Compose le panier</Text>
        </View>
        <Pressable style={styles.exitBtn} onPress={() => router.replace("/")} testID="exit-parent-button">
          <Ionicons name="home" size={20} color={colors.onSurfaceTertiary} />
        </Pressable>
      </View>

      {/* Sticky category chips */}
      <View style={styles.chipRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipContent}
        >
          {CATEGORY_FILTERS.map((cat) => {
            const active = cat === category;
            return (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                style={[styles.chip, { backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary }]}
                testID={`category-${cat}`}
              >
                <Text style={[styles.chipText, { color: active ? colors.onBrandPrimary : colors.onSurfaceTertiary }]}>{cat}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : !products || products.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="storefront-outline" size={54} color={colors.brandSecondary} />
          <Text style={styles.muted}>Aucun produit ici. Ajoute-en dans la Boutique.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.grid, { paddingBottom: barSpace + 16 }]}>
          {products.map((p, idx) => {
            const qty = cart[p.id]?.qty ?? 0;
            return (
              <Animated.View key={p.id} entering={FadeInDown.delay(idx * 40)} style={styles.tileWrap}>
                <Pressable style={styles.tile} onPress={() => add(p)} testID={`product-tile-${p.id}`}>
                  <View style={[styles.tileIcon, { backgroundColor: p.color }]}>
                    <Ionicons name={p.icon as IoniconName} size={34} color="#FFFFFF" />
                    {qty > 0 ? (
                      <View style={styles.qtyBadge}>
                        <Text style={styles.qtyBadgeText}>{qty}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.tileName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.tilePrice}>{formatEuros(p.price_cents)}</Text>
                  {qty > 0 ? (
                    <Pressable style={styles.minusBtn} onPress={() => remove(p)} testID={`product-minus-${p.id}`} hitSlop={8}>
                      <Ionicons name="remove" size={16} color={colors.onSurface} />
                    </Pressable>
                  ) : null}
                </Pressable>
              </Animated.View>
            );
          })}
        </ScrollView>
      )}

      {/* Sticky pay bar */}
      {totalItems > 0 ? (
        <Animated.View entering={FadeInDown} style={[styles.payBar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.payInfo}>
            <Text style={styles.payCount}>{totalItems} article{totalItems > 1 ? "s" : ""}</Text>
            <Text style={styles.payTotal}>{formatEuros(totalCents)}</Text>
          </View>
          <Button label="Payer" icon="card" size="md" onPress={() => setPayOpen(true)} testID="pay-button" style={{ flex: 1 }} />
        </Animated.View>
      ) : null}

      <PaymentSheet
        visible={payOpen}
        onClose={() => setPayOpen(false)}
        onPaid={() => {
          setPayOpen(false);
          setCart({});
        }}
        items={items}
        totalCents={totalCents}
        kids={children ?? []}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  title: { fontFamily: fonts.display, fontSize: 30, fontWeight: "500", color: colors.onSurface },
  subtitle: { fontFamily: fonts.text, fontSize: 15, color: colors.muted, marginTop: 2 },
  exitBtn: { width: 44, height: 44, borderRadius: 999, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  chipRow: { height: 56, marginTop: 8 },
  chipContent: { gap: 10, paddingVertical: 10, paddingRight: 8 },
  chip: { height: 36, flexShrink: 0, paddingHorizontal: 18, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: fonts.text, fontSize: 15, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14, paddingTop: 6 },
  tileWrap: { width: "47%" },
  tile: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 22,
    padding: 16,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  tileIcon: { width: 64, height: 64, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  qtyBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: colors.surfaceSecondary,
  },
  qtyBadgeText: { fontFamily: fonts.display, fontSize: 13, fontWeight: "500", color: colors.onBrandPrimary },
  tileName: { fontFamily: fonts.display, fontSize: 17, fontWeight: "500", color: colors.onSurface },
  tilePrice: { fontFamily: fonts.text, fontSize: 15, fontWeight: "700", color: colors.brandSecondary },
  minusBtn: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  payBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  payInfo: { gap: 2 },
  payCount: { fontFamily: fonts.text, fontSize: 13, color: colors.muted },
  payTotal: { fontFamily: fonts.display, fontSize: 26, fontWeight: "500", color: colors.onSurface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  muted: { fontFamily: fonts.text, fontSize: 16, color: colors.muted, textAlign: "center", paddingHorizontal: 24 },
}));
