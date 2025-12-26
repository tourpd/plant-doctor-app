// lib/getNextStep1Question.ts
import { STEP1_QUESTIONS, type Step1Question } from "@/app/data/step1SignalMap";

export type Step1HistoryAnswer = {
  qid: string;
  answer: string | string[];
};

const TARGET = 4;

// 아직 안 물어본 질문을 순서대로 1개만 반환
export function getNextStep1Question(history: Step1HistoryAnswer[]): Step1Question | null {
  const asked = new Set((history || []).map((h) => h.qid));
  const next = STEP1_QUESTIONS.find((q) => !asked.has(q.id));
  if (!next) return null;

  // target 초과 방지(4개까지만)
  if ((history?.length || 0) >= TARGET) return null;

  return {
    id: next.id,
    text: next.text,
    choices: next.choices.map((c) => c.choice),
  };
}