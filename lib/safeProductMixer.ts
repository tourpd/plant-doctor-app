// lib/safeProductMixer.ts

import type { ProductMeta } from "@/app/data/productMeta";

/**
 * 🔒 베이스캠프 규칙
 * - ProductMeta 타입의 단일 출처는 app/data/productMeta
 * - lib에서는 재정의 절대 금지
 */

type MixOptions = {
  maxItems: number;
  maxPaidRatio?: number;
};

export function mixProductsSafely(
  products: ProductMeta[],
  activeSignals: string[],
  options: MixOptions
) {
  const { maxItems } = options;

  return products
    .filter((p) =>
      p.signals.some((s) => activeSignals.includes(s))
    )
    .slice(0, maxItems);
}