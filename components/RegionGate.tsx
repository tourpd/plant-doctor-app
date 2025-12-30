// components/RegionGate.tsx
"use client";

import { useEffect, useState } from "react";

/* =========================
   TYPES
========================= */
type Region = {
  province: string;
  city: string;
};

type Props = {
  onConfirm: (region: Region) => void;
};

/* =========================
   REGION DATA (예시)
   - 이미 region/data 있으면 그걸로 교체 가능
========================= */
const REGIONS: Record<string, string[]> = {
  "경기": ["고양시", "파주시", "김포시", "수원시"],
  "충남": ["홍성군", "예산군", "서산시", "태안군"],
  "전북": ["익산시", "김제시", "정읍시"],
  "경북": ["구미시", "상주시", "문경시"],
  "전남": ["나주시", "해남군", "무안군"],
  "강원": ["원주시", "강릉시", "춘천시"],
};

/* =========================
   COMPONENT
========================= */
export default function RegionGate({ onConfirm }: Props) {
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");

  /* =========================
     자동 오픈 (첫 진입)
  ========================= */
  useEffect(() => {
    const saved = localStorage.getItem("farmer_region");
    if (saved) {
      onConfirm(JSON.parse(saved));
    }
  }, [onConfirm]);

  /* =========================
     CONFIRM
  ========================= */
  const confirm = () => {
    if (!province || !city) return;
    const region = { province, city };
    localStorage.setItem("farmer_region", JSON.stringify(region));
    onConfirm(region);
  };

  /* =========================
     RENDER
  ========================= */
  return (
    <div style={overlay}>
      <div style={card}>
        <h2 style={title}>
          정확한 진단을 위해<br />
          농사 지역을 먼저 한 번만 등록해 주세요
        </h2>

        <div style={sub}>
          이후에는 다시 묻지 않습니다.
        </div>

        {/* 도 선택 */}
        <select
          value={province}
          onChange={(e) => {
            setProvince(e.target.value);
            setCity("");
          }}
          style={select}
        >
          <option value="">도 선택</option>
          {Object.keys(REGIONS).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        {/* 시/군 선택 */}
        {province && (
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={select}
          >
            <option value="">시·군 선택</option>
            {REGIONS[province].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={confirm}
          disabled={!province || !city}
          style={{
            ...btn,
            opacity: province && city ? 1 : 0.4,
          }}
        >
          📍 이 지역으로 시작하기
        </button>
      </div>
    </div>
  );
}

/* =========================
   STYLES
========================= */
const overlay = {
  position: "fixed" as const,
  inset: 0,
  background: "rgba(0,0,0,0.92)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
};

const card = {
  width: "100%",
  maxWidth: 420,
  padding: 24,
  borderRadius: 20,
  background: "#0b0b0b",
  border: "3px solid #00ff88",
};

const title = {
  fontSize: 20,
  fontWeight: 900,
  color: "#00ff88",
  textAlign: "center" as const,
};

const sub = {
  marginTop: 8,
  marginBottom: 16,
  fontSize: 14,
  color: "#aaa",
  textAlign: "center" as const,
};

const select = {
  width: "100%",
  padding: 14,
  marginTop: 10,
  borderRadius: 12,
  background: "#000",
  color: "#fff",
  border: "1px solid #333",
  fontSize: 16,
};

const btn = {
  width: "100%",
  marginTop: 18,
  padding: 16,
  borderRadius: 14,
  background: "#00ff88",
  color: "#000",
  fontWeight: 900,
  fontSize: 16,
  border: "none",
};