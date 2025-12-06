"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleFile = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult("");
  };

  const analyze = async () => {
    if (!file) return alert("사진을 먼저 선택해 주세요.");

    setLoading(true);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: form,
      });

      const data = await res.json();

      if (!data.ok) {
        setResult("⚠️ 오류: " + data.error);
      } else {
        setResult(data.text);
      }
    } catch (err) {
      setResult("⚠️ 서버 통신 실패");
    }

    setLoading(false);
  };

  return (
    <main
      style={{
        background: "#000",
        minHeight: "100vh",
        padding: "30px",
        color: "#00ff88",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* TITLE */}
      <h1 style={{ marginBottom: 20 }}>🐞 또봉이 농사 상담 AI</h1>

      {/* UPLOAD BOX */}
      <label
        style={{
          width: "100%",
          maxWidth: 520,
          height: 160,
          border: "3px dashed #00ff88",
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          cursor: "pointer",
          marginBottom: 24,
        }}
      >
        📸 사진 촬영 또는 업로드
        <input
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => e.target.files && handleFile(e.target.files[0])}
        />
      </label>

      {/* IMAGE CENTER */}
      {preview && (
        <img
          src={preview}
          alt="미리보기"
          style={{
            maxWidth: 380,
            borderRadius: 20,
            border: "3px solid #00ff88",
            marginBottom: 20,
          }}
        />
      )}

      {/* ANALYZE BUTTON */}
      <button
        onClick={analyze}
        disabled={loading}
        style={{
          background: "#12c94c",
          color: "#000",
          fontSize: 18,
          padding: "16px 40px",
          borderRadius: 12,
          border: "none",
          cursor: "pointer",
          marginBottom: 24,
        }}
      >
        🧠 AI 진단 요청
      </button>

      {/* RESULT BOX */}
      {result && (
        <div
          style={{
            width: "100%",
            maxWidth: 640,
            background: "#111",
            padding: 20,
            borderRadius: 14,
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
            marginBottom: 24,
            border: "2px solid #00ff88",
          }}
        >
          ✅ AI 진단 결과

{result}
        </div>
      )}

      {/* 119 LINK */}
      <a
        href="https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          background: "#ff1e1e",
          padding: "18px 50px",
          borderRadius: 16,
          color: "#fff",
          fontWeight: "bold",
          textDecoration: "none",
          fontSize: 18,
        }}
      >
        🚨 119 긴급 출동 요청
      </a>
    </main>
  );
}
