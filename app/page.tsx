"use client";

import { useState } from "react";

export default function Home() {
  const [result] = useState(
    "✅ AI 진단 테스트 화면입니다.\n사진 업로드 후 진단 결과가 여기에 출력됩니다."
  );

  return (
    <main style={{ padding: 40 }}>

      <h2>🪴 또봉이 병해 사진 진단</h2>

      <p style={{ marginTop: 10 }}>작물 병해가 의심될 때 사진을 보내면 AI가 분석합니다.</p>

      <pre
        style={{
          background: "#111",
          color: "#00ff00",
          padding: "12px",
          marginTop: 20,
          borderRadius: 6,
          whiteSpace: "pre-wrap"
        }}
      >
        ✅ AI 진단 결과
{"\n\n"}
        {result}
      </pre>

      {/* 🆘 119 농가 긴급 상담 버튼 */}
      <a
        href="https://www.appsheet.com/start/58068f53-8b94-4e26-9487-e65dc73261cb?view=%EB%86%8D%EA%B0%80%20%EC%A0%91%EC%88%98"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          marginTop: 30,
          background: "#0066ff",
          color: "white",
          padding: "14px 22px",
          borderRadius: 8,
          textDecoration: "none",
          fontWeight: "bold",
          fontSize: 16,
        }}
      >
        🚨 119 긴급 상담 요청
      </a>

    </main>
  );
}
