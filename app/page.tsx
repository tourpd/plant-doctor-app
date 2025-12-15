"use client";

import { useEffect, useMemo, useState } from "react";

type Step1Question = {
  id: string;
  text: string;
  options: { value: string; label: string }[];
};

type Step1Response = {
  ok: boolean;
  step: "STEP1";
  crop_guess: string;
  observations: string[];
  can_finalize: boolean;
  why_uncertain?: string;
  questions?: Step1Question[];
  disease_top3?: { name: string; probability: number }[];
  debug_raw?: string;
  error?: string;
};

type Step2FinalResponse = {
  ok: boolean;
  step: "STEP2-FINAL";
  crop_guess: string;
  result: {
    disease_probabilities: { name: string; probability: number }[];
    summary: string;
    immediate_actions: string[];
    ask_expert_if: string[];
    product_intent?: string[];
  };
  product_candidates: {
    insect: string[];
    fungal: string[];
    eco: string[];
  };
  disclaimer: string;
  error?: string;
  debug_raw?: string;
};

function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div style={{ width: "100%", background: "#222", borderRadius: 999, height: 10 }}>
      <div
        style={{
          width: `${v}%`,
          height: 10,
          borderRadius: 999,
          background: "#00ff88",
        }}
      />
    </div>
  );
}

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const [step1, setStep1] = useState<Step1Response | null>(null);
  const [step2, setStep2] = useState<Step2FinalResponse | null>(null);

  // 질문 답변 상태: { [questionId]: optionValue }
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // 제품 접힘/펼침
  const [showProducts, setShowProducts] = useState(false);

  const selectedCount = useMemo(() => Object.keys(answers).length, [answers]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));

    // 초기화
    setStep1(null);
    setStep2(null);
    setAnswers({});
    setShowProducts(false);
  };

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // STEP1 호출
  const handleAnalyze = async () => {
    if (!file) {
      alert("사진을 선택해주세요.");
      return;
    }

    setLoading(true);
    setStep1(null);
    setStep2(null);
    setAnswers({});
    setShowProducts(false);

    try {
      const form = new FormData();
      form.append("image", file);

      const res = await fetch("/api/diagnose-new/final", {
        method: "POST",
        body: form,
      });

      const data: Step1Response = await res.json();
      setStep1(data);

      // can_finalize=true면 STEP2로 안 가도 되지만,
      // 당신 철학상 "확률 TOP3 + 책임문구 + 행동"은 STEP2에서 더 탄탄하게 만들기 때문에:
      // - 확정 가능이어도 질문이 없으면 바로 STEP2를 0개 답으로 보내지 않고
      // - STEP2는 "질문 답변 기반"이니 여기서는 일단 STEP1까지만 표시
      // (확정 가능한 케이스는 차후 '바로 최종안내' 버튼을 붙여 확장 가능)
    } catch (e) {
      setStep1({
        ok: false,
        step: "STEP1",
        crop_guess: "작물 미상",
        observations: [],
        can_finalize: false,
        error: "통신 오류가 발생했습니다.",
      });
    } finally {
      setLoading(false);
    }
  };

  // STEP2-FINAL 호출
  const runStep2Final = async () => {
    if (!step1?.ok) return;
    const qs = step1.questions || [];
    if (qs.length === 0) return;

    // qa 배열 구성
    const qa = qs
      .filter((q) => answers[q.id])
      .slice(0, 4)
      .map((q) => {
        const opt = q.options.find((o) => o.value === answers[q.id]);
        return { q: q.text, a: opt?.label || answers[q.id] };
      });

    if (qa.length < 1) {
      alert("질문에 최소 1개 이상 답해주세요.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/diagnose-new/step2-final", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crop_guess: step1.crop_guess,
          observations: step1.observations,
          qa,
        }),
      });

      const data: Step2FinalResponse = await res.json();
      setStep2(data);
      setShowProducts(false);
    } catch {
      setStep2({
        ok: false,
        step: "STEP2-FINAL",
        crop_guess: step1.crop_guess || "작물 미상",
        result: {
          disease_probabilities: [],
          summary: "",
          immediate_actions: [],
          ask_expert_if: [],
        },
        product_candidates: { insect: [], fungal: [], eco: [] },
        disclaimer:
          "본 정보는 참고용이며, 최종 판단과 자재 선택·사용 책임은 농민 본인에게 있습니다.",
        error: "STEP2 통신 오류가 발생했습니다.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        padding: 24,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* 타이틀 (기존 UI 유지) */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <img src="/logo-photodoctor.png" width={42} height={42} />
        <h1 style={{ color: "#00ff88", fontSize: 32, fontWeight: 900 }}>
          포토닥터
        </h1>
      </div>

      {/* 사진 업로드 (기존 UI 유지) */}
      <label
        style={{
          width: "100%",
          maxWidth: 420,
          minHeight: 150,
          border: "3px dashed #00ff88",
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#00ff88",
          cursor: "pointer",
          marginBottom: 14,
        }}
      >
        📸 사진 촬영 또는 업로드
        <input type="file" hidden accept="image/*" onChange={handleFile} />
      </label>

      {preview && (
        <img
          src={preview}
          style={{
            width: "100%",
            maxWidth: 420,
            borderRadius: 16,
            border: "3px solid #00ff88",
            marginBottom: 14,
          }}
        />
      )}

      {/* AI 진단 버튼 (기존 UI 유지) */}
      <button
        onClick={handleAnalyze}
        disabled={loading}
        style={{
          width: "100%",
          maxWidth: 420,
          height: 56,
          background: loading ? "#444" : "#00cc44",
          borderRadius: 16,
          border: "none",
          fontSize: 20,
          fontWeight: 800,
          marginBottom: 12,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "🧠 판단 중..." : "🧠 AI 진단 요청"}
      </button>

      {/* ===== 결과 영역 (기존 UI 감성 유지) ===== */}
      {step1 && (
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            border: "3px solid #ffd400",
            borderRadius: 16,
            padding: 16,
            background: "#0d0d0d",
            color: "#fff",
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 900, color: "#ffd400", marginBottom: 10, fontSize: 18 }}>
            📋 1차 진단 (사진 기반)
          </div>

          <div style={{ marginBottom: 10, color: "#00ff88", fontWeight: 800 }}>
            추론 작물: {step1.crop_guess || "작물 미상"}
          </div>

          {step1.observations?.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              {step1.observations.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          ) : (
            <div style={{ color: "#ff6666" }}>
              {step1.error || "1차 결과를 불러오지 못했습니다."}
            </div>
          )}

          {/* STEP1 확률 TOP3 (사진만 기반: 참고용) */}
          {step1.disease_top3?.length ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ color: "#00bfff", fontWeight: 900, marginBottom: 8 }}>
                📌 가능성 TOP3 (사진 기반 / 참고)
              </div>
              {step1.disease_top3.map((d, idx) => (
                <div key={idx} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                    <span>{d.name}</span>
                    <span style={{ color: "#00ff88", fontWeight: 900 }}>{d.probability}%</span>
                  </div>
                  <ProgressBar value={d.probability} />
                </div>
              ))}
              <div style={{ color: "#999", fontSize: 12, marginTop: 8 }}>
                ※ 사진 한 장만으로는 한계가 있어, 아래 질문 답변으로 정확도를 올립니다.
              </div>
            </div>
          ) : null}

          {/* 불확실 이유 + 질문 */}
          {step1.why_uncertain ? (
            <div style={{ marginTop: 12, color: "#ffb000", fontWeight: 800 }}>
              ⚠️ 왜 확정이 어려운가: <span style={{ fontWeight: 500 }}>{step1.why_uncertain}</span>
            </div>
          ) : null}

          {step1.questions?.length ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ color: "#00bfff", fontWeight: 900, marginBottom: 8 }}>
                🔍 원인을 가장 빨리 좁히는 질문 (최대 4개)
              </div>

              {step1.questions.slice(0, 4).map((q) => (
                <div
                  key={q.id}
                  style={{
                    border: "2px solid #00bfff",
                    borderRadius: 14,
                    padding: 12,
                    marginBottom: 10,
                    background: "#0a0a0a",
                  }}
                >
                  <div style={{ color: "#00bfff", fontWeight: 900, marginBottom: 10 }}>
                    {q.text}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {q.options.map((opt) => {
                      const selected = answers[q.id] === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() =>
                            setAnswers((prev) => ({
                              ...prev,
                              [q.id]: opt.value,
                            }))
                          }
                          style={{
                            padding: "10px 10px",
                            borderRadius: 12,
                            border: `2px solid ${selected ? "#00ff88" : "#00bfff"}`,
                            background: selected ? "#062" : "#000",
                            color: selected ? "#bfffe0" : "#00bfff",
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <button
                onClick={runStep2Final}
                disabled={loading || selectedCount < 1}
                style={{
                  width: "100%",
                  height: 54,
                  marginTop: 6,
                  background: loading ? "#444" : selectedCount < 1 ? "#333" : "#ff2b2b",
                  borderRadius: 16,
                  border: "none",
                  fontSize: 18,
                  fontWeight: 900,
                  cursor: loading ? "not-allowed" : "pointer",
                  color: "#fff",
                }}
              >
                {loading ? "🧠 2차 판단 중..." : `🧠 2차 최종 판단 받기 (${selectedCount}개 답변)`}
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* ===== STEP2-FINAL 결과 카드 (확률 그래프 + 제품 버튼(접힘) + 책임 문구 고정) ===== */}
      {step2 && (
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            border: "3px solid #ff4444",
            borderRadius: 16,
            padding: 16,
            background: "#0d0d0d",
            color: "#fff",
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 900, color: "#ff4444", marginBottom: 10, fontSize: 18 }}>
            ✅ 2차 최종 판단 (질문 답변 반영)
          </div>

          {!step2.ok ? (
            <div style={{ color: "#ff6666" }}>⚠️ {step2.error || "STEP2 실패"}</div>
          ) : (
            <>
              <div style={{ color: "#00ff88", fontWeight: 900, marginBottom: 8 }}>
                추론 작물: {step2.crop_guess || "작물 미상"}
              </div>

              {/* 요약 */}
              <div style={{ marginBottom: 12, lineHeight: 1.6 }}>
                <div style={{ color: "#ffd400", fontWeight: 900, marginBottom: 6 }}>
                  🧾 요약
                </div>
                <div>{step2.result.summary}</div>
              </div>

              {/* 병명 확률 TOP3 그래프 */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ color: "#00bfff", fontWeight: 900, marginBottom: 8 }}>
                  📊 가능성 TOP3 (확률)
                </div>
                {step2.result.disease_probabilities?.map((d, idx) => (
                  <div key={idx} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                      <span>{d.name}</span>
                      <span style={{ color: "#00ff88", fontWeight: 900 }}>{d.probability}%</span>
                    </div>
                    <ProgressBar value={d.probability} />
                  </div>
                ))}
              </div>

              {/* 즉시 행동 */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ color: "#ff8888", fontWeight: 900, marginBottom: 6 }}>
                  🧭 지금 당장 할 수 있는 행동
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                  {step2.result.immediate_actions?.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>

              {/* 전문가 상담 조건 */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ color: "#ffd400", fontWeight: 900, marginBottom: 6 }}>
                  ☎️ 이런 경우는 전문가 상담 권장
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                  {step2.result.ask_expert_if?.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>

              {/* 제품 버튼 (접힘) */}
              <button
                onClick={() => setShowProducts((v) => !v)}
                style={{
                  width: "100%",
                  height: 52,
                  background: "#111",
                  borderRadius: 14,
                  border: "2px solid #00ff88",
                  color: "#00ff88",
                  fontSize: 16,
                  fontWeight: 900,
                  cursor: "pointer",
                  marginBottom: 10,
                }}
              >
                {showProducts ? "▲ 제품/자재 추천 접기" : "▼ 제품/자재 추천 보기 (버튼형)"}
              </button>

              {showProducts && (
                <div style={{ border: "2px solid #222", borderRadius: 14, padding: 12, background: "#090909" }}>
                  <div style={{ color: "#00bfff", fontWeight: 900, marginBottom: 8 }}>
                    ✅ 버튼 눌러 참고용으로 확인하세요
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <div style={{ color: "#ffd400", fontWeight: 900, marginBottom: 6 }}>해충 계열</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {step2.product_candidates.insect.map((p, i) => (
                        <button
                          key={i}
                          onClick={() =>
                            alert(
                              `제품(참고): ${p}\n\n${step2.disclaimer}`
                            )
                          }
                          style={{
                            padding: "10px 12px",
                            borderRadius: 999,
                            border: "2px solid #00ff88",
                            background: "#000",
                            color: "#00ff88",
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <div style={{ color: "#ffd400", fontWeight: 900, marginBottom: 6 }}>살균/곰팡이 계열</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {step2.product_candidates.fungal.map((p, i) => (
                        <button
                          key={i}
                          onClick={() =>
                            alert(
                              `제품(참고): ${p}\n\n${step2.disclaimer}`
                            )
                          }
                          style={{
                            padding: "10px 12px",
                            borderRadius: 999,
                            border: "2px solid #00ff88",
                            background: "#000",
                            color: "#00ff88",
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "#ffd400", fontWeight: 900, marginBottom: 6 }}>친환경/유기 자재</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {step2.product_candidates.eco.map((p, i) => (
                        <button
                          key={i}
                          onClick={() =>
                            alert(
                              `제품(참고): ${p}\n\n${step2.disclaimer}`
                            )
                          }
                          style={{
                            padding: "10px 12px",
                            borderRadius: 999,
                            border: "2px solid #00ff88",
                            background: "#000",
                            color: "#00ff88",
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 책임 문구 고정 */}
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 14,
                  border: "2px solid #ffd400",
                  background: "#111",
                  color: "#ffd400",
                  fontWeight: 900,
                  lineHeight: 1.6,
                  fontSize: 13,
                }}
              >
                {step2.disclaimer}
              </div>
            </>
          )}
        </div>
      )}

      {/* 🚨 농사 119 (기존 UI 유지 / 절대 삭제 금지) */}
      <button
        onClick={() =>
          window.open(
            "https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform",
            "_blank"
          )
        }
        style={{
          width: "100%",
          maxWidth: 420,
          height: 56,
          background: "#ff2b2b",
          borderRadius: 16,
          border: "none",
          fontSize: 18,
          fontWeight: 900,
          marginBottom: 28,
          cursor: "pointer",
          color: "#fff",
        }}
      >
        🚨 농사 119 출동 요청
      </button>

      {/* 제작자 (기존 UI 유지 / 절대 삭제 금지) */}
      <div style={{ color: "#FFD400", fontSize: 16, marginBottom: 40 }}>
        제작: 한국농수산TV
      </div>
    </main>
  );
}