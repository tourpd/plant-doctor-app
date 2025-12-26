// lib/extractSignalsFromAnswers.ts

import { SignalType } from "@/app/data/signalWeights";

/**
 * 농민 자유 입력 → 보조 Signal 추출
 * 원칙:
 * - 농민 언어는 '증거 힌트'
 * - 단정 ❌, 방향성만 강화
 */
export function extractSignalsFromAnswers(
  answers: { qid: string; answer: string | string[] }[]
): SignalType[] {
  const signals = new Set<SignalType>();

  for (const a of answers) {
    if (typeof a.answer !== "string") continue;
    const text = normalize(a.answer);

    // 🔥 병해(곰팡이/탄저/역병 등)
    if (
      text.includes("탄저") ||
      text.includes("곰팡이") ||
      text.includes("반점") ||
      text.includes("썩") ||
      text.includes("물러")
    ) {
      signals.add("PATHOGEN_SPECIFIC");
    }

    // 🔥 확산/전염
    if (
      text.includes("번진") ||
      text.includes("확산") ||
      text.includes("옮")
    ) {
      signals.add("CONTAGIOUS");
    }

    // 🐛 해충
    if (
      text.includes("벌레") ||
      text.includes("진딧물") ||
      text.includes("응애") ||
      text.includes("총채")
    ) {
      signals.add("PEST_VECTOR");
    }

    // 🌱 환경/영양
    if (
      text.includes("비료") ||
      text.includes("관수") ||
      text.includes("물") ||
      text.includes("온도") ||
      text.includes("가뭄") ||
      text.includes("냉해")
    ) {
      signals.add("ENV_STRESS");
    }
  }

  return Array.from(signals);
}

function normalize(v: string) {
  return v.trim().replace(/\s+/g, "").toLowerCase();
}
