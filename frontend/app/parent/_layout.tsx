import React from "react";
import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { fonts, useTheme } from "@/src/theme";

export default function ParentLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: fonts.text, fontSize: 12, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Caisse",
          tabBarIcon: ({ color, size }) => <Ionicons name="cart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          title: "Boutique",
          tabBarIcon: ({ color, size }) => <Ionicons name="storefront" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="children"
        options={{
          title: "Enfants",
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Historique",
          tabBarIcon: ({ color, size }) => <Ionicons name="time" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
