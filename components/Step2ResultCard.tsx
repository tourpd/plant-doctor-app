"use client";

import { useState } from "react";
import PhotoDoctorSalesCTA from "./PhotoDoctorSalesCTA";

type DiseaseProb = {
  name: string;
  probability: number;
};

type Step2Result = {
  disease_probabilities: DiseaseProb[];
  summary: string;
  immediate_actions: string[];
};

type ProductCandidates = {
  insect: string[];
  fungal: string[];
  eco: string[];
};

interface Props {
  result: Step2Result;
  products: ProductCandidates;
  disclaimer: string;
}

export default function Step2ResultCard({
  result,
  products,
  disclaimer,
}: Props) {
  const [showProducts, setShowProducts] = useState(false);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 420,
        background: "#0d0d0d",
        borderRadius: 16,
        padding: 16,
        color: "#fff",
        border: "3px solid #ffd400",
        marginBottom: 30,
      }}
    >
      <h3 style={{ color: "#ffd400", marginBottom: 10 }}>
        📊 가능성 있는 원인
      </h3>

      {result.disease_probabilities.map((d) => (
        <div key={d.name} style={{ marginBottom: 10 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 14,
              marginBottom: 4,
            }}
          >
            <span>{d.name}</span>
            <span>{d.probability}%</span>
          </div>

          <div
            style={{
              width: "100%",
              height: 10,
              background: "#333",
              borderRadius: 6,
            }}
          >
            <div
              style={{
                width: `${d.probability}%`,
                height: "100%",
                background: "#00ff88",
                borderRadius: 6,
              }}
            />
          </div>
        </div>
      ))}

      <div style={{ marginTop: 14, color: "#00ff88", fontWeight: 700 }}>
        🧠 판단 요약
      </div>

      <p style={{ marginTop: 6, lineHeight: 1.6 }}>{result.summary}</p>

      <div style={{ marginTop: 14, color: "#ff8888", fontWeight: 700 }}>
        🧭 지금 당장 할 수 있는 행동
      </div>

      <ul style={{ marginTop: 6 }}>
        {result.immediate_actions.map((a, i) => (
          <li key={i} style={{ marginBottom: 6 }}>
            - {a}
          </li>
        ))}
      </ul>

      <button
        onClick={() => setShowProducts(!showProducts)}
        style={{
          marginTop: 14,
          width: "100%",
          height: 44,
          borderRadius: 12,
          border: "none",
          background: "#222",
          color: "#ffd400",
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        🧪 관련 자재 보기 {showProducts ? "▲" : "▼"}
      </button>

      {showProducts && (
        <div
          style={{
            marginTop: 12,
            background: "#111",
            borderRadius: 12,
            padding: 12,
            fontSize: 14,
          }}
        >
          <ProductGroup title="해충 관리" items={products.insect} />
          <ProductGroup title="곰팡이·병원균" items={products.fungal} />
          <ProductGroup title="환경·스트레스" items={products.eco} />
        </div>
      )}

      <div
        style={{
          marginTop: 16,
          fontSize: 12,
          color: "#aaa",
          borderTop: "1px solid #333",
          paddingTop: 10,
          lineHeight: 1.5,
        }}
      >
        ⚠️ {disclaimer}
      </div>
    </div>
  );
}

function ProductGroup({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (!items || items.length === 0) return null;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: "#00bfff", marginBottom: 8, fontWeight: 800 }}>
        • {title}
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {items.map((p) => (
          <div
            key={p}
            style={{
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <div
              style={{
                marginBottom: 8,
                color: "#fff",
                fontWeight: 800,
                lineHeight: 1.5,
              }}
            >
              🧪 {p}
            </div>

            <PhotoDoctorSalesCTA productName={p} />
          </div>
        ))}
      </div>
    </div>
  );
}