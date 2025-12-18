"use client";

import { useState } from "react";

type DiseaseProb = {
  name: string;
  probability: number;
};

type Step2Result = {
  disease_probabilities: DiseaseProb[];
  summary: string;
  immediate_actions: string[];
};

type PharmacyGuide = {
  sentences: string[];
};

interface Props {
  result: Step2Result;
  pharmacy_guide?: PharmacyGuide;
  disclaimer: string;
}

export default function Step2ResultCard({
  result,
  pharmacy_guide,
  disclaimer,
}: Props) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 420,
        background: "#0d0d0d",
        borderRadius: 18,
        padding: 18,
        color: "#fff",
        border: "3px solid #ffd400",
        marginBottom: 30,
      }}
    >
      {/* ======================
          판단 요약
      ====================== */}
      <h3 style={{ color: "#ffd400", marginBottom: 10 }}>
        📌 지금 상황 정리
      </h3>

      <p style={{ lineHeight: 1.6 }}>{result.summary}</p>

      {/* ======================
          원인 가능성 (참고용)
      ====================== */}
      {result.disease_probabilities.length > 0 && (
        <>
          <h4 style={{ marginTop: 18, color: "#aaa" }}>
            참고: 가능성 있는 원인
          </h4>
          {result.disease_probabilities.map((d) => (
            <div key={d.name} style={{ marginTop: 6, fontSize: 14 }}>
              • {d.name} ({Math.round(d.probability)}%)
            </div>
          ))}
        </>
      )}

      {/* ======================
          즉시 행동 가이드
      ====================== */}
      <div style={{ marginTop: 20, color: "#ff8888", fontWeight: 800 }}>
        🧭 지금 당장 이렇게 해보세요
      </div>
      <ul style={{ marginTop: 8, lineHeight: 1.6 }}>
        {result.immediate_actions.map((a, i) => (
          <li key={i}>- {a}</li>
        ))}
      </ul>

      {/* ======================
          🔥 농약방 가서 할 말 (핵심)
      ====================== */}
      {pharmacy_guide?.sentences &&
        pharmacy_guide.sentences.length > 0 && (
          <div
            style={{
              marginTop: 24,
              background: "#111",
              borderRadius: 14,
              padding: 14,
              border: "2px solid #00ff88",
            }}
          >
            <div
              style={{
                color: "#00ff88",
                fontWeight: 900,
                marginBottom: 8,
              }}
            >
              🗣️ 농약방 가서 이렇게 말하세요
            </div>
            <ul style={{ lineHeight: 1.7 }}>
              {pharmacy_guide.sentences.map((s, i) => (
                <li key={i}>“{s}”</li>
              ))}
            </ul>
          </div>
        )}

      {/* ======================
          책임 문구
      ====================== */}
      <div
        style={{
          marginTop: 18,
          fontSize: 12,
          color: "#aaa",
          borderTop: "1px solid #333",
          paddingTop: 10,
          lineHeight: 1.5,
        }}
      >
        ⚠️ {disclaimer}
      </div>
    </div>
  );
}