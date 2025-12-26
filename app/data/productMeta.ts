export type ProductTier = "FREE" | "PAID";

export type ProductMeta = {
  name: string;
  tier: ProductTier;
  signals: string[];
};

export const PRODUCT_META: ProductMeta[] = [
  { name: "싹쓰리충", tier: "FREE", signals: ["PEST_VECTOR"] },
  { name: "싹쓰리충 골드", tier: "PAID", signals: ["PEST_VECTOR"] },
  { name: "멸규니", tier: "FREE", signals: ["PATHOGEN_SPECIFIC", "CONTAGIOUS"] },
];