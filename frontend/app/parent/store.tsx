import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Button } from "@/src/components/button";
import { Input } from "@/src/components/input";
import { Sheet } from "@/src/components/sheet";
import { ColorPicker, IconPicker } from "@/src/components/pickers";
import { useToast } from "@/src/components/toast";
import {
  useCreateProduct,
  useDeleteProduct,
  useProducts,
  useUpdateProduct,
  type Product,
} from "@/src/api";
import { formatEuros, parseAmountToCents } from "@/src/format";
import { CATEGORIES, CATEGORY_FILTERS, PALETTE, PRODUCT_ICONS, type IoniconName } from "@/src/options";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export default function Store() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();

  const [category, setCategory] = useState("Tout");
  const { data: products, isLoading } = useProducts(category);

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [toDelete, setToDelete] = useState<Product | null>(null);

  // form fields
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [icon, setIcon] = useState<string>("pricetag");
  const [color, setColor] = useState<string>(PALETTE[1]);
  const [cat, setCat] = useState<string>(CATEGORIES[0]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setPrice("");
    setIcon("pricetag");
    setColor(PALETTE[1]);
    setCat(CATEGORIES[0]);
    setFormOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setName(p.name);
    setPrice((p.price_cents / 100).toFixed(2).replace(".", ","));
    setIcon(p.icon);
    setColor(p.color);
    setCat(p.category);
    setFormOpen(true);
  };

  const save = async () => {
    if (!name.trim()) return toast.show("Donne un nom au produit", "error");
    const cents = parseAmountToCents(price);
    if (cents === null || cents <= 0) return toast.show("Prix invalide", "error");
    const payload = { name: name.trim(), price_cents: cents, icon, color, category: cat };
    try {
      if (editing) {
        await updateProduct.mutateAsync({ id: editing.id, ...payload });
        toast.show("Produit modifié", "success");
      } else {
        await createProduct.mutateAsync(payload);
        toast.show("Produit ajouté", "success");
      }
      setFormOpen(false);
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteProduct.mutateAsync(toDelete.id);
      toast.show("Produit supprimé", "success");
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setToDelete(null);
    }
  };

  const saving = createProduct.isPending || updateProduct.isPending;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]} testID="store-screen">
      <Text style={styles.title}>Boutique</Text>

      <View style={styles.chipRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContent}>
          {CATEGORY_FILTERS.map((c) => {
            const active = c === category;
            return (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={[styles.chip, { backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary }]}
                testID={`store-category-${c}`}
              >
                <Text style={[styles.chipText, { color: active ? colors.onBrandPrimary : colors.onSurfaceTertiary }]}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.brandPrimary} /></View>
      ) : !products || products.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="pricetags-outline" size={54} color={colors.brandSecondary} />
          <Text style={styles.muted}>Ajoute ton premier produit !</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingTop: 6, paddingBottom: insets.bottom + 100 }}>
          {products.map((p, idx) => (
            <Animated.View key={p.id} entering={FadeInDown.delay(idx * 40)} style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: p.color }]}>
                <Ionicons name={p.icon as IoniconName} size={26} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{p.name}</Text>
                <Text style={styles.rowCat}>{p.category}</Text>
              </View>
              <Text style={styles.rowPrice}>{formatEuros(p.price_cents)}</Text>
              <Pressable style={styles.iconBtn} onPress={() => openEdit(p)} testID={`edit-product-${p.id}`} hitSlop={6}>
                <Ionicons name="create-outline" size={22} color={colors.onSurfaceTertiary} />
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => setToDelete(p)} testID={`delete-product-${p.id}`} hitSlop={6}>
                <Ionicons name="trash-outline" size={22} color={colors.error} />
              </Pressable>
            </Animated.View>
          ))}
        </ScrollView>
      )}

      <Pressable style={[styles.fab, { bottom: insets.bottom + 20 }]} onPress={openCreate} testID="add-product-fab">
        <Ionicons name="add" size={32} color={colors.onBrandPrimary} />
      </Pressable>

      {/* Create / edit form */}
      <Sheet visible={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Modifier le produit" : "Nouveau produit"} testID="product-form-sheet">
        <Input label="Nom" value={name} onChangeText={setName} placeholder="Ex. Pomme" testID="product-name-input" />
        <Input label="Prix (€)" value={price} onChangeText={setPrice} placeholder="Ex. 1,50" keyboardType="decimal-pad" testID="product-price-input" />
        <View style={{ gap: 8 }}>
          <Text style={styles.fieldLabel}>Icône</Text>
          <IconPicker icons={PRODUCT_ICONS} value={icon} color={color} onChange={setIcon} testID="product-icon-picker" />
        </View>
        <View style={{ gap: 8 }}>
          <Text style={styles.fieldLabel}>Couleur</Text>
          <ColorPicker colors={PALETTE} value={color} onChange={setColor} testID="product-color-picker" />
        </View>
        <View style={{ gap: 8 }}>
          <Text style={styles.fieldLabel}>Catégorie</Text>
          <View style={styles.catWrap}>
            {CATEGORIES.map((c) => {
              const active = c === cat;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCat(c)}
                  style={[styles.catChip, { backgroundColor: active ? colors.brandSecondary : colors.surfaceTertiary }]}
                  testID={`product-cat-${c}`}
                >
                  <Text style={[styles.catChipText, { color: active ? colors.onBrandSecondary : colors.onSurfaceTertiary }]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Button label={saving ? "Enregistrement..." : "Enregistrer"} icon="save" disabled={saving} onPress={save} testID="save-product-button" />
      </Sheet>

      {/* Delete confirmation */}
      <Sheet visible={!!toDelete} onClose={() => setToDelete(null)} title="Supprimer ce produit ?" testID="delete-product-sheet">
        <Text style={styles.confirmText}>Es-tu sûr de vouloir supprimer « {toDelete?.name} » ?</Text>
        <Button label="Supprimer" icon="trash" variant="danger" onPress={confirmDelete} testID="confirm-delete-product-button" />
        <Button label="Annuler" variant="ghost" size="md" onPress={() => setToDelete(null)} />
      </Sheet>
    </View>
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
    padding: 12,
  },
  rowIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  rowName: { fontFamily: fonts.display, fontSize: 18, fontWeight: "500", color: colors.onSurface },
  rowCat: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, marginTop: 2 },
  rowPrice: { fontFamily: fonts.text, fontSize: 16, fontWeight: "700", color: colors.brandSecondary, marginRight: 4 },
  iconBtn: { padding: 6 },
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
  fieldLabel: { fontFamily: fonts.text, fontSize: 15, fontWeight: "600", color: colors.onSurfaceTertiary, marginLeft: 4 },
  catWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 4 },
  catChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  catChipText: { fontFamily: fonts.text, fontSize: 14, fontWeight: "700" },
  confirmText: { fontFamily: fonts.text, fontSize: 16, color: colors.onSurface, textAlign: "center", paddingVertical: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  muted: { fontFamily: fonts.text, fontSize: 16, color: colors.muted, textAlign: "center" },
}));
