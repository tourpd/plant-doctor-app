"use client";

import { useState } from "react";

export default function Page() {
  const [cropName, setCropName] = useState("");
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
    if (!cropName.trim()) {
      alert("작물명을 입력해주세요. (예: 딸기)");
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

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      setResult(data.ok ? data.result : data.error);
    } catch {
      setResult("통신 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

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
        placeholder="작물명 (예: 딸기)"
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

      {/* AI 진단 */}
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
          marginBottom: 12,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "🧠 판단 중..." : "🧠 AI 진단 요청"}
      </button>

      {/* 농사 119 */}
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
          marginBottom: 28,
          cursor: "pointer",
          color: "#fff",
        }}
      >
        🚨 농사 119 출동 요청
      </button>

      {/* 결과 */}
      {result && (
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            border: "3px solid #ffd400",
            borderRadius: 16,
            padding: 16,
            background: "#0d0d0d",
            color: "#fff",
            marginBottom: 30,
          }}
        >
          <div
            style={{
              fontWeight: 900,
              color: "#ffd400",
              marginBottom: 10,
              fontSize: 18,
            }}
          >
            📋 AI 진단 결과
          </div>
          <pre style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
            {result}
          </pre>
        </div>
      )}

      {/* 제작자 */}
      <div style={{ color: "#FFD400", fontSize: 16, marginBottom: 40 }}>
        제작: 한국농수산TV
      </div>
    </main>
  );
}