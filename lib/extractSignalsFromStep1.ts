// lib/extractSignalsFromStep1.ts

import { STEP1_QUESTIONS } from "@/app/data/step1SignalMap";
import { SignalType } from "@/app/data/signalWeights";

/**
 * STEP1 답변 → Signal 추출 (최종 안정판)
 *
 * 핵심 원칙
 * 1. 질문 개수 ❌ → "증거 선택"만 signal 생성
 * 2. 동일 signal 중복 ❌ (Set 기반)
 * 3. DIRECT 신호(PEST/DISEASE)는 ENV에 의해 절대 제거되지 않음
 * 4. 의미 없는 답변("모르겠다" 등)은 signal 생성 안 함
 */
export function extractSignalsFromStep1(
  answers: {
    qid: string;
    answer: string | string[];
  }[]
): SignalType[] {
  const signalSet = new Set<SignalType>();

  for (const a of answers) {
    const q = STEP1_QUESTIONS.find((q) => q.id === a.qid);
    if (!q) continue;

    const selectedAnswers = Array.isArray(a.answer)
      ? a.answer
      : [a.answer];

    for (const raw of selectedAnswers) {
      const answerText = normalize(raw);

      // ❌ 의미 없는 선택지는 signal 생성 안 함
      if (isIgnorableAnswer(answerText)) continue;

      const choice = q.choices.find(
        (c) => normalize(c.choice) === answerText
      );

      if (!choice || !Array.isArray(choice.signals)) continue;

      for (const sig of choice.signals) {
        signalSet.add(sig);
      }
    }
  }

  // 🔒 DIRECT 신호 보호 로직
  const hasDirect =
    signalSet.has("PEST_VECTOR" as SignalType) ||
    signalSet.has("PATHOGEN_SPECIFIC" as SignalType);

  if (hasDirect) {
    // ENV 계열 신호가 DIRECT 판단을 덮지 못하게 제한
    for (const sig of Array.from(signalSet)) {
      if (isEnvironmentSignal(sig)) {
        signalSet.delete(sig);
      }
    }
  }

  return Array.from(signalSet);
}

/* ======================
   헬퍼
====================== */

// 공백/대소문자/조사 차이 흡수
function normalize(v: string) {
  return v
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

// signal 생성에서 제외할 답변들
function isIgnorableAnswer(v: string) {
  return (
    v === "" ||
    v.includes("모르") ||
    v.includes("해당없") ||
    v.includes("잘모르")
  );
}

// 환경/영양 스트레스 계열 판별
function isEnvironmentSignal(sig: SignalType) {
  return (
    sig === "ENV_STRESS" ||
    sig === "NUTRIENT_IMBALANCE" ||
    sig === "WATER_STRESS"
  );
}