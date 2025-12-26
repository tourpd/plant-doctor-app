import { SignalType } from "./signalWeights";

/**
 * STEP1은
 * - 사진 기반 1차 분기
 * - 해충 / 병해 / 환경 스트레스의 방향성만 잡는다
 * - 확진, 처방, 제품 연결 절대 금지
 */

export type Step1ChoiceSignal = {
  choice: string;
  signals: SignalType[];
};

export type Step1Question = {
  id: string;
  text: string;
  choices: Step1ChoiceSignal[];
  priority: number; // 숫자가 낮을수록 먼저 질문
};

/**
 * =========================
 * STEP1 질문 세트 (최대 5개)
 * =========================
 * 원칙:
 * - 농민이 “사진 보면서 바로 답할 수 있는 질문”
 * - 벌레가 보이면 무조건 그쪽부터
 * - 애매하면 INDIRECT로 빠져 다음 질문 유도
 */
export const STEP1_QUESTIONS: Step1Question[] = [
  {
    id: "q_pest_presence",
    priority: 1,
    text: "사진에서 잎이나 줄기에 직접 보이는 것이 있나요?",
    choices: [
      { choice: "벌레가 직접 보인다", signals: ["PEST_VECTOR"] },
      { choice: "벌레는 안 보이지만 갉아먹은 흔적이 있다", signals: ["PEST_VECTOR"] },
      { choice: "특별한 흔적은 보이지 않는다", signals: ["INDIRECT"] },
    ],
    free_input: {
      placeholder: "예: 잎 뒷면에 작은 벌레가 몇 마리 보였어요",
      hint: "색, 크기, 움직임 등 기억나는 걸 적어주세요",
    },
  },

  {
    id: "q_spread_speed",
    priority: 2,
    text: "이 증상은 주변으로 퍼지는 느낌이 있나요?",
    choices: [
      { choice: "주변 포기나 잎으로 빠르게 번진다", signals: ["CONTAGIOUS"] },
      { choice: "한두 잎이나 특정 부위에만 있다", signals: ["INDIRECT"] },
      { choice: "아직 퍼진다고 느끼진 않는다", signals: ["INDIRECT"] },
    ],
    free_input: {
      placeholder: "예: 어제는 괜찮았는데 오늘 확 늘었어요",
      hint: "언제부터, 얼마나 달라졌는지 적어주세요",
    },
  },

  {
    id: "q_tissue_damage",
    priority: 3,
    text: "잎이나 줄기의 조직 상태는 어떤가요?",
    choices: [
      { choice: "구멍이 나거나 가장자리가 갉혀 있다", signals: ["PEST_VECTOR"] },
      { choice: "반점, 물러짐, 썩음처럼 번진다", signals: ["PATHOGEN_SPECIFIC"] },
      { choice: "색만 변하고 조직은 멀쩡하다", signals: ["ENV_STRESS"] },
    ],
    free_input: {
      placeholder: "예: 가장자리부터 누렇게 변해요",
      hint: "어디부터 어떻게 변했는지 적어주세요",
    },
  },

  {
    id: "q_growth_point",
    priority: 4,
    text: "새순이나 생장점은 어떤 상태인가요?",
    choices: [
      { choice: "새순이 뒤틀리거나 멈춘 느낌이다", signals: ["PEST_VECTOR"] },
      { choice: "새순은 정상인데 아래 잎만 문제다", signals: ["ENV_STRESS"] },
      { choice: "전체적으로 힘이 없어 보인다", signals: ["ENV_STRESS"] },
    ],
    free_input: {
      placeholder: "예: 새잎이 작고 말려요",
      hint: "평소와 다른 점을 적어주세요",
    },
  },

  {
    id: "q_recent_change",
    priority: 5,
    text: "최근 1주일 안에 농사 환경 변화가 있었나요?",
    choices: [
      { choice: "비료·영양제·농약을 새로 넣었다", signals: ["ENV_STRESS"] },
      { choice: "관수·온도·환기 조건이 크게 바뀌었다", signals: ["ENV_STRESS"] },
      { choice: "특별한 변화는 없었다", signals: ["INDIRECT"] },
    ],
    free_input: {
      placeholder: "예: 비 온 뒤 물이 오래 고였어요",
      hint: "기억나는 변화가 있으면 자유롭게 적어주세요",
    },
  },
];