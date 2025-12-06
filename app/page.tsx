"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const f = e.target.files[0];
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult("");
  };

  const analyze = async () => {
    if (!file) return alert("사진을 먼저 업로드하세요.");

    const form = new FormData();
    form.append("file", file);

    setLoading(true);
    setResult("");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: form,
      });

      const data = await res.json();

      if (data.ok) {
        setResult(data.text || "결과 없음");
      } else {
        setResult("분석 오류: " + data.error);
      }
    } catch {
      setResult("서버 연결 오류");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-start p-4 gap-4">

      {/* Title */}
      <h1 className="text-xl text-green-400 font-bold mt-2">
        🐞 또봉이 농사 상담 AI
      </h1>

      {/* Upload box */}
      <label className="w-full max-w-md border-2 border-dashed border-green-400 rounded-xl p-6 text-center cursor-pointer hover:bg-zinc-900 transition">
        <div className="text-green-400">
          📸 사진 촬영 또는 업로드
        </div>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </label>

      {/* 이미지 미리보기 */}
      {preview && (
        <img
          src={preview}
          alt="미리보기"
          className="max-w-md w-full rounded-xl border-2 border-green-400 object-contain mx-auto"
        />
      )}

      {/* 분석 버튼 */}
      <button
        onClick={analyze}
        disabled={loading}
        className="bg-green-500 hover:bg-green-600 w-full max-w-md rounded-xl py-4 text-lg text-black font-bold transition"
      >
        {loading ? "분석중..." : "🧠 AI 진단 요청"}
      </button>

      {/* 결과 출력 박스 */}
      {result && (
        <div className="w-full max-w-3xl bg-zinc-900 border border-green-400 p-4 rounded-xl text-green-300 whitespace-pre-line leading-relaxed">
          ✅ AI 병해 진단 결과

          {"\n\n"}

          {result}
        </div>
      )}

      {/* 119 버튼 */}
      <a
        href="https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform"
        target="_blank"
        className="mt-4 bg-red-600 hover:bg-red-700 w-full max-w-md rounded-xl py-4 text-lg font-bold text-white text-center"
      >
        🚨 119 긴급 출동 요청
      </a>

    </main>
  );
}
