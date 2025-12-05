'use client';

import { useRef, useState } from "react";

export default function HomePage() {

  const [images, setImages] = useState<File[]>([]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    inputRef.current?.click();
  };

  const onImagesAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const newFiles = Array.from(e.target.files);

    setImages(prev =>
      [...prev, ...newFiles].slice(0, 4)
    );

    e.target.value = "";
  };

  const runAI = async () => {
    setLoading(true);
    setResult(null);

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

      {/* 이미지 그리드 */}
      <div className="grid grid-cols-2 gap-4">

        {images.map((img, i) => (
          <div
            key={i}
            onClick={openPicker}
            className="w-40 h-40 cursor-pointer border-2 border-dashed border-green-400 rounded-lg overflow-hidden bg-white"
          >
            <img
              src={URL.createObjectURL(img)}
              className="object-cover w-full h-full"
            />
          </div>
        ))}

        {images.length < 4 && (
          <div
            onClick={openPicker}
            className="w-40 h-40 cursor-pointer border-2 border-dashed border-green-400 rounded-lg flex items-center justify-center bg-white"
          >
            <span className="text-green-500 text-lg font-semibold">
              + 추가
            </span>
          </div>
        )}
      </div>

      <input
        type="file"
        multiple
        accept="image/*"
        hidden
        ref={inputRef}
        onChange={onImagesAdd}
      />

      {images.length > 0 && (
        <button
          onClick={runAI}
          disabled={loading}
          className="mt-6 px-7 py-2 bg-green-600 text-white rounded-xl"
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
            {result.solution?.map(
              (s: string, i: number) => (
                <li key={i}>{s}</li>
              )
            )}
          </ul>

          <h3 className="mt-3 font-semibold">
            추천
          </h3>
          <ul className="list-disc ml-5">
            {result.recommend?.map(
              (s: string, i: number) => (
                <li key={i}>{s}</li>
              )
            )}
          </ul>

        </div>
      )}

    </main>
  );
}
