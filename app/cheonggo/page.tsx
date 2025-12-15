"use client";

import { useState } from "react";

/* ======================
   타입
====================== */
type Step1Result = {
  ok: boolean;
  crop: string;
  observations: string[];
  why_uncertain: string;
  questions: { id: string; text: string }[];
  immediate_guidance: string[];
};

type Step2Result = {
  ok: boolean;
  risk_level: "LOW" | "WARNING" | "CRITICAL";
  summary: string;
  actions: string[];
};

export default function Page() {
  const [cropName, setCropName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [step1, setStep1] = useState<Step1Result | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step2, setStep2] = useState<Step2Result | null>(null);

  const [loading, setLoading] = useState(false);

  /* ======================
     파일 처리
  ====================== */
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setStep1(null);
    setStep2(null);
    setAnswers({});
  };

  /* ======================
     STEP 1 실행
  ====================== */
  const handleAnalyze = async () => {
    if (!cropName.trim()) {
      alert("작물명을 입력해주세요.");
      return;
    }
    if (!file) {
      alert("사진을 선택해주세요.");
      return;
    }

    setLoading(true);

    try {
      const form = new FormData();
      form.append("image", file);
      form.append("cropName", cropName);

      const res = await fetch("/api/diagnose-new", {
        method: "POST",
        body: form,
      });

      const data = await res.json();
      setStep1(data);
    } catch {
      alert("진단 오류");
    } finally {
      setLoading(false);
    }
  };

  /* ======================
     STEP 2 실행
  ====================== */
  const handleSecondAnalyze = async () => {
    if (!step1) return;

    setLoading(true);

    try {
      const res = await fetch("/api/diagnose-new/step2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crop: step1.crop,
          observations: step1.observations,
          answers,
        }),
      });

      const data = await res.json();
      setStep2(data);
    } catch {
      alert("2차 판단 오류");
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
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* 타이틀 */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <img src="/logo-photodoctor.png" width={42} height={42} />
        <h1 style={{ color: "#00ff88", fontSize: 32, fontWeight: 900 }}>
          포토닥터
        </h1>
      </div>

      {/* 작물명 */}
      <input
        placeholder="작물명 (예: 옥수수)"
        value={cropName}
        onChange={(e) => setCropName(e.target.value)}
        style={{
          width: "100%",
          maxWidth: 420,
          height: 52,
          marginBottom: 14,
          padding: 12,
          borderRadius: 12,
          border: "2px solid #00ff88",
          background: "#111",
          color: "#00ff88",
          fontSize: 18,
        }}
      />

      {/* 사진 업로드 */}
      <label
        style={{
          width: "100%",
          maxWidth: 420,
          minHeight: 150,
          border: "3px dashed #00ff88",
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#00ff88",
          cursor: "pointer",
          marginBottom: 14,
        }}
      >
        📸 사진 촬영 또는 업로드
        <input type="file" hidden accept="image/*" onChange={handleFile} />
      </label>

      {preview && (
        <img
          src={preview}
          style={{
            width: "100%",
            maxWidth: 420,
            borderRadius: 16,
            border: "3px solid #00ff88",
            marginBottom: 14,
          }}
        />
      )}

      {/* STEP 1 버튼 */}
      {!step1 && (
        <button
          onClick={handleAnalyze}
          disabled={loading}
          style={{
            width: "100%",
            maxWidth: 420,
            height: 56,
            background: loading ? "#444" : "#00cc44",
            borderRadius: 16,
            border: "none",
            fontSize: 20,
            fontWeight: 800,
            marginBottom: 16,
          }}
        >
          {loading ? "🧠 판단 중..." : "🧠 AI 진단 요청"}
        </button>
      )}

      {/* ===== STEP 1 결과 ===== */}
      {step1 && (
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            background: "#0d0d0d",
            borderRadius: 16,
            padding: 16,
            color: "#fff",
            marginBottom: 20,
          }}
        >
          <h3 style={{ color: "#00ff88" }}>👀 사진 관찰</h3>
          <ul>
            {step1.observations.map((o, i) => (
              <li key={i}>- {o}</li>
            ))}
          </ul>

          <div style={{ color: "#ffd400", marginTop: 12 }}>
            ⚠️ 왜 확정할 수 없나
          </div>
          <p>{step1.why_uncertain}</p>

          <div style={{ color: "#00bfff", marginTop: 12 }}>
            🔍 추가 확인 질문
          </div>

          {step1.questions.map((q) => (
            <div key={q.id} style={{ marginTop: 8 }}>
              <div>{q.text}</div>
              <input
                value={answers[q.id] || ""}
                onChange={(e) =>
                  setAnswers((prev) => ({
                    ...prev,
                    [q.id]: e.target.value,
                  }))
                }
                placeholder="예: 있다 / 없다"
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #444",
                  background: "#111",
                  color: "#fff",
                }}
              />
            </div>
          ))}

          <button
            onClick={handleSecondAnalyze}
            style={{
              width: "100%",
              height: 52,
              background: "#ffd400",
              borderRadius: 12,
              border: "none",
              fontSize: 18,
              fontWeight: 900,
              marginTop: 14,
            }}
          >
            🔎 추가 판단 요청
          </button>
        </div>
      )}

      {/* ===== STEP 2 결과 ===== */}
      {step2 && (
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            border: "3px solid #ff4444",
            borderRadius: 16,
            padding: 16,
            background: "#1a1a1a",
            color: "#fff",
          }}
        >
          <h3 style={{ color: "#ff4444" }}>🚨 2차 판단 결과</h3>
          <p>{step2.summary}</p>
          <ul>
            {step2.actions.map((a, i) => (
              <li key={i}>- {a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 농사119 */}
      <button
        onClick={() =>
          window.open(
            "https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform",
            "_blank"
          )
        }
        style={{
          width: "100%",
          maxWidth: 420,
          height: 56,
          background: "#ff2b2b",
          borderRadius: 16,
          border: "none",
          fontSize: 18,
          fontWeight: 900,
          marginTop: 20,
          color: "#fff",
        }}
      >
        🚨 농사 119 출동 요청
      </button>

      <div style={{ color: "#FFD400", marginTop: 20 }}>
        제작: 한국농수산TV
      </div>
    </main>
  );
}