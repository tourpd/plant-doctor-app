// app/lib/safeProductMixer.ts
import { SignalType } from "@/app/data/signalWeights";

export type ProductMeta = {
  name: string;
  signals: SignalType[];
  paid?: boolean; // 유료 노출 여부
};

type Options = {
  maxItems?: number;
  maxPaidRatio?: number; // 유료 최대 비율 (기본 33%)
};

export function mixProductsSafely(
  products: ProductMeta[],
  activeSignals: SignalType[],
  options: Options = {}
) {
  const { maxItems = 3, maxPaidRatio = 0.33 } = options;

  // signal 매칭
  const matched = products.filter((p) =>
    p.signals.some((s) => activeSignals.includes(s))
  );

  if (!matched.length) return [];

  // 유료 / 비유료 분리
  const paid = matched.filter((p) => p.paid);
  const free = matched.filter((p) => !p.paid);

  const maxPaid = Math.floor(maxItems * maxPaidRatio);

  const pickedPaid = paid.slice(0, maxPaid);
  const pickedFree = free.slice(0, maxItems - pickedPaid.length);

  return [...pickedPaid, ...pickedFree].slice(0, maxItems);
}