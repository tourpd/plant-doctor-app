"use client";

import { useState, useEffect, ChangeEvent } from "react";

type DiagnoseResponse = {
  ok: boolean;
  result?: string;
  error?: string;
};

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [crop, setCrop] = useState("");
  const [symptom, setSymptom] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!file) return setPreviewUrl("");
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult("");
    setError("");
  };

  const handleSubmit = async () => {
    try {
      setError("");
      setResult("");

      if (!file) {
        return setError("📸 진단할 사진을 먼저 선택하세요.");
      }

      setLoading(true);

      const fd = new FormData();
      fd.append("image", file);
      fd.append("crop", crop);
      fd.append("symptom", symptom);

      const res = await fetch("/api/diagnose", {
        method: "POST",
        body: fd
      });

      if (!res.ok) {
        throw new Error(`서버 오류 ${res.status}`);
      }

      const data: DiagnoseResponse = await res.json();

      if (!data.ok) {
        throw new Error(data.error || "진단 실패");
      }

      setResult(data.result || "");
    } catch (err: any) {
      setError(err?.message || "진단 오류 발생");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050807] text-white flex justify-center p-4">
      <div className="w-full max-w-4xl">

        <header className="mb-5">
          <h1 className="text-3xl font-bold flex gap-2">
            🐞 또봉이 병해 사진 진단
          </h1>
          <p className="text-green-300 text-sm">
            사진을 올리면 농민이 바로 행동할 수 있는 카드 처방을 만들어드립니다.
          </p>
        </header>

        <section className="grid md:grid-cols-[1.4fr,1fr] gap-5 mb-5">

          <div className="bg-[#101c16] p-4 rounded-xl border border-green-700">

            <h2 className="font-semibold mb-2">① 진단 정보 입력</h2>

            <input
              className="w-full mb-2 p-2 rounded bg-black border border-green-700"
              placeholder="작물명 (예: 양파, 마늘, 옥수수)"
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
            />

            <textarea
              className="w-full mb-2 p-2 h-20 rounded bg-black border border-green-700"
              placeholder="증상 설명 (농민 말로 써주세요)"
              value={symptom}
              onChange={(e) => setSymptom(e.target.value)}
            />

            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="mb-3"
            />

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-green-500 p-2 rounded hover:bg-green-400 disabled:opacity-50"
            >
              {loading ? "AI 진단 중..." : "🧠 AI 진단 요청"}
            </button>

            {error && (
              <p className="mt-2 text-red-400 text-sm">
                ❌ {error}
              </p>
            )}

          </div>

          <div className="bg-[#101c16] border border-green-700 p-3 rounded-xl">
            <h2 className="font-semibold mb-2">② 사진 미리보기</h2>

            {previewUrl ? (
              <img
                src={previewUrl}
                className="rounded w-full h-[360px] object-contain border border-green-700"
              />
            ) : (
              <div className="h-[360px] flex items-center justify-center text-green-400 border border-dashed border-green-700">
                사진을 선택하세요
              </div>
            )}
          </div>

        </section>

        <section className="bg-black p-4 border border-green-700 rounded-xl">

          <h2 className="font-semibold mb-2">
            ③ 농민 진단 카드
          </h2>

          {!result && !loading && (
            <p className="text-green-400 text-sm">
              사진 업로드 후 AI 진단을 요청하세요.
            </p>
          )}

          {loading && (
            <p className="text-green-400">
              🧠 AI 분석 중입니다…
            </p>
          )}

          {result && (
            <div className="whitespace-pre-wrap text-green-200 border border-green-500 p-4 rounded-xl bg-black">
              {result}
              <div className="flex gap-3 mt-4">
                <button className="bg-green-500 px-3 py-2 rounded">
                  📸 재촬영 알림
                </button>
                <button className="bg-yellow-600 px-3 py-2 rounded">
                  💊 약제 보기
                </button>
              </div>
              <p className="mt-2 text-xs text-green-300">
                👉 48~72시간 후 동일 위치 재촬영 시 진단 정확도가 크게 향상됩니다.
              </p>
            </div>
          )}

        </section>

      </div>
    </main>
  );
}
