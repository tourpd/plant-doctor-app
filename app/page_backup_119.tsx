"use client";

import { useEffect, useState } from "react";

type DiagnoseResponse = {
  ok?: boolean;
  result?: string;
  error?: string;
};

export default function Page() {
  const [crop, setCrop] = useState("");
  const [symptom, setSymptom] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 미리보기 URL 관리
  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  // 파일 선택 (카메라든 갤러리든 공통)
  const handleSelectFile = (file: File | null) => {
    if (!file) return;
    setImageFile(file);
    setResult(null);
    setError(null);
  };

  // AI 진단 호출
  const handleSubmit = async () => {
    if (!imageFile) {
      setError("📸 먼저 사진을 찍거나 선택해 주세요.");
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
        throw new Error(`서버 오류: ${res.status}`);
      }

      const data: DiagnoseResponse = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // JSON 전체가 아니라, 오직 result 문자열만 사용
      if (data.result && typeof data.result === "string") {
        setResult(data.result);
      } else {
        // 혹시 모를 예외용 – 디버그 정보 최소만 노출
        setResult("진단 결과 형식이 예상과 다릅니다. 다시 시도해 주세요.");
        console.warn("Unexpected diagnose response:", data);
      }
    } catch (e: any) {
      setError(e?.message || "진단 요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        background: "#050807",
        minHeight: "100vh",
        color: "#e8ffef",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 16px" }}>
        {/* 헤더 */}
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, display: "flex", gap: 8 }}>
            🐞 또봉이 병해 사진 진단
          </h1>
          <p style={{ fontSize: 13, color: "#9be7b8", marginTop: 4 }}>
            사진을 찍거나 올리면, 농민이 바로 행동할 수 있는 진단 카드를 만들어 드립니다.
          </p>
        </header>

        {/* 상단: 입력 + 미리보기 */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr)",
            gap: 16,
          }}
        >
          {/* ① 진단 정보 입력 */}
          <div
            style={{
              borderRadius: 14,
              border: "1px solid #21d97a",
              background: "#07110c",
              padding: 14,
            }}
          >
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              ① 진단 정보 입력
            </h2>

            <label style={labelStyle}>
              작물명
              <input
                style={inputStyle}
                placeholder="예: 양파, 마늘, 옥수수"
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
              />
            </label>

            <label style={labelStyle}>
              증상 설명 (선택)
              <textarea
                style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                placeholder="예: 잎 끝이 마르고 갈색 반점이 보임"
                value={symptom}
                onChange={(e) => setSymptom(e.target.value)}
              />
            </label>

            {/* 촬영 / 업로드 버튼 */}
            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 8,
                flexWrap: "wrap",
              }}
            >
              {/* 카메라 직촬영 */}
              <label style={btnGreenOutline}>
                📸 바로 촬영
                <input
                  hidden
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) =>
                    handleSelectFile(e.target.files?.[0] || null)
                  }
                />
              </label>

              {/* 갤러리 선택 */}
              <label style={btnBlueOutline}>
                🖼 사진 고르기
                <input
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleSelectFile(e.target.files?.[0] || null)
                  }
                />
              </label>
            </div>

            {/* 진단 버튼 */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                marginTop: 12,
                width: "100%",
                padding: "12px 0",
                borderRadius: 10,
                border: "none",
                background: loading ? "#1b8c52" : "#16f06e",
                color: "#021107",
                fontWeight: 700,
                cursor: loading ? "default" : "pointer",
                fontSize: 15,
              }}
            >
              {loading ? "🧠 AI가 사진을 분석 중입니다..." : "🧠 AI 진단 요청"}
            </button>

            {error && (
              <p style={{ color: "#ff8080", marginTop: 6, fontSize: 13 }}>
                ❌ {error}
              </p>
            )}
          </div>

          {/* ② 사진 미리보기 */}
          <div
            style={{
              borderRadius: 14,
              border: "1px solid #21d97a",
              background: "#07110c",
              padding: 14,
              minHeight: 260,
            }}
          >
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              ② 사진 미리보기
            </h2>

            {previewUrl ? (
              <div
                style={{
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "1px solid #1c8c57",
                  background: "#000",
                  maxHeight: 360,
                }}
              >
                <img
                  src={previewUrl}
                  alt="병해 사진 미리보기"
                  style={{
                    display: "block",
                    width: "100%",
                    objectFit: "contain",
                    maxHeight: 360,
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  borderRadius: 12,
                  border: "1px dashed #355e48",
                  color: "#7bbd95",
                  fontSize: 13,
                  padding: "40px 12px",
                  textAlign: "center",
                }}
              >
                📸 병해가 의심되는 부분을 가까이에서 찍거나, 이미 찍어둔 사진을 선택해 주세요.
              </div>
            )}
          </div>
        </section>

        {/* ③ 농민 진단 카드 */}
        <section
          style={{
            marginTop: 18,
            borderRadius: 14,
            border: "1px solid #21d97a",
            background: "#021008",
            padding: 14,
          }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
            ③ 농민 진단 카드
          </h2>

          {!result && !loading && (
            <p style={{ fontSize: 13, color: "#7bbd95" }}>
              사진을 올리고 <b>AI 진단 요청</b>을 누르시면, 작물 · 병명 · 지금 할 일 · 약제
              추천이 카드 형식으로 표시됩니다.
            </p>
          )}

          {result && (
            <div
              style={{
                borderRadius: 12,
                border: "1px solid #22c96a",
                background:
                  "linear-gradient(135deg, rgba(7,35,21,0.95), rgba(3,19,11,0.98))",
                padding: 14,
                marginTop: 4,
              }}
            >
              {/* 실제 카드 텍스트 */}
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  margin: 0,
                  fontFamily: "inherit",
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "#d6ffe5",
                }}
              >
                {result}
              </pre>

              {/* 버튼 영역 */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 12,
                  flexWrap: "wrap",
                }}
              >
                <button
                  style={btnGreenSolid}
                  onClick={() =>
                    alert("48~72시간 뒤, 같은 위치에서 다시 촬영해 주세요.")
                  }
                >
                  ⏰ 재촬영 알림
                </button>
                <button
                  style={btnOrangeSolid}
                  onClick={() =>
                    alert("향후 버전에서 회사별·성분별 약제 정보를 연결할 수 있습니다.")
                  }
                >
                  💊 약제 보기
                </button>
              </div>

              <p
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: "#97e9b6",
                }}
              >
                👉 48~72시간 후 동일 위치를 다시 촬영하면, 방제 효과와 병해 진행을 더 정확히
                확인할 수 있습니다.
              </p>

              <p
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color: "#619577",
                }}
              >
                ※ 본 진단 카드는{" "}
                <b>농촌진흥청 병해충 자료와 현장 사진</b>을 기반으로 한 AI 추정입니다. 최종
                방제 전에는 반드시 라벨과 안전사용기준을 확인해 주세요.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "#9be7b8",
  marginTop: 6,
  marginBottom: 2,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#020907",
  borderRadius: 8,
  border: "1px solid #265f41",
  padding: "8px 10px",
  color: "#e8ffef",
  fontSize: 13,
  outline: "none",
} as const;

const btnGreenOutline: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid #1fe074",
  padding: "8px 10px",
  fontSize: 13,
  background: "#07150d",
  color: "#b6ffda",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
} as const;

const btnBlueOutline: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid #3a91ff",
  padding: "8px 10px",
  fontSize: 13,
  background: "#050c18",
  color: "#d6e6ff",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
} as const;

const btnGreenSolid: React.CSSProperties = {
  borderRadius: 999,
  border: "none",
  padding: "8px 14px",
  fontSize: 13,
  background: "#1fe074",
  color: "#022212",
  cursor: "pointer",
  fontWeight: 600,
} as const;

const btnOrangeSolid: React.CSSProperties = {
  borderRadius: 999,
  border: "none",
  padding: "8px 14px",
  fontSize: 13,
  background: "#ffa53a",
  color: "#2b1600",
  cursor: "pointer",
  fontWeight: 600,
} as const;
