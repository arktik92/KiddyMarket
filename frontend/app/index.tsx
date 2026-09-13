import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Avatar } from "@/src/components/avatar";
import { Button } from "@/src/components/button";
import { useChildren } from "@/src/api";
import { formatEuros } from "@/src/format";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export default function ProfileSelection() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { data: children, isLoading, isError, refetch } = useChildren();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]} testID="profile-selection">
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <View style={styles.logoBadge}>
            <Ionicons name="card" size={26} color={colors.onBrandPrimary} />
          </View>
          <Text style={styles.brand}>KiddyMarket</Text>
        </View>
        <Text style={styles.subtitle}>Qui es-tu ?</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
          <Text style={styles.muted}>Chargement...</Text>
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline" size={54} color={colors.muted} />
          <Text style={styles.muted}>Impossible de charger les profils.</Text>
          <Button label="Réessayer" variant="secondary" size="md" onPress={() => refetch()} testID="retry-button" />
        </View>
      ) : !children || children.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-circle" size={64} color={colors.brandSecondary} />
          <Text style={styles.emptyTitle}>Aucun profil pour l'instant</Text>
          <Text style={styles.muted}>Demande à tes parents de créer ton profil !</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        >
          {children.map((child, idx) => (
            <Animated.View key={child.id} entering={FadeInDown.delay(idx * 80).springify()} style={styles.cardWrap}>
              <Pressable
                style={styles.card}
                onPress={() => router.push(`/child/${child.id}`)}
                testID={`child-card-${child.id}`}
              >
                <Avatar icon={child.avatar_icon} color={child.color} size={92} />
                <Text style={styles.childName}>{child.name}</Text>
                <View style={styles.balancePill}>
                  <Ionicons name="wallet" size={14} color={colors.onSurfaceTertiary} />
                  <Text style={styles.balanceText}>{formatEuros(child.balance_cents)}</Text>
                </View>
              </Pressable>
            </Animated.View>
          ))}
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button
          label="Accès Parent"
          icon="lock-closed"
          variant="ghost"
          onPress={() => router.push("/pin")}
          testID="parent-access-button"
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: 20 },
  header: { marginBottom: 24 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { fontFamily: fonts.display, fontSize: 30, fontWeight: "500", color: colors.onSurface },
  subtitle: { fontFamily: fonts.display, fontSize: 22, color: colors.muted, marginTop: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 16, paddingVertical: 8 },
  cardWrap: { width: "47%" },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 24,
    paddingVertical: 24,
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  childName: { fontFamily: fonts.display, fontSize: 22, fontWeight: "500", color: colors.onSurface },
  balancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  balanceText: { fontFamily: fonts.text, fontSize: 15, fontWeight: "700", color: colors.onSurfaceTertiary },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  muted: { fontFamily: fonts.text, fontSize: 16, color: colors.muted, textAlign: "center" },
  emptyTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.onSurface },
  footer: { paddingTop: 12 },
}));
