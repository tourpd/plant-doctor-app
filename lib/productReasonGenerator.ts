// app/lib/productReasonGenerator.ts

const TEMPLATES: Record<string, string[]> = {
  PEST_VECTOR: [
    "해충 매개 신호가 반복적으로 확인되었습니다.",
    "이 신호에서는 해충 관리 목적의 자재가 함께 검토됩니다.",
  ],
  PATHOGEN_SPECIFIC: [
    "병반 형태가 특정 병원체 신호와 겹칩니다.",
    "현장에서는 병원체 확산을 고려한 자재가 검토됩니다.",
  ],
  CONTAGIOUS: [
    "주변 개체로 확산될 가능성이 있는 신호가 보입니다.",
    "이 경우 확산 관리 관점의 자재가 함께 언급됩니다.",
  ],
};

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateProductReason(
  productName: string,
  signalTypes: string[],
  signalScore: number
) {
  const mainSignal = signalTypes[0];
  const base =
    TEMPLATES[mainSignal] ??
    ["현재 신호를 기준으로 현장 참고 사례가 있습니다."];

  const strength =
    signalScore >= 6
      ? "신호 강도가 비교적 뚜렷합니다."
      : signalScore >= 3.5
      ? "신호가 일부 확인됩니다."
      : "초기 단계로 보입니다.";

  return `${pick(base)} ${strength} 이 신호 조합에서는 ‘${productName}’이 함께 검토되는 경우가 있습니다.`;
}