"use client";

import { useState } from "react";

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onFileChange = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult("");
    setError("");
  };

  // ✅ 모든 응답 패턴 커버
  const extractText = (data: any): string => {
    if (!data) return "";

    if (typeof data.output_text === "string") return data.output_text;

    if (Array.isArray(data.output)) {
      let t = "";
      data.output.forEach((o: any) => {
        if (Array.isArray(o.content)) {
          o.content.forEach((c: any) => {
            if (typeof c.text === "string") t += c.text + "\n";
          });
        }
      });
      return t;
    }

    if (data.choices?.[0]?.message?.content)
      return data.choices[0].message.content;

    return JSON.stringify(data, null, 2);
  };

  const diagnose = async () => {
    if (!file) {
      alert("사진을 먼저 올려주세요.");
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

      if (!res.ok) throw new Error("서버 통신 실패");

      const data = await res.json();
      console.log("AI RAW RESPONSE:", data);

      const text = extractText(data);

      setResult(text || "✅ AI 분석 완료됐으나 텍스트 변환 실패");

    } catch (err) {
      console.error(err);
      setError("🚨 서버 통신 오류 발생");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{
      minHeight: "100vh",
      background: "#000",
      color: "#7CFFAF",
      padding: "24px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>

      <h2 style={{ marginBottom: 10 }}>🐞 또봉이 농사 상담 AI</h2>

      {/* 업로드 영역 */}
      <label style={{
        width: "100%",
        maxWidth: 420,
        height: 160,
        border: "2px dashed #00ff88",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        marginBottom: 12
      }}>
        <input
          hidden
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files && onFileChange(e.target.files[0])}
        />
        📸 사진 촬영 또는 업로드
      </label>

      {/* ✅ 사진 중앙 정렬 */}
      {preview &&
        <div style={{
          display: "flex",
          justifyContent: "center",
          width: "100%"
        }}>
          <img
            src={preview}
            style={{
              width: 280,
              margin: "10px auto",
              borderRadius: 12,
              border: "2px solid #00ff88"
            }}
          />
        </div>
      }

      {/* AI 버튼 */}
      <button
        onClick={diagnose}
        disabled={loading}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#00c853",
          color: "#000",
          padding: 14,
          borderRadius: 12,
          border: "none",
          fontSize: 18,
          fontWeight: "bold",
          cursor: "pointer",
          marginTop: 8
        }}>
        🧠 AI 진단 요청
      </button>

      {/* 에러 */}
      {error &&
        <div style={{
          background: "#111",
          borderRadius: 12,
          padding: 12,
          width: "100%",
          maxWidth: 420,
          color: "#ff4444",
          marginTop: 12
        }}>
          {error}
        </div>
      }

      {/* ✅ 진단 결과 출력 */}
      {result &&
        <pre style={{
          background: "#111",
          marginTop: 12,
          padding: 16,
          borderRadius: 12,
          width: "100%",
          maxWidth: 420,
          whiteSpace: "pre-wrap",
          color: "#00ff88",
          textAlign: "left",
          lineHeight: 1.5
        }}>
✅ AI 진단 결과
{result}
        </pre>
      }

      {/* 119 연동 */}
      <a
        href="https://docs.google.com/forms/d/e/1FAIpQLSdkGcwL_B-10yU0gj4oareM4iajMPND6JtGlZEwjbwPbnQBEg/viewform"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "block",
          width: "100%",
          maxWidth: 420,
          marginTop: 24,
          background: "#ff1a1a",
          padding: 14,
          borderRadius: 12,
          textAlign: "center",
          fontWeight: "bold",
          textDecoration: "none",
          color: "#fff",
          fontSize: 17
        }}>
        🚨 119 출동 요청
      </a>

    </main>
  );
}
