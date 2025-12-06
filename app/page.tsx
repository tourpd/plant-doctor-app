"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ✅ 파일 선택 + 모바일 촬영 대응
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setFile(f);

    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  // ✅ 진단 요청
  const requestDiagnosis = async () => {
    if (!file) {
      alert("사진을 먼저 선택하세요.");
      return;
    }

    setLoading(true);
    setResult(null);

    const fd = new FormData();
    fd.append("image", file);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();

      if (data.ok && data.result) {
        setResult(data.result);
      } else {
        setResult(data?.error || "AI 진단 실패");
      }
    } catch {
      setResult("서버 통신 오류");
    }

    setLoading(false);
  };

  return (
    <main style={{ background: "black", color: "#00ff99", minHeight: "100vh" }}>
      <h2 style={{ textAlign: "center" }}>🪲 똑똑이 농사 상담 AI</h2>

      {/* ✅ 업로드 UI */}
      <div
        style={{
          border: "2px dashed #00ff99",
          padding: 20,
          margin: "20px auto",
          width: "90%",
          borderRadius: 10,
          textAlign: "center",
          cursor: "pointer",
        }}
      >
        <label>
          <b style={{ fontSize: 18 }}>📸 여기를 눌러<br/>사진 촬영 또는 업로드</b>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            style={{ display: "none" }}
          />
        </label>
      </div>

      {/* ✅ 미리보기 */}
      {preview && (
        <img
          src={preview}
          style={{
            maxWidth: "90%",
            margin: "0 auto",
            display: "block",
            border: "2px solid #00ff99",
            borderRadius: 10,
          }}
        />
      )}

      {/* ✅ AI 요청 버튼 */}
      <button
        onClick={requestDiagnosis}
        style={{
          width: "90%",
          background: "#00cc44",
          color: "black",
          fontWeight: "bold",
          fontSize: 18,
          padding: 15,
          margin: "20px auto",
          display: "block",
          borderRadius: 12,
          border: "none",
        }}
      >
        🧠 AI 진단 요청
      </button>

      {loading && <p style={{ textAlign: "center" }}>AI 분석 중...</p>}

      {/* ✅ 결과 영역 */}
      {result && (
        <pre
          style={{
            background: "#111",
            padding: 15,
            whiteSpace: "pre-wrap",
            borderRadius: 10,
            margin: "10px",
            color: "#00ff99",
          }}
        >
{result}
        </pre>
      )}

      {/* ✅ 119 */}
      <a
        href="https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform"
        target="_blank"
        style={{ textDecoration: "none" }}
      >
        <div
          style={{
            background: "red",
            margin: 20,
            padding: 15,
            borderRadius: 15,
            textAlign: "center",
            color: "white",
            fontSize: 18,
            fontWeight: "bold",
          }}
        >
          🚨 119 긴급 출동 요청
        </div>
      </a>
    </main>
  );
}

