// app/data/diseaseSignalProfile.ts

import { SignalType } from "./signalWeights";

export type DiseaseSignalProfile = {
  label: string;
  signals: SignalType[];
};

export const DISEASE_SIGNAL_PROFILES: Record<string, DiseaseSignalProfile> = {
  /** 🐛 해충 피해 */
  PEST_DAMAGE: {
    label: "해충 피해 가능성",
    signals: [
      "PEST_VECTOR",        // 🔥 직접 증거 (필수)
      "INDIRECT",           // 흡즙/갉아먹음 흔적
    ],
  },

  /** 🦠 전염성 병해 */
  CONTAGIOUS_DISEASE: {
    label: "전염성 병해 가능성",
    signals: [
      "PATHOGEN_SPECIFIC",  // 🔥 병원균 의심 증거
      "CONTAGIOUS",         // 빠른 확산
      "INDIRECT",
    ],
  },

  /** 🍄 곰팡이·세균성 병해 */
  FUNGAL_BACTERIAL: {
    label: "곰팡이·세균성 병해 가능성",
    signals: [
      "PATHOGEN_SPECIFIC",
      "MOISTURE_RELATED",   // 습도/환경 연관
      "INDIRECT",
    ],
  },

  /** 🌱 환경·영양 스트레스 */
  ENV_STRESS: {
    label: "환경·영양 스트레스 가능성",
    signals: [
      "ENV_STRESS",         // 🔥 핵심
      "INDIRECT",
    ],
  },
};