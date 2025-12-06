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
      alert("사진을 먼저 선택하세요.");
      return;
    }

    setLoading(true);

    try {
      const form = new FormData();
      form.append("file", file); // ⭐ KEY 반드시 file

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: form, // ❗ headers 절대 넣지 말 것
      });

      const data = await res.json();

      console.log("AI RESULT:", data);

      if (!data.ok) {
        setResult(`❌ ${data.error || "분석 실패"}`);
        return;
      }

      setResult(data.result || "결과가 비어 있습니다.");
    } catch (err: any) {
      setResult("❌ 서버 오류: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#00ff99",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
      }}
    >
      <h2>🐞 또봉이 농사 상담 AI</h2>

      {/* 업로드 박스 */}
      <label
        style={{
          width: "100%",
          maxWidth: 500,
          height: 160,
          border: "2px dashed #00ff88",
          borderRadius: 16,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          cursor: "pointer",
          fontSize: 18,
        }}
      >
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
          style={{
            width: "100%",
            maxWidth: 420,
            border: "2px solid #00ff88",
            borderRadius: 16,
          }}
        />
      )}

      {/* AI 요청 버튼 */}
      <button
        onClick={analyze}
        disabled={loading}
        style={{
          width: "100%",
          maxWidth: 420,
          height: 64,
          background: "#15cc44",
          color: "white",
          borderRadius: 20,
          border: "none",
          fontSize: 22,
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        🧠 {loading ? "AI 분석 중..." : "AI 진단 요청"}
      </button>

      {/* 결과 박스 */}
      {result && (
        <pre
          style={{
            width: "100%",
            maxWidth: 500,
            background: "#111",
            padding: 16,
            borderRadius: 14,
            color: "#00ff99",
            whiteSpace: "pre-wrap",
            fontSize: 16,
          }}
        >
✅ AI 진단 결과

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
          maxWidth: 420,
          height: 64,
          background: "#ff1a1a",
          borderRadius: 20,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: "white",
          textDecoration: "none",
          fontSize: 20,
          fontWeight: "bold",
        }}
      >
         🚨 119 출동 요청
      </a>
    </main>
  );
}

