"use client";

import { useMemo, useRef, useState } from "react";

type Step1Question = {
  id: string;
  question?: string;
  q?: string;
  choices?: string[];
  options?: string[];
  required?: boolean;
  multi?: boolean;
  type?: "single" | "multi";
};

type Disease = { name: string; probability: number; reason?: string };

type VisionApiResponse =
  | {
      ok: true;
      step: "STEP1";
      crop_guess?: { name: string; confidence: number };
      lead_message?: string;
      questions?: Step1Question[];
    }
  | {
      ok: true;
      step: "STEP2";
      result: {
        summary?: string;
        possible_diseases?: Disease[];
        chemical_products?: Record<string, string[]>;
        eco_friendly_products?: Record<string, string[]>;
        immediate_actions?: string[];
        followup_message?: string;
      };
      disclaimer?: string;
    }
  | { ok: false; error: string };

const FOLLOWUP_FALLBACK = `
병해는 하루아침에 끝나지 않습니다.

방제 후 3~4일,
때로는 1주일 뒤의 모습이
진짜 판단의 기준이 됩니다.

언제든 다시 사진을 올려주세요.
한국농수산TV 포토닥터는
언제나 농민 곁에 있습니다.
`.trim();

export default function AiPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [api, setApi] = useState<VisionApiResponse | null>(null);

  const [answers, setAnswers] = useState<{ id: string; choice: string | string[] }[]>([]);
  const [qIndex, setQIndex] = useState(0);

  // 📍 위치정보(B안): “수집/전송만”, 화면표시는 절대 안 함
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const EMERGENCY_119_URL =
    process.env.NEXT_PUBLIC_EMERGENCY_119_URL || "https://forms.gle/REPLACE_ME";

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetAll = () => {
    setApi(null);
    setAnswers([]);
    setQIndex(0);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    resetAll();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        () => setLocation(null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  const startStep1 = async () => {
    if (!file) return alert("사진을 먼저 업로드해주세요.");

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      if (location) fd.append("location", JSON.stringify(location));

      const res = await fetch("/api/vision", { method: "POST", body: fd });
      const data = (await res.json()) as VisionApiResponse;

      setApi(data);
      setAnswers([]);
      setQIndex(0);
    } catch {
      setApi({ ok: false, error: "STEP1 호출 실패" });
    } finally {
      setLoading(false);
    }
  };

  const step1Questions = useMemo<Step1Question[]>(() => {
    if (api?.ok === true && api.step === "STEP1") return Array.isArray(api.questions) ? api.questions : [];
    return [];
  }, [api]);

  const currentQ = step1Questions[qIndex];
  const qText = currentQ?.question ?? currentQ?.q ?? "";
  const qChoices = currentQ?.choices ?? currentQ?.options ?? [];
  const qMulti = Boolean(currentQ?.multi) || currentQ?.type === "multi";
  const qRequired = Boolean(currentQ?.required);

  const currentAnswer = useMemo(() => {
    if (!currentQ) return undefined;
    return answers.find((a) => a.id === currentQ.id)?.choice;
  }, [answers, currentQ]);

  const selectAnswer = (value: string) => {
    if (!currentQ) return;

    if (qMulti) {
      const prev = Array.isArray(currentAnswer) ? currentAnswer : [];
      const next = prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value];
      setAnswers((a) => [...a.filter((x) => x.id !== currentQ.id), { id: currentQ.id, choice: next }]);
    } else {
      setAnswers((a) => [...a.filter((x) => x.id !== currentQ.id), { id: currentQ.id, choice: value }]);
    }
  };

  const goNextOrStep2 = async () => {
    if (!currentQ) return;

    const hasAnswer =
      typeof currentAnswer === "string"
        ? currentAnswer.trim().length > 0
        : Array.isArray(currentAnswer)
        ? currentAnswer.length > 0
        : false;

    if (qRequired && !hasAnswer) return alert("이 질문은 반드시 선택해야 합니다.");

    if (qIndex < step1Questions.length - 1) {
      setQIndex((v) => v + 1);
      return;
    }

    if (!file) return;

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("answers", JSON.stringify(answers));
      if (location) fd.append("location", JSON.stringify(location));

      const res = await fetch("/api/vision", { method: "POST", body: fd });
      const data = (await res.json()) as VisionApiResponse;

      setApi(data);
    } catch {
      setApi({ ok: false, error: "STEP2 호출 실패" });
    } finally {
      setLoading(false);
    }
  };

  const isStep1 = api?.ok === true && api.step === "STEP1";
  const isStep2 = api?.ok === true && api.step === "STEP2";

  const step2 = isStep2 ? api : null;
  const step2Result = step2?.result;

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: 20 }}>
      <div style={{ maxWidth: 420, margin: "0 auto" }}>
        <h1 style={{ textAlign: "center", fontSize: 34, color: "#00ff88", fontWeight: 900, marginTop: 6 }}>
          포토닥터
        </h1>
        <p style={{ textAlign: "center", color: "#ffd400", fontWeight: 900, marginTop: 6 }}>
          한국농수산TV가 농민을 위해 만든 AI 진단 서비스입니다.
        </p>

        {/* 업로드 박스 */}
        <label
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: "block",
            marginTop: 18,
            padding: 18,
            border: "3px dashed #00ff88",
            borderRadius: 18,
            textAlign: "center",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900, color: "#00ff88" }}>📸 사진 업로드</div>
          <div style={{ marginTop: 8, color: "#ffd400", fontWeight: 800, lineHeight: 1.35 }}>
            ※ 사진은 미리 촬영 후
            <br />
            갤러리에서 저장된 사진을 선택해 업로드해 주세요.
          </div>
          <input ref={fileInputRef} type="file" hidden accept="image/*" onChange={handleFile} />
        </label>

        {/* 사진 + 로딩(빙글빙글은 사진 위에서만) */}
        {preview && (
          <div style={{ position: "relative", marginTop: 14 }}>
            <img
              src={preview}
              alt="preview"
              style={{
                width: "100%",
                borderRadius: 16,
                border: "3px solid #00ff88",
                display: "block",
              }}
            />

            {loading && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 16,
                  background: "rgba(0,0,0,0.45)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    border: "3px solid rgba(255,255,255,0.2)",
                    borderTop: "3px solid #00ff88",
                    animation: "spin 0.9s linear infinite",
                  }}
                />
              </div>
            )}
          </div>
        )}

        <style jsx global>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>

        {!isStep1 && !isStep2 && (
          <button
            onClick={startStep1}
            disabled={loading}
            style={{
              width: "100%",
              height: 64,
              marginTop: 18,
              background: "#00cc44",
              borderRadius: 18,
              fontSize: 22,
              fontWeight: 900,
              border: "none",
              cursor: "pointer",
            }}
          >
            🧠 AI 진단 시작
          </button>
        )}

        {api?.ok === false && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 14,
              background: "#2a0000",
              border: "1px solid #ff4444",
              color: "#ffaaaa",
              fontWeight: 900,
            }}
          >
            오류: {api.error}
          </div>
        )}

        {/* STEP1 */}
        {isStep1 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ padding: 14, borderRadius: 16, background: "#0b0b0b", border: "1px solid #222" }}>
              <div style={{ fontWeight: 900, color: "#00ff88" }}>🌿 작물 추정</div>
              <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900 }}>
                {(api.crop_guess?.name || "작물") + " "}
                <span style={{ color: "#ffd400", fontSize: 14 }}>
                  (신뢰도 {Math.round((api.crop_guess?.confidence ?? 0) * 100)}%)
                </span>
              </div>
              <div style={{ marginTop: 10, color: "#ffd400", fontWeight: 900, lineHeight: 1.35 }}>
                {api.lead_message || "정확한 진단을 위해 몇 가지 질문을 드리겠습니다."}
              </div>
            </div>

            {currentQ && (
              <div style={{ marginTop: 14, padding: 14, borderRadius: 16, background: "#111", border: "1px solid #222" }}>
                <div style={{ color: "#aaa" }}>
                  질문 {qIndex + 1} / {step1Questions.length}
                </div>
                <div style={{ marginTop: 8, fontSize: 20, fontWeight: 900 }}>❓ {qText}</div>

                <div style={{ marginTop: 12 }}>
                  {qChoices.map((c) => {
                    const checked = Array.isArray(currentAnswer)
                      ? currentAnswer.includes(c)
                      : currentAnswer === c;

                    return (
                      <label
                        key={c}
                        style={{
                          display: "block",
                          padding: 12,
                          marginBottom: 10,
                          borderRadius: 12,
                          border: "2px solid #00bfff",
                          background: checked ? "#002233" : "#000",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type={qMulti ? "checkbox" : "radio"}
                          checked={checked}
                          onChange={() => selectAnswer(c)}
                          style={{ marginRight: 8 }}
                        />
                        {c}
                      </label>
                    );
                  })}
                </div>

                <button
                  onClick={goNextOrStep2}
                  disabled={loading}
                  style={{
                    width: "100%",
                    height: 56,
                    marginTop: 6,
                    background: "#00cc44",
                    borderRadius: 14,
                    fontSize: 18,
                    fontWeight: 900,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {qIndex === step1Questions.length - 1 ? "진단 결과 보기 →" : "다음 →"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP2 (여기가 지금 “출력 누락”돼서 스샷 문제가 난 겁니다) */}
        {isStep2 && (
          <div style={{ marginTop: 20, padding: 18, borderRadius: 20, border: "3px solid #ffd400", background: "#111" }}>
            <h2 style={{ fontSize: 22, fontWeight: 900 }}>📌 진단 결과</h2>

            <p style={{ marginTop: 10, lineHeight: 1.4 }}>
              {step2Result?.summary || "진단 결과를 정리했습니다."}
            </p>

            {/* 의심 병해 */}
            {step2Result?.possible_diseases?.length ? (
              <>
                <h3 style={{ marginTop: 14, fontWeight: 900 }}>🦠 의심 병해</h3>
                {step2Result.possible_diseases.slice(0, 3).map((d, i) => (
                  <div key={i} style={{ marginTop: 6 }}>
                    • <b>{d.name}</b> ({d.probability}%)
                    {d.reason ? <div style={{ color: "#aaa", marginTop: 4 }}>- {d.reason}</div> : null}
                  </div>
                ))}
              </>
            ) : null}

            {/* 농약 추천(실제 리스트만 표시하도록 서버에서 보장) */}
            {step2Result?.chemical_products && Object.keys(step2Result.chemical_products).length ? (
              <>
                <h3 style={{ marginTop: 14, fontWeight: 900 }}>🧪 추천 농약(상표명)</h3>
                {Object.entries(step2Result.chemical_products).map(([k, arr]) => (
                  <div key={k} style={{ marginTop: 6 }}>
                    <div style={{ color: "#ffd400", fontWeight: 900 }}>{k}</div>
                    <div style={{ color: "#ddd", marginTop: 4 }}>{(arr || []).join(" · ")}</div>
                  </div>
                ))}
              </>
            ) : null}

            {/* 친환경 추천(실제 리스트만 표시하도록 서버에서 보장) */}
            {step2Result?.eco_friendly_products && Object.keys(step2Result.eco_friendly_products).length ? (
              <>
                <h3 style={{ marginTop: 14, fontWeight: 900 }}>🌱 추천 친환경/유기농 자재(상표명)</h3>
                {Object.entries(step2Result.eco_friendly_products).map(([k, arr]) => (
                  <div key={k} style={{ marginTop: 6 }}>
                    <div style={{ color: "#00ff88", fontWeight: 900 }}>{k}</div>
                    <div style={{ color: "#ddd", marginTop: 4 }}>{(arr || []).join(" · ")}</div>
                  </div>
                ))}
              </>
            ) : null}

            {/* 즉시 조치 */}
            {step2Result?.immediate_actions?.length ? (
              <>
                <h3 style={{ marginTop: 14, fontWeight: 900 }}>✅ 지금 바로 할 일</h3>
                {step2Result.immediate_actions.map((a, i) => (
                  <div key={i} style={{ marginTop: 6 }}>
                    • {a}
                  </div>
                ))}
              </>
            ) : null}

            {/* 고정 멘트(절대 삭제 금지) */}
            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 14,
                background: "#0b0b0b",
                border: "1px solid #222",
                color: "#ffd400",
                fontWeight: 900,
                lineHeight: 1.55,
                whiteSpace: "pre-line",
              }}
            >
              {step2Result?.followup_message || FOLLOWUP_FALLBACK}
            </div>

            <button
              onClick={() => window.open(EMERGENCY_119_URL, "_blank")}
              style={{
                width: "100%",
                height: 58,
                marginTop: 14,
                background: "#ff2222",
                borderRadius: 14,
                fontSize: 18,
                fontWeight: 900,
                border: "none",
                cursor: "pointer",
              }}
            >
              ☎️ 농사 119 출동 요청
            </button>

            <div style={{ marginTop: 10, fontSize: 12, color: "#777", lineHeight: 1.35 }}>
              {step2?.disclaimer || "이 진단은 참고용이며 최종 판단과 방제는 농민 본인의 책임입니다."}
            </div>

            <button
              onClick={resetAll}
              style={{
                width: "100%",
                height: 50,
                marginTop: 10,
                background: "#222",
                borderRadius: 14,
                fontSize: 16,
                fontWeight: 900,
                border: "1px solid #333",
                cursor: "pointer",
                color: "#fff",
              }}
            >
              다른 사진으로 다시 진단
            </button>
          </div>
        )}
      </div>
    </main>
  );
}