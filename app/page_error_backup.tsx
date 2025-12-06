cat > app/page.tsx << 'EOF'
"use client";

import { useState } from "react";
import { Camera } from "lucide-react";

const FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform?usp=dialog";

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSelect = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
  };

  const handleDiagnose = async () => {
    if (!file) return;

    setLoading(true);
    setResult(null);

    try {
      const form = new FormData();
      form.append("image", file);

      const res = await fetch("/api/diagnose", {
        method: "POST",
        body: form,
      });

      const data = await res.json();
      setResult(data.result || "진단 결과를 받아오지 못했습니다.");
    } catch (e) {
      setResult("서버 통신 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-green-50 flex flex-col items-center p-6">
      <h1 className="text-2xl font-bold mb-4">또봉이 농사 상담 AI</h1>

      <label className="w-full max-w-md border-2 border-dashed border-green-400 rounded-xl p-6 text-center cursor-pointer bg-white hover:bg-green-100">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) handleSelect(e.target.files[0]);
          }}
        />
        <Camera className="mx-auto mb-2" size={40} />
        <p className="font-semibold">사진 촬영하거나 선택하세요</p>
      </label>

      {preview && (
        <img
          src={preview}
          alt="preview"
          className="mt-4 rounded-xl max-h-60 border"
        />
      )}

      <button
        onClick={handleDiagnose}
        disabled={!file || loading}
        className="mt-4 w-full max-w-md py-3 rounded-xl bg-green-600 text-white font-bold disabled:bg-gray-400"
      >
        {loading ? "진단 중..." : "AI 진단 요청"}
      </button>

      {result && (
        <div className="mt-4 w-full max-w-md bg-white p-4 rounded-xl border">
          <h2 className="font-bold mb-2">진단 결과</h2>
          <p className="text-sm whitespace-pre-wrap">{result}</p>
        </div>
      )}

      <button
        className="mt-6 w-full max-w-md py-3 rounded-xl bg-red-600 text-white font-bold"
        onClick={() => window.open(FORM_URL, "_blank")}
      >
        🚨 119 출동 요청
      </button>
    </main>
  );
}
EOF
