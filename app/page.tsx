"use client";
import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setFile(f);

    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const runAnalyze = async () => {
    if (!file) {
      alert("사진부터 선택하세요.");
      return;
    }

    setLoading(true);
    setResult(null);

    const form = new FormData();
    form.append("file", file);   // ✅ 핵심: 반드시 "file"

    const res = await fetch("/api/analyze", {
      method: "POST",
      body: form,
    });

    const data = await res.json();
    setResult(data);
    setLoading(false);
  };

  return (
    <main style={{ background: "#000", minHeight: "100vh", padding: 40 }}>

      <h1 style={{ color: "#6BFFD4", textAlign: "center" }}>
        🐞 또봉이 농사 상담 AI
      </h1>

      <div
        style={{
          margin: "20px auto",
          border: "2px dashed #00ff88",
          borderRadius: 12,
          padding: 30,
          width: "80%",
          textAlign: "center",
          color: "#6BFFD4"
        }}
      >
        📸 사진 촬영 또는 업로드
        <br /><br />
        <input type="file" accept="image/*" onChange={onFileChange} />
      </div>

      {preview && (
        <div style={{ textAlign: "center" }}>
          <img
            src={preview}
            style={{
              maxWidth: 300,
              borderRadius: 10,
              border: "2px solid #00ff88"
            }}
          />
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <button
          onClick={runAnalyze}
          style={{
            background: "#00cc44",
            color: "#fff",
            padding: "15px 40px",
            fontSize: 18,
            borderRadius: 10,
            border: 0,
            cursor: "pointer"
          }}
        >
          🧠 AI 진단 요청
        </button>
      </div>

      <div
        style={{
          background: "#111",
          borderRadius: 10,
          padding: 20,
          margin: "20px auto",
          width: "80%",
          color: "#6BFFD4",
          minHeight: 100
        }}
      >
        {loading && "진단중..."}

        {!loading && result && (
          <>
            {result.ok ? (
              <>
                ✅ AI 진단 결과  
                <pre style={{ whiteSpace: "pre-wrap" }}>
작물: {result.crop}
병명: {result.diagnosis}
원인: {result.reason}

대응:
{result.solution}
                </pre>
              </>
            ) : (
              <pre>{JSON.stringify(result, null, 2)}</pre>
            )}
          </>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: "red",
            display: "inline-block",
            color: "#fff",
            padding: "15px 40px",
            fontSize: 18,
            borderRadius: 10,
            textDecoration: "none"
          }}
        >
          🚨 119 출동 요청
        </a>
      </div>
    </main>
  );
}
