// app/api/vision/utils/resolveAmbiguousCause.ts

type Cause = {
  name: string;
  probability: number;
};

export function resolveAmbiguousCause({
  primaryCategory,
  possibleCauses,
  confidence,
}: {
  primaryCategory?: "PEST" | "DISEASE" | "ENVIRONMENT";
  possibleCauses?: Cause[];
  confidence?: number;
}) {
  if (!possibleCauses || possibleCauses.length < 2) return false;

  const hasPest = possibleCauses.some(c =>
    ["진딧물", "응애", "총채벌레", "해충"].some(k => c.name.includes(k))
  );

  const hasDisease = possibleCauses.some(c =>
    ["곰팡이", "잿빛곰팡이", "노균병", "흰가루"].some(k => c.name.includes(k))
  );

  // 🔑 핵심 조건
  if (
    hasPest &&
    hasDisease &&
    confidence !== undefined &&
    confidence >= 50 &&
    confidence <= 85
  ) {
    return true;
  }

  return false;
}
