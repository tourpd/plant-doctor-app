"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // 사진 선택
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult("");
  };

  // AI 진단 요청
  const handleAnalyze = async () => {
    if (!file) {
      alert("먼저 사진을 선택하세요.");
      return;
    }

    setLoading(true);
    setResult("");

    try {
      const form = new FormData();
      // ✅ route.ts 와 key 정확히 매칭
      form.append("image", file);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: form
      });

      const data = await res.json();

      if (!data.ok) {
        setResult(`❌ 오류 발생\n\n${data.error}`);
      } else {
        setResult(data.result);
      }
    } catch (err: any) {
      setResult(`❌ 서버 통신 오류:\n${err?.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#00ff88",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: 20
      }}
    >
      <h1 style={{ marginBottom: 20 }}>🐞 또봉이 농사 상담 AI</h1>

      {/* 업로드 박스 */}
      <label
        style={{
          width: "90%",
          maxWidth: 600,
          height: 120,
          border: "2px dashed #00ff88",
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          marginBottom: 20,
          fontSize: 18,
          textAlign: "center"
        }}
      >
        📸 사진 촬영 또는 업로드
        <input
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </label>

      {/* 이미지 미리보기 - 중앙정렬 */}
      {preview && (
        <img
          src={preview}
          alt="선택한 사진"
          style={{
            width: "90%",
            maxWidth: 420,
            borderRadius: 16,
            marginBottom: 20,
            border: "2px solid #00ff88",
            display: "block"
          }}
        />
      )}

      {/* 분석 버튼 */}
      <button
        onClick={handleAnalyze}
        disabled={loading}
        style={{
          width: "90%",
          maxWidth: 420,
          background: "#00cc44",
          color: "#000",
          border: 0,
          borderRadius: 14,
          padding: "16px 0",
          fontSize: 20,
          fontWeight: "bold",
          cursor: "pointer",
          marginBottom: 20
        }}
      >
        {loading ? "⏳ 분석중..." : "🧠 AI 진단 요청"}
      </button>

      {/* 결과 출력 카드 */}
      {result && (
        <pre
          style={{
            width: "90%",
            maxWidth: 700,
            background: "#111",
            color: "#00ff88",
            padding: 20,
            borderRadius: 16,
            whiteSpace: "pre-wrap",
            lineHeight: 1.6,
            fontSize: 15,
            marginBottom: 20
          }}
        >
✅ AI 병해 진단 결과

{result}
        </pre>
      )}

      {/* 119 출동 요청 버튼 */}
      <a
        href="https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          width: "90%",
          maxWidth: 420,
          background: "#ff1111",
          color: "#fff",
          borderRadius: 14,
          padding: "16px 0",
          textAlign: "center",
          fontSize: 20,
          fontWeight: "bold",
          textDecoration: "none"
        }}
      >
        🚨 119 긴급 출동 요청
      </a>
    </main>
  );
}
