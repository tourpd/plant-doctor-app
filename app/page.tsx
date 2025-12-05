'use client';

import { useState } from "react";

export default function HomePage() {
  const [images, setImages] = useState<File[]>([]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSelectImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setImages(Array.from(e.target.files).slice(0, 4));
  };

  const handleDiagnose = async () => {
    setLoading(true);

    const formData = new FormData();
    images.forEach(img => formData.append("images", img));

    const res = await fetch("/api/diagnose", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    setResult(data);
    setLoading(false);
  };

  return (
    <main className="min-h-screen p-6 bg-green-50 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-2">
        농사톡톡 병해 진단
      </h1>

      <p className="text-gray-600 mb-4">
        작물 사진을 최대 4장까지 업로드하세요.
      </p>

      <label className="grid grid-cols-2 gap-3 cursor-pointer">
        {[0,1,2,3].map(i => (
          <div
            key={i}
            className="w-36 h-36 border-2 border-dashed border-green-400 rounded-lg bg-white flex items-center justify-center overflow-hidden"
          >
            {images[i] ? (
              <img
                src={URL.createObjectURL(images[i])}
                className="object-cover w-full h-full"
              />
            ) : (
              <span className="text-green-500">
                + 추가
              </span>
            )}
          </div>
        ))}

        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleSelectImages}
          className="hidden"
        />
      </label>

      {images.length > 0 && (
        <button
          className="mt-5 px-6 py-2 bg-green-600 text-white rounded-xl"
          onClick={handleDiagnose}
          disabled={loading}
        >
          {loading ? "AI 분석 중..." : "AI 진단 요청"}
        </button>
      )}

      {result && (
        <div className="mt-6 w-full max-w-md bg-white p-4 rounded shadow">
          <h2 className="font-bold mb-2">
            진단 결과
          </h2>

          <p>병명: {result.diseaseName}</p>
          <p>위험도: {result.riskLevel}</p>

          <h3 className="mt-3 font-semibold">
            대응 방법
          </h3>
          <ul className="list-disc ml-5">
            {result.solution?.map((s: string, i: number) => (
              <li key={i}>{s}</li>
            ))}
          </ul>

          <h3 className="mt-3 font-semibold">
            추천
          </h3>
          <ul className="list-disc ml-5">
            {result.recommend?.map((s: string, i: number) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
