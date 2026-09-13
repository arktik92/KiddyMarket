// Circular child avatar: a friendly icon inside a colored ring.
import React from "react";
import { View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import type { IoniconName } from "@/src/options";

export function Avatar({
  icon,
  color,
  size = 72,
  selected = false,
}: {
  icon: string;
  color: string;
  size?: number;
  selected?: boolean;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: selected ? 4 : 0,
        borderColor: "#FFFFFF",
        shadowColor: color,
        shadowOpacity: 0.35,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        elevation: 4,
      }}
    >
      <Ionicons name={icon as IoniconName} size={size * 0.5} color="#FFFFFF" />
    </View>
  );
}
