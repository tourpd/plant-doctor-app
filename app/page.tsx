"use client";

import { useState } from "react";

export default function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const handleDiagnose = async () => {
    if (!image) {
      alert("사진을 먼저 선택해 주세요.");
      return;
    }

    try {
      setLoading(true);
      setResult("");

      const formData = new FormData();
      formData.append("image", image);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("API ERROR:", data);
        setResult("AI 진단 실패: " + (data.error || res.statusText));
        return;
      }

      setResult(data.result || "진단 결과 없음");

    } catch (err) {
      console.error("REQUEST ERROR:", err);
      setResult("AI 호출 중 오류 발생");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: 20 }}>
      <h2>🐛 또봉이 병해 사진 진단</h2>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setImage(e.target.files?.[0] || null)}
      />

      <br />
      <br />

      <button
        onClick={handleDiagnose}
        disabled={loading}
        style={{
          padding: "10px 18px",
          background: "#e11",
          color: "white",
          border: "none",
          borderRadius: 6,
          cursor: "pointer"
        }}
      >
        {loading ? "진단 중..." : "진단 요청 보내기"}
      </button>

      {result && (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#111",
            color: "#0f0",
            padding: 15,
            marginTop: 20,
            borderRadius: 6
          }}
        >
✅ AI 진단 결과

{result}
        </pre>
      )}
    </main>
  );
}
