"use client";

import { useState } from "react";

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setResult("");
  };

  const handleAnalyze = async () => {
    if (!file) {
      alert("사진을 먼저 선택하세요.");
      return;
    }

    try {
      setLoading(true);

      const form = new FormData();
      form.append("image", file);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: form
      });

      const data = await res.json();

      if (!data.ok) {
        setResult("❌ 오류: " + data.error);
      } else {
        setResult(data.result);
      }
    } catch (err: any) {
      setResult("❌ 통신 실패: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        padding: "30px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
      }}
    >
      <h2 style={{ color: "#00ff88", marginBottom: "20px" }}>
        🐞 또봉이 농사 병해 상담 AI
      </h2>

      {/* 업로드 영역 */}
      <label
        style={{
          width: "100%",
          maxWidth: 420,
          minHeight: 160,
          border: "3px dashed #00ff88",
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          cursor: "pointer",
          color: "#00ff88",
          marginBottom: 16,
          fontSize: 18,
          textAlign: "center"
        }}
      >
        📸 여기를 눌러<br />
        사진 촬영 또는 업로드

        {/* ✅ capture 제거 — 모바일에서 업로드 + 촬영 둘 다 가능 */}
        <input
          type="file"
          accept="image/*"
          onChange={handleFile}
          style={{ display: "none" }}
        />
      </label>

      {/* 미리보기 */}
      {preview && (
        <img
          src={preview}
          alt="preview"
          style={{
            width: "100%",
            maxWidth: 420,
            borderRadius: 16,
            border: "3px solid #00ff88",
            marginBottom: 18
          }}
        />
      )}

      {/* 분석 버튼 */}
      <button
        onClick={handleAnalyze}
        disabled={loading}
        style={{
          width: "100%",
          maxWidth: 420,
          height: 60,
          background: "#00cc44",
          border: "none",
          borderRadius: 16,
          color: "#000",
          fontSize: 20,
          fontWeight: "bold",
          cursor: "pointer",
          marginBottom: 20
        }}
      >
        🧠 {loading ? "AI 분석 중..." : "AI 진단 요청"}
      </button>

      {/* 진단 결과 */}
      {result && (
        <div
          style={{
            width: "100%",
            maxWidth: 720,
            background: "#0f0f0f",
            padding: 20,
            borderRadius: 16,
            border: "2px solid #00ff88",
            color: "#00ff88",
            whiteSpace: "pre-wrap",
            lineHeight: "1.6",
            fontSize: 15
          }}
        >
          ✅ AI 병해 진단 결과

          {"\n\n"}
          {result}
        </div>
      )}

      {/* 119 버튼 */}
      <a
        href="https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          marginTop: 24,
          width: "100%",
          maxWidth: 420,
          height: 60,
          background: "#ff0000",
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          textDecoration: "none",
          fontSize: 20,
          fontWeight: "bold"
        }}
      >
        🚨 119 긴급 출동 요청
      </a>
    </main>
  );
}
