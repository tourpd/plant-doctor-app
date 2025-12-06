"use client";

import { useState } from "react";

export default function Page() {
  const [crop, setCrop] = useState("");
  const [symptom, setSymptom] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 파일 선택 (카메라 + 갤러리 공용)
  const onSelectFile = (file: File | null) => {
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  // AI 진단 요청
  const handleSubmit = async () => {
    if (!imageFile) {
      alert("사진을 선택하거나 촬영해 주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("crop", crop);
      formData.append("symptom", symptom);
      formData.append("image", imageFile);

      const res = await fetch("/api/diagnose", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("서버 응답 오류");
      }

      const data = await res.json();
      setResult(data.output || JSON.stringify(data, null, 2));
    } catch (err:any) {
      setError(err.message || "진단 요청 중 오류 발생");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ background:"#0b0f0d", color:"#aef3c0", padding:"24px", minHeight:"100vh" }}>
      <h1 style={{ fontSize:"24px" }}>🐞 또봉이 병해 사진 진단</h1>
      <p>사진을 찍거나 올리면 바로 농민 카드 처방을 제공합니다.</p>

      {/* ① 진단 입력 */}
      <section style={{ border:"1px solid #1fff7a", borderRadius:"12px", padding:"16px", marginTop:"16px" }}>
        <h3>① 진단 정보 입력</h3>

        <input
          style={inputStyle}
          placeholder="작물명 (예: 마늘, 양파, 옥수수)"
          value={crop}
          onChange={e => setCrop(e.target.value)}
        />

        <textarea
          style={{...inputStyle, minHeight:"80px"}}
          placeholder="증상 설명 (농민 말로 적어주세요)"
          value={symptom}
          onChange={e => setSymptom(e.target.value)}
        />

        <div style={{ display:"flex", gap:"12px", marginTop:"8px" }}>
          {/* 카메라 촬영 */}
          <label style={btnGreen}>
            📸 바로 촬영
            <input
              hidden
              type="file"
              accept="image/*"
              capture="environment"
              onChange={e => onSelectFile(e.target.files?.[0] || null)}
            />
          </label>

          {/* 갤러리 업로드 */}
          <label style={btnBlue}>
            🖼 사진 고르기
            <input
              hidden
              type="file"
              accept="image/*"
              onChange={e => onSelectFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>

        <button style={btnSubmit} onClick={handleSubmit} disabled={loading}>
          🧠 AI 진단 요청
        </button>
      </section>

      {/* ② 미리보기 */}
      {preview && (
        <section style={card}>
          <h3>② 사진 미리보기</h3>
          <img
            src={preview}
            style={{ width:"100%", maxWidth:"420px", borderRadius:"12px" }}
          />
        </section>
      )}

      {/* ③ 결과 카드 */}
      {result && (
        <section style={card}>
          <h3>③ 농민 진단 카드</h3>
          <pre style={resultBox}>{result}</pre>

          <div style={{ display:"flex", gap:"12px", marginTop:"8px" }}>
            <button
              style={btnGreen}
              onClick={() => alert("48~72시간 뒤 동일 위치를 다시 촬영하세요.")}
            >
              ⏰ 재촬영 알림
            </button>

            <button
              style={btnYellow}
              onClick={() => alert("약제 정보 상세 페이지 연결 예정")}
            >
              💊 약제 보기
            </button>
          </div>

          <p style={hint}>
            👉 48~72시간 후 동일 위치 재촬영 시 진단 정확도가 크게 향상됩니다.
          </p>
        </section>
      )}

      {/* 에러 */}
      {error && <p style={{ color:"red" }}>{error}</p>}
    </main>
  );
}

const inputStyle = {
  width:"100%",
  padding:"10px",
  background:"#020806",
  color:"#aef3c0",
  border:"1px solid #1fff7a",
  borderRadius:"8px",
  marginTop:"6px"
};

const card = {
  border:"1px solid #1fff7a",
  borderRadius:"12px",
  padding:"16px",
  marginTop:"16px",
  background:"#020806"
};

const btnGreen = {
  background:"#00d45b",
  color:"#000",
  padding:"10px 14px",
  borderRadius:"8px",
  border:"none",
  cursor:"pointer"
};

const btnBlue = {
  background:"#0077ff",
  color:"#fff",
  padding:"10px 14px",
  borderRadius:"8px",
  border:"none",
  cursor:"pointer"
};

const btnYellow = {
  background:"#ffaa00",
  color:"#000",
  padding:"10px 14px",
  borderRadius:"8px",
  border:"none",
  cursor:"pointer"
};

const btnSubmit = {
  marginTop:"12px",
  width:"100%",
  padding:"14px",
  background:"#00ff80",
  color:"#000",
  border:"none",
  borderRadius:"10px",
  cursor:"pointer",
  fontWeight:"bold"
};

const resultBox = {
  background:"#000",
  color:"#00ff70",
  padding:"12px",
  borderRadius:"8px",
  whiteSpace:"pre-wrap"
};

const hint = {
  marginTop:"8px",
  color:"#7fffaa",
  fontSize:"13px"
};
