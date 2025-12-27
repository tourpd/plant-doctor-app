// app/data/productMeta.ts

export type ProductTier = "FREE" | "PAID";

/**
 * 🔒 베이스캠프 규칙
 * - signal은 string literal로만 사용
 * - 외부 타입 의존 제거
 */
export type ProductSignal =
  | "PEST_VECTOR"
  | "PATHOGEN_SPECIFIC"
  | "CONTAGIOUS"
  | "FUNGAL"
  | "VIRAL"
  | "PEST"
  | "NUTRIENT"
  | "WATER";

export type ProductMeta = {
  name: string;
  tier: ProductTier;
  signals: ProductSignal[];
};

export const PRODUCT_META: ProductMeta[] = [
  {
    name: "싹쓰리충",
    tier: "FREE",
    signals: ["PEST_VECTOR", "PEST"],
  },
  {
    name: "싹쓰리충 골드",
    tier: "PAID",
    signals: ["PEST_VECTOR", "PEST"],
  },
  {
    name: "멸규니",
    tier: "FREE",
    signals: ["PATHOGEN_SPECIFIC", "CONTAGIOUS", "FUNGAL"],
  },
];