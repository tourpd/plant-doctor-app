// app/region/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type RegionMap = {
  [key: string]: string[];
};

const REGION_MAP: RegionMap = {
  "충청남도": ["홍성군", "예산군", "서산시", "태안군", "논산시"],
  "경기도": ["고양시", "파주시", "연천군", "김포시"],
  "전라남도": ["해남군", "나주시", "무안군"],
  "제주특별자치도": ["제주시", "서귀포시"],
};

export default function RegionPage() {
  const router = useRouter();

  const [sido, setSido] = useState("");
  const [sigungu, setSigungu] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("region");
    if (saved) {
      router.replace("/ai");
    }
  }, [router]);

  const start = () => {
    if (!sido || !sigungu) {
      alert("지역을 모두 선택해 주세요.");
      return;
    }

    const region = `${sido} ${sigungu}`;

    // farmer_id 없으면 생성
    let farmerId = localStorage.getItem("farmer_id");
    if (!farmerId) {
      farmerId = crypto.randomUUID();
      localStorage.setItem("farmer_id", farmerId);
    }

    localStorage.setItem("region", region);

    router.replace("/ai");
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <h1 style={{ textAlign: "center", color: "#00ff88", fontSize: 28, fontWeight: 900 }}>
          📍 지역 입력
        </h1>

        <p style={{ marginTop: 10, color: "#ffd400", textAlign: "center", lineHeight: 1.6 }}>
          정확한 병해 진단을 위해<br />
          <b>지역은 단 1회만</b> 입력합니다.
        </p>

        {/* 시·도 */}
        <select
          value={sido}
          onChange={(e) => {
            setSido(e.target.value);
            setSigungu("");
          }}
          style={selectStyle}
        >
          <option value="">시·도 선택</option>
          {Object.keys(REGION_MAP).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {/* 시·군 */}
        <select
          value={sigungu}
          onChange={(e) => setSigungu(e.target.value)}
          style={selectStyle}
          disabled={!sido}
        >
          <option value="">시·군 선택</option>
          {sido &&
            REGION_MAP[sido].map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
        </select>

        <button
          onClick={start}
          style={{
            marginTop: 20,
            width: "100%",
            height: 56,
            borderRadius: 16,
            background: "#00ff88",
            color: "#000",
            fontSize: 18,
            fontWeight: 900,
            border: "none",
            cursor: "pointer",
          }}
        >
          이 지역으로 시작하기 →
        </button>
      </div>
    </main>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 14,
  padding: 14,
  borderRadius: 14,
  background: "#0b0b0b",
  border: "2px solid #00ff88",
  color: "#fff",
  fontSize: 16,
};