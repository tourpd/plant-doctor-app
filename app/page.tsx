"use client";

import { useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../lib/firebase";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const uploadImage = async () => {
    if (!file) return alert("사진을 선택하세요.");

    setLoading(true);

    try {
      // ==========================
      // 1. Firebase Storage 업로드
      // ==========================
      const path = `photos/${Date.now()}_${file.name}`;
      const fileRef = ref(storage, path);

      await uploadBytes(fileRef, file);

      const imageUrl = await getDownloadURL(fileRef);

      console.log("✅ 이미지 URL:", imageUrl);

      // ==========================
      // 2. OpenAI Vision 진단
      // ==========================
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${
            process.env.NEXT_PUBLIC_OPENAI_API_KEY
          }`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "당신은 농업 병해충 진단 전문가입니다. 사진을 보고 병명, 증상 원인, 대처 방법, 권장 약제를 알려주세요."
            },
            {
              role: "user",
              content: [
                { type: "text", text: "이 작물 병해를 진단해주세요." },
                {
                  type: "image_url",
                  image_url: {
                    url: imageUrl
                  }
                }
              ]
            }
          ],
          max_tokens: 600
        })
      });

      const data = await res.json();
      console.log("AI:", data);

      setResult(data.choices?.[0]?.message?.content || "진단 실패");

    } catch (err) {
      console.error("Error:", err);
      setResult("업로드 혹은 AI 분석 중 오류 발생");
    }

    setLoading(false);
  };

  return (
    <main style={{ padding: 40, maxWidth: 700, margin: "auto" }}>
      <h2>🐼 또봉이 병해 사진 진단</h2>
      <p>작물 병해가 의심될 때 사진을 보내면 AI가 분석합니다.</p>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <p>
        {file ? `📷 선택됨: ${file.name}` : "❌ 파일 선택 없음"}
      </p>

      <button
        onClick={uploadImage}
        disabled={loading}
        style={{
          padding: "12px 20px",
          background: "red",
          color: "white",
          border: "none",
          borderRadius: 8,
          cursor: "pointer"
        }}
      >
        {loading ? "진단 중..." : "진단 요청 보내기"}
      </button>

      {result && (
        <pre
          style={{
            marginTop: 30,
            padding: 15,
            background: "#111",
            color: "#0f0",
            whiteSpace: "pre-wrap"
          }}
        >
          ✅ AI 진단 결과

{result}
        </pre>
      )}
    </main>
  );
}
