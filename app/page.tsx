"use client";

import { useState } from "react";

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setFile(f);
    setResult(null);

    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const analyze = async () => {
    if (!file) {
      alert("사진을 먼저 선택해주세요");
      return;
    }

    try {
      setLoading(true);

      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: form,
      });

      const data = await res.json();
      setResult(data);
    } catch (e) {
      console.error(e);
      alert("서버 통신 오류");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{
      minHeight: "100vh",
      background: "#000",
      color: "#00ff88",
      padding: 20,
      textAlign: "center"
    }}>

      <h2 style={{ marginBottom: 20 }}>
        🐞 또봉이 농사 상담 AI
      </h2>

      {/* 업로드 영역 */}
      <label style={{
        display: "block",
        border: "2px dashed #00ff88",
        borderRadius: 12,
        padding: "40px 10px",
        marginBottom: 20,
        cursor: "pointer"
      }}>
        📸 사진 촬영 또는 업로드
        <input
          type="file"
          accept="image/*"
          onChange={handleFile}
          style={{ display: "none" }}
        />
      </label>

      {/* 이미지 미리보기 -> 중앙 정렬 */}
      {preview && (
        <div style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: 20,
        }}>
          <img
            src={preview}
            style={{
              maxWidth: 320,
              width: "90%",
              borderRadius: 12,
              border: "2px solid #00ff88"
            }}
          />
        </div>
      )}

      {/* 진단 버튼 */}
      <button
        onClick={analyze}
        disabled={loading}
        style={{
          width: "100%",
          maxWidth: 340,
          background: "#00cc44",
          border: "none",
          borderRadius: 12,
          padding: "14px",
          fontSize: 18,
          cursor: "pointer"
        }}
      >
        🧠 {loading ? "진단 중..." : "AI 진단 요청"}
      </button>

      {/* 결과 박스 */}
      {result && (
        <div style={{
          background: "#111",
          borderRadius: 12,
          padding: 16,
          marginTop: 20,
          textAlign: "left",
          color: "#00ff88"
        }}>
          {result.ok ? (
            <>
              <h3>✅ AI 진단 결과</h3>

              <p><b>🌱 작물</b> : {result.crop}</p>
              <p><b>🦠 병명</b> : {result.diagnosis}</p>

              <p><b>📌 발생 원인</b><br />{result.reason}</p>

              <p><b>🛠 방제 방법</b><br />{result.solution}</p>

              <p style={{ color: "#ffaa00" }}>
                <b>⚠ 주의사항</b><br />
                {result.caution}
              </p>
            </>
          ) : (
            <>
              <h3>❌ 분석 실패</h3>
              <p>{result.error}</p>
            </>
          )}
        </div>
      )}

      {/* 119 버튼 */}
      <a
        href="https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform"
        target="_blank"
        rel="noopener noreferrer"
      >
        <button style={{
          width: "100%",
          maxWidth: 340,
          marginTop: 20,
          background: "red",
          border: "none",
          borderRadius: 12,
          padding: "14px",
          color: "#fff",
          fontSize: 18,
          cursor: "pointer"
        }}>
          🚨 119 출동 요청
        </button>
      </a>

    </main>
  );
}
