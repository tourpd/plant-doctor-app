"use client";

import { useState } from "react";

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult("");
    setError("");
  };

  const onSubmit = async () => {
    if (!file) {
      alert("사진을 먼저 업로드하세요.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResult("");

      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        throw new Error(`서버 오류 (${res.status})`);
      }

      const data = await res.json();

      setResult(
        data?.result ||
          "AI 응답은 받았으나 결과 필드가 비어 있습니다."
      );
    } catch (err) {
      console.error(err);
      setError("서버 통신 오류");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#ffffff",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <h1 style={{ color: "#7CFFAF", marginBottom: 20 }}>
        🐞 또봉이 농사 상담 AI
      </h1>

      {/* ✅ 업로드 영역 */}
      <label
        style={{
          width: "100%",
          maxWidth: 420,
          height: 160,
          margin: "0 auto",
          border: "2px dashed #22ff88",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "#22ff88",
        }}
      >
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={(e) =>
            e.target.files && handleFile(e.target.files[0])
          }
        />

        📸 사진 촬영 또는 업로드
      </label>

      {/* 미리보기 */}
      {preview && (
        <img
          src={preview}
          style={{
            width: 260,
            marginTop: 16,
            borderRadius: 12,
            border: "2px solid #22ff88",
          }}
          alt="preview"
        />
      )}

      {/* 진단 버튼 */}
      <button
        onClick={onSubmit}
        disabled={loading}
        style={{
          width: "100%",
          maxWidth: 420,
          marginTop: 20,
          padding: "14px",
          background: "#00c853",
          border: "none",
          borderRadius: 10,
          color: "#000",
          fontSize: 18,
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        🧠 AI 진단 요청
      </button>

      {/* 에러 메시지 */}
      {error && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 10,
            background: "#111",
            color: "red",
          }}
        >
          🚨 {error}
        </div>
      )}

      {/* 결과 출력 */}
      {result && (
        <pre
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 12,
            background: "#111",
            color: "#22ff88",
            textAlign: "left",
            whiteSpace: "pre-wrap",
          }}
        >
✅ AI 진단 결과

{result}
        </pre>
      )}

      {/* 119 버튼 */}
      <a
        href="https://www.appsheet.com/start/58068f53-8b94-4e26-9487-e65dc73261cb?view=%EB%86%8D%EA%B0%80%20%EC%A0%91%EC%88%98"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          marginTop: 30,
          display: "inline-block",
          width: "100%",
          maxWidth: 420,
          padding: "14px",
          background: "#ff1a1a",
          color: "#fff",
          textDecoration: "none",
          borderRadius: 10,
          fontSize: 18,
          fontWeight: "bold",
        }}
      >
        🚨 119 출동 요청
      </a>
    </main>
  );
}
