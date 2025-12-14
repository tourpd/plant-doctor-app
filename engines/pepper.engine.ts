// engines/pepper.engine.ts

export type PepperDecisionInput = {
  suddenWilt: "yes" | "no" | "unknown";
  oneSideWilt: "yes" | "no" | "unknown";
  stemSlime: "yes" | "no" | "unknown";
  noRecovery: "yes" | "no" | "unknown";
  photoCount: number;
};

export type PepperDecisionResult = {
  level: "HIGH" | "MID" | "LOW";
  message: string;
  reasons: string[];
};

export default function pepperEngineDecision(
  input: PepperDecisionInput
): PepperDecisionResult {
  const reasons: string[] = [];

  if (input.suddenWilt === "yes") reasons.push("갑작스러운 시들음 발생");
  if (input.oneSideWilt === "yes") reasons.push("한쪽부터 시들기 시작");
  if (input.stemSlime === "yes") reasons.push("줄기 점액 확인");
  if (input.noRecovery === "yes") reasons.push("회복 징후 없음");

  if (reasons.length >= 3) {
    return {
      level: "HIGH",
      message: "청고병 가능성이 매우 높습니다.",
      reasons,
    };
  }

  if (reasons.length === 2) {
    return {
      level: "MID",
      message: "청고병이 의심됩니다.",
      reasons,
    };
  }

  return {
    level: "LOW",
    message: "청고병 가능성은 낮아 보입니다.",
    reasons,
  };
}