"use client";

import { useRef, useState } from "react";

export default function PhotoUploader({
  onUploaded,
}: {
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      console.log("📤 업로드 시작:", file.name, file.size);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "서버 업로드 실패");
      }

      const data = await res.json();

      if (!data.url) {
        throw new Error("업로드 URL 없음");
      }

      console.log("✅ 업로드 성공:", data.url);
      onUploaded(data.url);

      // 🔑 같은 파일 다시 선택 가능하게 리셋 (첫 업로드 버그 핵심 해결)
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (err: any) {
      console.error("❌ 업로드 에러:", err);
      setError("사진 업로드 실패 (콘솔 확인)");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        disabled={loading}
      />

      {loading && <p>⏳ 업로드 중...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}