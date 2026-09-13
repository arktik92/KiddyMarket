// Curated option sets for avatars, product icons, colors, categories.
import { Ionicons } from "@react-native-vector-icons/ionicons";

export type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

export const PALETTE: string[] = [
  "#FF6B6B", // coral
  "#4ECDC4", // mint
  "#FFE66D", // sunny
  "#4D96FF", // sky
  "#A66CFF", // grape
  "#FF9F45", // orange
  "#59CE8F", // grass
  "#FF6FB5", // pink
];

// Animal / friendly icons for child avatars.
export const AVATAR_ICONS: IoniconName[] = [
  "paw",
  "fish",
  "bug",
  "leaf",
  "rocket",
  "star",
  "heart",
  "happy",
  "flower",
  "planet",
];

// Icons for products.
export const PRODUCT_ICONS: IoniconName[] = [
  "nutrition",
  "ice-cream",
  "pizza",
  "wine",
  "fast-food",
  "cafe",
  "game-controller",
  "car-sport",
  "football",
  "book",
  "musical-notes",
  "brush",
  "balloon",
  "gift",
  "star",
  "pricetag",
];

export const CATEGORIES: string[] = ["Alimentation", "Jeux", "Livres", "Autre"];
export const CATEGORY_FILTERS: string[] = ["Tout", ...CATEGORIES];
