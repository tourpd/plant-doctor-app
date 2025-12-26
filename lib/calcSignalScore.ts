// lib/calcSignalScore.ts

import { SIGNAL_WEIGHTS, SignalType } from "@/app/data/signalWeights";

/**
 * possible_causes에 쓰일 결과 타입
 */
export type PossibleCause = {
  name: string;
  probability: number; // 0~100
  why: string;
};

/**
 * calcSignalScoreAndTop3
 *
 * 🔥 설계 철학 (최종)
 * 1. 증거 있는 놈이 이긴다 (DIRECT > INDIRECT)
 * 2. 환경은 절대 단독 1등 불가
 * 3. 질문 수로 점수 쌓이지 않는다
 * 4. 확률은 상대 비교이지 절대 진단이 아니다
 */
export function calcSignalScoreAndTop3(
  signals: SignalType[]
): {
  signalScore: number;
  possible_causes: PossibleCause[];
} {
  /**
   * 1️⃣ 카테고리별 점수 버킷
   */
  const buckets: Record<"PEST" | "DISEASE" | "ENVIRONMENT", number> = {
    PEST: 0,
    DISEASE: 0,
    ENVIRONMENT: 0,
  };

  /**
   * 2️⃣ signal → 점수 누적
   */
  for (const s of signals) {
    const w = SIGNAL_WEIGHTS[s] ?? 0;

    switch (s) {
      case "PEST_VECTOR":
        buckets.PEST += w;
        break;

      case "PATHOGEN_SPECIFIC":
      case "CONTAGIOUS":
        buckets.DISEASE += w;
        break;

      case "MOISTURE_RELATED":
      case "ENV_STRESS":
        buckets.ENVIRONMENT += w;
        break;

      case "INDIRECT":
      default:
        // 간접 증거는 약하게만 반영
        buckets.PEST += w * 0.1;
        buckets.DISEASE += w * 0.1;
        buckets.ENVIRONMENT += w * 0.1;
        break;
    }
  }

  /**
   * 3️⃣ DIRECT 증거 탐지
   */
  const hasDirectPest = signals.includes("PEST_VECTOR");
  const hasDirectDisease = signals.includes("PATHOGEN_SPECIFIC");

  /**
   * 4️⃣ 환경 폭주 방패 (강화)
   */
  if (hasDirectPest || hasDirectDisease) {
    // ENV는 절대 1등 불가
    const directMax = Math.max(buckets.PEST, buckets.DISEASE);
    buckets.ENVIRONMENT = Math.min(buckets.ENVIRONMENT, directMax * 0.45);
  }

  /**
   * 5️⃣ 결과 정렬
   */
  let rawResults = [
    { name: "해충 가능성", key: "PEST", score: buckets.PEST },
    { name: "병해 가능성", key: "DISEASE", score: buckets.DISEASE },
    { name: "환경·영양 스트레스", key: "ENVIRONMENT", score: buckets.ENVIRONMENT },
  ].filter((r) => r.score > 0);

  // DIRECT 존재 시 ENV 1등 제거
  if (hasDirectPest || hasDirectDisease) {
    rawResults = rawResults.sort((a, b) => {
      if (a.key === "ENVIRONMENT") return 1;
      if (b.key === "ENVIRONMENT") return -1;
      return b.score - a.score;
    });
  } else {
    rawResults = rawResults.sort((a, b) => b.score - a.score);
  }

  rawResults = rawResults.slice(0, 3);

  /**
   * 6️⃣ 확률 계산 (상대 비교)
   */
  const totalScore =
    rawResults.reduce((sum, r) => sum + r.score, 0) || 1;

  let possible_causes: PossibleCause[] = rawResults.map((r) => ({
    name: r.name,
    probability: Math.round((r.score / totalScore) * 100),
    why: buildWhy(r.key as any, signals),
  }));

  /**
   * 7️⃣ ENV 단독 확률 상한
   */
  if ((hasDirectPest || hasDirectDisease) && possible_causes.length > 0) {
    const env = possible_causes.find((p) => p.name.includes("환경"));
    if (env && env.probability > 45) {
      env.probability = 45;
    }
  }

  /**
   * 8️⃣ signalScore (판단 강도)
   * - DIRECT 있으면 DIRECT 기준
   * - 없으면 ENV 기준
   */
  const signalScore = hasDirectPest
    ? Math.round(buckets.PEST)
    : hasDirectDisease
    ? Math.round(buckets.DISEASE)
    : Math.round(buckets.ENVIRONMENT);

  return {
    signalScore,
    possible_causes,
  };
}

/**
 * 왜 그렇게 판단했는지 설명
 */
function buildWhy(
  category: "PEST" | "DISEASE" | "ENVIRONMENT",
  signals: SignalType[]
): string {
  switch (category) {
    case "PEST":
      return signals.includes("PEST_VECTOR")
        ? "사진과 답변에서 해충의 직접적인 흔적이 확인되었습니다."
        : "해충 활동과 연관된 간접 신호가 일부 관찰됩니다.";

    case "DISEASE":
      return signals.includes("PATHOGEN_SPECIFIC")
        ? "병반 형태와 확산 양상이 병해 신호와 겹칩니다."
        : "병해로 이어질 수 있는 조건이 관찰됩니다.";

    case "ENVIRONMENT":
      return "수분, 온도, 영양 등 재배 환경 변화에 따른 스트레스 가능성이 있습니다.";

    default:
      return "";
  }
}