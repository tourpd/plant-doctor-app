"use client";

import { useEffect, useMemo, useState } from "react";
import CheonggoQuestionCard from "./CheonggoQuestionCard";
import CheonggoDiagnosisResult from "./CheonggoDiagnosisResult";
import { CheonggoAnswer, CheonggoQuestion } from "./cheonggo.types";

const QUESTIONS: CheonggoQuestion[] = [
  { id: "suddenWilt", title: "고추가 갑자기 시들었나요?", options: [
    { value: "yes", label: "갑자기 시들었다" },
    { value: "no", label: "서서히 시들었다" },
    { value: "unknown", label: "잘 모르겠다" },
  ]},
  { id: "oneSideWilt", title: "한쪽부터 시들었나요?", options: [
    { value: "yes", label: "한 포기부터" },
    { value: "no", label: "여러 포기 동시에" },
    { value: "unknown", label: "모르겠다" },
  ]},
  { id: "stemSlime", title: "줄기에서 끈적임이 있나요?", options: [
    { value: "yes", label: "있다" },
    { value: "no", label: "없다" },
    { value: "unknown", label: "모르겠다" },
  ]},
  { id: "noRecovery", title: "회복이 전혀 없나요?", options: [
    { value: "yes", label: "전혀 없다" },
    { value: "no", label: "조금 회복됨" },
    { value: "unknown", label: "모르겠다" },
  ]},
];

type EngineLevel = "HIGH" | "MID" | "LOW";
type UiLevel = "CRITICAL" | "WARNING" | "LOW";

const mapLevel = (l: EngineLevel): UiLevel =>
  l === "HIGH" ? "CRITICAL" : l === "MID" ? "WARNING" : "LOW";

export default function CheonggoQuestionFlow() {
  const [answers, setAnswers] = useState<Record<string, CheonggoAnswer>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const idx = Object.keys(answers).length;
  const q = QUESTIONS[idx];

  const payload = useMemo(() => ({
    suddenWilt: answers.suddenWilt,
    oneSideWilt: answers.oneSideWilt,
    stemSlime: answers.stemSlime,
    noRecovery: answers.noRecovery,
    photoCount: 1,
  }), [answers]);

  useEffect(() => {
    if (q) return;
    if (!payload.noRecovery) return;

    setLoading(true);
    fetch("/api/pepper-decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(r => r.json())
      .then(d => setResult(d.result ?? d))
      .finally(() => setLoading(false));
  }, [q, payload]);

  if (loading) return <div>분석 중…</div>;

  if (result)
    return (
      <CheonggoDiagnosisResult
        level={mapLevel(result.level)}
        message={result.message}
        reasons={result.reasons}
      />
    );

  return q ? (
    <CheonggoQuestionCard
      question={q}
      onSelect={(v) => setAnswers(a => ({ ...a, [q.id]: v }))}
    />
  ) : null;
}