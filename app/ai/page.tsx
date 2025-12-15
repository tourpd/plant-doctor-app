"use client";

import { useState } from "react";

/* ======================
   타입 정의 (API 실제 구조 기준)
====================== */

type Question = {
  id: string;
  question: string;
  choices: string[];
};

type CropInfo = {
  name: string;
  confidence: number;
  message: string;
};

type VisionResult = {
  ok: boolean;
  step?: "STEP1" | "STEP2";

  // STEP1
  crop?: CropInfo;
  observations?: string[];
  lead_message?: string;
  questions?: Question[];

  // STEP2
  result?: {
    summary: string;
    disease_probabilities: { name: string; probability: number }[];
    immediate_actions: string[];
  };

  products?: {
    chemical: string[];
    eco: string[];
    organic: string[];
  };

  disclaimer?: string;
  error?: string;
};

/* ======================
   페이지
====================== */

export default function AiPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<VisionResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ id: string; choice: string }[]>([]);

  /* ======================
     파일 선택
  ====================== */
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResult(null);
    setCurrentQuestionIndex(0);
    setAnswers([]);

    if (preview) URL.revokeObjectURL(preview);
    if (f) setPreview(URL.createObjectURL(f));
  };

  /* ======================
     STEP1
  ====================== */
  const handleDiagnose = async () => {
    if (!file) return alert("사진을 먼저 선택해주세요");

    setLoading(true);
    setResult(null);
    setCurrentQuestionIndex(0);
    setAnswers([]);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/vision", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setResult(data);
    } catch {
      alert("AI 진단 오류");
    } finally {
      setLoading(false);
    }
  };

  /* ======================
     STEP2
  ====================== */
  const handleFinalStep2 = async (
    finalAnswers: { id: string; choice: string }[]
  ) => {
    if (!file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("answers", JSON.stringify(finalAnswers));

      const res = await fetch("/api/vision", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setResult(data);
    } catch {
      alert("최종 진단 오류");
    } finally {
      setLoading(false);
    }
  };

  /* ======================
     UI
  ====================== */
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        padding: 24,
        paddingBottom: 120,
        color: "#fff",
      }}
    >
      {/* ===== 타이틀 영역 ===== */}
      <h1 style={{ color: "#00ff88", fontSize: 28, fontWeight: 900 }}>
        포토닥터
      </h1>

      {/* ✅ 한국농수산TV 제작 문구 (항상 고정) */}
      <p
        style={{
          marginTop: 6,
          fontSize: 14,
          color: "#aaa",
          fontWeight: 600,
        }}
      >
        한국농수산TV가 농민을 위해 만든 AI 진단 서비스입니다.
      </p>

      {/* 업로드 */}
      <label
        style={{
          display: "block",
          marginTop: 20,
          padding: 24,
          border: "3px dashed #00ff88",
          borderRadius: 20,
          textAlign: "center",
          fontSize: 20,
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
        📸 사진 선택
        <input type="file" hidden accept="image/*" onChange={handleFile} />
      </label>

      {preview && (
        <img
          src={preview}
          style={{
            width: "100%",
            maxWidth: 420,
            marginTop: 16,
            borderRadius: 20,
            border: "3px solid #00ff88",
          }}
        />
      )}

      <button
        onClick={handleDiagnose}
        disabled={loading}
        style={{
          width: "100%",
          maxWidth: 420,
          height: 64,
          marginTop: 20,
          background: "#00cc44",
          borderRadius: 20,
          border: "none",
          fontSize: 22,
          fontWeight: 900,
        }}
      >
        {loading ? "분석 중..." : "🧠 AI 진단 시작"}
      </button>

      {/* STEP1 질문 */}
      {result?.step === "STEP1" && result.questions && (
        <div
          style={{
            marginTop: 36,
            padding: 32,
            borderRadius: 28,
            border: "4px solid #00bfff",
          }}
        >
          <p style={{ fontSize: 26, fontWeight: 900 }}>
            {result.questions[currentQuestionIndex].question}
          </p>

          {result.questions[currentQuestionIndex].choices.map((c, i) => (
            <button
              key={i}
              onClick={() => {
                const next = [
                  ...answers,
                  {
                    id: result.questions![currentQuestionIndex].id,
                    choice: c,
                  },
                ];
                setAnswers(next);

                if (
                  currentQuestionIndex <
                  result.questions!.length - 1
                ) {
                  setCurrentQuestionIndex(currentQuestionIndex + 1);
                } else {
                  handleFinalStep2(next);
                }
              }}
              style={{
                width: "100%",
                marginTop: 18,
                padding: 24,
                fontSize: 22,
                fontWeight: 900,
                borderRadius: 20,
                border: "3px solid #00bfff",
                background: "#000",
                color: "#00bfff",
                textAlign: "left",
              }}
            >
              👉 {c}
            </button>
          ))}
        </div>
      )}

      {/* STEP2 결과 */}
      {result?.step === "STEP2" && result.result && (
        <div
          style={{
            marginTop: 36,
            padding: 28,
            borderRadius: 24,
            background: "#111",
            border: "3px solid #ffd400",
          }}
        >
          <h2 style={{ fontSize: 24, fontWeight: 900 }}>
            📌 {result.crop?.name ?? "해당 작물"} 최종 처방
          </h2>

          <p style={{ marginTop: 12 }}>{result.result.summary}</p>

          <h3 style={{ marginTop: 20 }}>📊 원인 가능성</h3>
          <ul>
            {result.result.disease_probabilities.map((d, i) => (
              <li key={i}>
                {d.name} ({Math.round(d.probability * 100)}%)
              </li>
            ))}
          </ul>

          <h3 style={{ marginTop: 20 }}>🧭 즉시 조치</h3>
          <ul>
            {result.result.immediate_actions.map((a, i) => (
              <li key={i}>• {a}</li>
            ))}
          </ul>

          {result.products && (
            <>
              <h3 style={{ marginTop: 20 }}>🧪 농약</h3>
              <ul>{result.products.chemical.map(p => <li key={p}>{p}</li>)}</ul>

              <h3>🌱 친환경</h3>
              <ul>{result.products.eco.map(p => <li key={p}>{p}</li>)}</ul>

              <h3>🍀 유기농</h3>
              <ul>{result.products.organic.map(p => <li key={p}>{p}</li>)}</ul>
            </>
          )}

          {result.disclaimer && (
            <p style={{ marginTop: 16, color: "#aaa", fontSize: 13 }}>
              ⚠️ {result.disclaimer}
            </p>
          )}

          <button
            onClick={() =>
              window.open(
                "https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform",
                "_blank"
              )
            }
            style={{
              width: "100%",
              marginTop: 24,
              height: 56,
              background: "#ff2b2b",
              borderRadius: 16,
              border: "none",
              fontSize: 18,
              fontWeight: 900,
              color: "#fff",
            }}
          >
            🚨 농사 119 출동 요청
          </button>
        </div>
      )}
    </main>
  );
}