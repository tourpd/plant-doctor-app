"use client";

import { useEffect, useMemo, useState } from "react";

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

type RecommendItem = {
  id?: string;
  product_name: string;
  product_slug?: string | null;
  booth_id?: string | null;
  recommend_order?: number | null;
  recommend_label?: string | null;
  recommend_reason?: string | null;
  button_text?: string | null;
  button_link?: string | null;
};

interface Props {
  result: Step2Result;
  products: ProductCandidates;
  disclaimer: string;
}

const EXPO_BASE_URL = "https://k-agri-expo.vercel.app";
const RECOMMEND_API = `${EXPO_BASE_URL}/api/photodoctor/recommend-booths`;

function getDiagnosisText(result: Step2Result) {
  const names = result.disease_probabilities.map((d) => d.name).join(" ");
  return [names, result.summary, ...result.immediate_actions]
    .filter(Boolean)
    .join(" ");
}

function getBuyLink(item: RecommendItem) {
  if (item.button_link) return item.button_link;

  if (item.product_slug) {
    return `${EXPO_BASE_URL}/expo/products/${encodeURIComponent(
      item.product_slug
    )}`;
  }

  return `${EXPO_BASE_URL}/photodoctor/buy?product=${encodeURIComponent(
    item.product_name
  )}`;
}

export default function Step2ResultCard({
  result,
  products,
  disclaimer,
}: Props) {
  const [showProducts, setShowProducts] = useState(true);
  const [recommended, setRecommended] = useState<RecommendItem[]>([]);
  const [loading, setLoading] = useState(false);

  const diagnosisText = useMemo(() => getDiagnosisText(result), [result]);

  useEffect(() => {
    async function loadRecommendProducts() {
      if (!diagnosisText) return;

      setLoading(true);

      try {
        const res = await fetch(RECOMMEND_API, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            crop_name: "",
            issue_type: diagnosisText,
            diagnosis_text: diagnosisText,
          }),
        });

        const json = await res.json();

        if (json?.success || json?.ok) {
          setRecommended(json.items || []);
        }
      } catch {
        setRecommended([]);
      } finally {
        setLoading(false);
      }
    }

    loadRecommendProducts();
  }, [diagnosisText]);

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
          height: 48,
          borderRadius: 12,
          border: "none",
          background: "#16a34a",
          color: "#fff",
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
        🧪 추천 자재 / 구매 연결 {showProducts ? "▲" : "▼"}
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
          {loading && (
            <div style={{ color: "#aaa", lineHeight: 1.6 }}>
              추천 자재를 찾는 중입니다...
            </div>
          )}

          {!loading && recommended.length > 0 && (
            <div style={{ display: "grid", gap: 12 }}>
              {recommended.map((item, index) => (
                <div
                  key={`${item.product_name}-${index}`}
                  style={{
                    border: "1px solid #333",
                    borderRadius: 12,
                    padding: 12,
                    background: "#171717",
                  }}
                >
                  <div
                    style={{
                      color: "#00ff88",
                      fontSize: 12,
                      fontWeight: 900,
                      marginBottom: 4,
                    }}
                  >
                    추천 {item.recommend_order || index + 1}순위
                  </div>

                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 900,
                      color: "#fff",
                    }}
                  >
                    {item.product_name}
                  </div>

                  {item.recommend_label && (
                    <div
                      style={{
                        marginTop: 6,
                        color: "#ffd400",
                        fontSize: 13,
                        fontWeight: 900,
                      }}
                    >
                      {item.recommend_label}
                    </div>
                  )}

                  {item.recommend_reason && (
                    <div
                      style={{
                        marginTop: 8,
                        color: "#ccc",
                        fontSize: 13,
                        lineHeight: 1.5,
                      }}
                    >
                      {item.recommend_reason}
                    </div>
                  )}

                  <a
                    href={getBuyLink(item)}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "block",
                      marginTop: 10,
                      height: 44,
                      lineHeight: "44px",
                      borderRadius: 10,
                      background: "#dc2626",
                      color: "#fff",
                      textAlign: "center",
                      textDecoration: "none",
                      fontWeight: 900,
                    }}
                  >
                    🚨 지금 바로 구매 / 상담하기
                  </a>

                  {item.booth_id && (
                    <a
                      href={`${EXPO_BASE_URL}/expo/booths/${item.booth_id}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "block",
                        marginTop: 8,
                        height: 40,
                        lineHeight: "40px",
                        borderRadius: 10,
                        border: "1px solid #444",
                        color: "#fff",
                        textAlign: "center",
                        textDecoration: "none",
                        fontWeight: 800,
                      }}
                    >
                      업체 부스 보기
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {!loading && recommended.length === 0 && (
            <>
              <div
                style={{
                  color: "#aaa",
                  marginBottom: 10,
                  lineHeight: 1.6,
                  fontWeight: 700,
                }}
              >
                아직 판매 연결된 추천 자재가 없습니다.
                <br />
                기본 자재 후보를 표시합니다.
              </div>

              <ProductGroup title="해충 관리" items={products.insect} />
              <ProductGroup title="곰팡이·병원균" items={products.fungal} />
              <ProductGroup title="환경·스트레스" items={products.eco} />
            </>
          )}
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

function ProductGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: "#00bfff", marginBottom: 4 }}>• {title}</div>
      <ul>
        {items.map((p) => (
          <li key={p}>- {p}</li>
        ))}
      </ul>
    </div>
  );
}