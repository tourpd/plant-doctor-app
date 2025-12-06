"use client";

import { useState } from "react";

const FORM_119 =
"https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform";

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
    if (!file) {
      alert("사진부터 선택해주세요");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();

      // ✅ 핵심 수정: 반드시 "file"
      form.append("file", file);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: form,
      });

      const data = await res.json();

      console.log("AI RESULT:", data);

      if (!data.ok) {
        setResult(`❌ ${data.error || "AI 진단 실패"}`);
        return;
      }

      setResult(data.message || JSON.stringify(data, null, 2));
    } catch (err: any) {
      setResult("❌ 서버 통신 오류: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{
      minHeight: "100vh",
      background: "#000",
      color: "#0f0",
      padding: 20,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 20
    }}>

      <h2>🐞 또봉이 농사 상담 AI</h2>

      {/* 업로드 박스 */}
      <label style={{
        width: "100%",
        maxWidth: 500,
        height: 160,
        border: "2px dashed #00ff88",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: "#00ff88",
        textAlign: "center"
      }}>
        📸 사진 촬영 또는 업로드
        <input
          hidden
          type="file"
          accept="image/*"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              handleFile(e.target.files[0]);
            }
          }}
        />
      </label>

      {/* 이미지 미리보기 */}
      {preview && (
        <img
          src={preview}
          alt="preview"
          style={{
            width: "100%",
            maxWidth: 400,
            borderRadius: 12,
            border: "2px solid #00ff88",
            objectFit: "contain"
          }}
        />
      )}

      {/* AI 버튼 */}
      <button
        onClick={analyze}
        disabled={loading}
        style={{
          width: "100%",
          maxWidth: 400,
          height: 60,
          borderRadius: 16,
          background: "#00cc44",
          border: "none",
          fontSize: 20,
          fontWeight: "bold",
          color: "white",
          cursor: "pointer"
        }}
      >
        🧠 {loading ? "진단 중..." : "AI 진단 요청"}
      </button>

      {/* 결과 */}
      {result && (
        <pre style={{
          width: "100%",
          maxWidth: 500,
          background: "linear-gradient(#111,#000)",
          padding: 16,
          borderRadius: 14,
          color: "#00ff99",
          whiteSpace: "pre-wrap",
          fontSize: 14
        }}>
          ✅ AI 진단 결과
          {"\n\n"}
          {result}
        </pre>
      )}

      {/* 119 버튼 */}
      <a
        href={FORM_119}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          width: "100%",
          maxWidth: 400,
          height: 60,
          background: "#ff1a1a",
          borderRadius: 16,
          color: "white",
          fontSize: 20,
          fontWeight: "bold",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: "none",
          marginTop: 10
        }}
      >
        🚨 119 출동 요청
      </a>

    </main>
  );
}
