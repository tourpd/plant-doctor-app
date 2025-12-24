// app/ai/page.tsx
"use client";

import { useMemo, useRef, useState } from "react";

type CropGuess = { name: string; confidence: number };
type Question = { id: string; text: string; choices: string[] };
type Progress = { asked: number; target: number };

type HistoryItem =
  | { role: "doctor"; text: string }
  | { role: "farmer"; qid: string; answer: string | string[] };

type PrimaryCategory = "PEST" | "DISEASE" | "ENVIRONMENT";

type ApiResponse =
  | ({
      ok: true;
    } & (
      | {
          phase: "QUESTION";
          primary_category?: PrimaryCategory | null;
          crop_guess: CropGuess;
          observations: string[];
          doctor_note: string;
          question: Question;
          progress?: Progress;
        }
      | {
          phase: "FINAL";
          primary_category?: PrimaryCategory | null;
          crop_guess: CropGuess;
          observations: string[];
          possible_causes?: { name: string; probability: number; why: string }[];
          must_check?: string[];
          do_not?: string[];
          next_steps?: string[];
          need_119_if?: string[];
          followup_message?: string;
        }
    ))
  | { ok: false; error: string };

const FORM_119_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform";

export default function AiPage() {
  const [api, setApi] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const [customInput, setCustomInput] = useState("");

  const [mainFile, setMainFile] = useState<File | null>(null);
  const [mainPreview, setMainPreview] = useState<string | null>(null);

  const [crop, setCrop] = useState("");
  const [region, setRegion] = useState("");

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const isQuestion = api?.ok === true && api.phase === "QUESTION";
  const isFinal = api?.ok === true && api.phase === "FINAL";
  const currentQ = isQuestion ? api.question : null;

  const getLocationOnce = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocation(null),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const onMainPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (!f) return;

    setMainFile(f);
    setMainPreview(URL.createObjectURL(f));

    // 새 케이스 시작 초기화
    setApi(null);
    setHistory([]);
    setSelected([]);
    setCustomInput("");

    getLocationOnce();

    e.target.value = "";
  };

  const callApi = async (action: "start" | "answer", payload?: { qid?: string; answer?: string | string[] }) => {
    if (!mainFile) return alert("사진을 먼저 선택해 주세요.");

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("action", action);
      fd.append("image", mainFile);

      if (crop.trim()) fd.append("crop", crop.trim());
      if (region.trim()) fd.append("region", region.trim());
      if (location) fd.append("location", JSON.stringify(location));

      fd.append("history", JSON.stringify(history));

      if (action === "answer" && payload?.qid) {
        fd.append("qid", payload.qid);
        fd.append("answer", JSON.stringify(payload.answer ?? ""));
      }

      const res = await fetch("/api/vision", { method: "POST", body: fd });
      const data = (await res.json()) as ApiResponse;

      setApi(data);

      // history 누적(의사 멘트)
      if (data.ok === true) {
        if (data.phase === "QUESTION") {
          const doctorText = [
            data.crop_guess?.name
              ? `작물 추정: ${data.crop_guess.name} (신뢰도 ${Math.round((data.crop_guess.confidence ?? 0) * 100)}%)`
              : "",
            ...(data.observations || []),
            data.doctor_note || "",
          ]
            .filter(Boolean)
            .join("\n");
          setHistory((h) => [...h, { role: "doctor", text: doctorText }]);
          setSelected([]);
          setCustomInput("");
        }

        if (data.phase === "FINAL") {
          const doctorText = [
            "최종 정리(가능성 기반)",
            ...(data.observations || []),
            ...((data.possible_causes || []) as any[]).map((c) => `${c.name} (${c.probability}%) - ${c.why}`),
          ]
            .filter(Boolean)
            .join("\n");
          setHistory((h) => [...h, { role: "doctor", text: doctorText }]);
        }
      }
    } catch {
      setApi({ ok: false, error: "서버 호출 실패" });
    } finally {
      setLoading(false);
    }
  };

  const start = () => callApi("start");

  const toggleSelect = (choice: string) => {
    setSelected((prev) => (prev.includes(choice) ? prev.filter((x) => x !== choice) : [...prev, choice]));
  };

  const submitAnswer = () => {
    if (!isQuestion || !currentQ) return;
    if (selected.length === 0) return alert("답변을 선택해 주세요.");

    let answerToSend: string[] = [...selected];
    const isEtc = selected.some((s) => s.includes("기타"));
    if (isEtc) {
      const text = customInput.trim();
      if (!text) return alert("‘기타(직접 입력)’ 내용을 입력해 주세요.");
      answerToSend = answerToSend.map((x) => (x.includes("기타") ? `기타: ${text}` : x));
    }

    callApi("answer", { qid: currentQ.id, answer: answerToSend });
    setHistory((h) => [...h, { role: "farmer", qid: currentQ.id, answer: answerToSend }]);
  };

  const progressText = useMemo(() => {
    if (api?.ok !== true) return "";
    const p = (api as any).progress as Progress | undefined;
    if (!p) return "";
    return `진단 진행: ${p.asked}/${p.target}`;
  }, [api]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: 18,
        position: "relative",
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto", paddingBottom: 96 }}>
        <h1 style={{ textAlign: "center", fontSize: 34, color: "#00ff88", fontWeight: 900, marginTop: 8 }}>
          포토닥터
        </h1>

        <div
          style={{
            marginTop: 6,
            textAlign: "center",
            fontSize: 14,
            color: "#FFD400",
            lineHeight: 1.5,
            fontWeight: 700,
          }}
        >
          한국농수산TV가 농민을 위해 만든 AI 병해 진단 서비스입니다
          <br />
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <input
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            placeholder="작물(선택) 예: 마늘"
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 12,
              border: "1px solid #333",
              background: "#0b0b0b",
              color: "#fff",
              outline: "none",
            }}
          />
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="지역(선택) 예: 충남 홍성"
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 12,
              border: "1px solid #333",
              background: "#0b0b0b",
              color: "#fff",
              outline: "none",
            }}
          />
        </div>

        {/* 메인 업로드 */}
        <input id="mainFileInput" type="file" accept="image/*" onChange={onMainPick} style={{ display: "none" }} />
        <label
          htmlFor="mainFileInput"
          style={{
            display: "block",
            marginTop: 14,
            padding: 16,
            border: "3px dashed #00ff88",
            borderRadius: 18,
            textAlign: "center",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900, color: "#00ff88" }}>🖼️ 갤러리에서 사진 선택 (1장)</div>
          <div style={{ marginTop: 6, color: "#ffd400", fontWeight: 800, lineHeight: 1.35 }}>
            ※ “촬영”이 아니라 <b>이미 찍어둔 사진</b>을 선택해 올려주세요.
          </div>
        </label>

        {/* 미리보기 + 로딩 */}
        {mainPreview && (
          <div style={{ position: "relative", marginTop: 12 }}>
            <img
              src={mainPreview}
              alt="preview"
              style={{ width: "100%", borderRadius: 16, border: "3px solid #00ff88", display: "block" }}
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

        {/* 시작 버튼 */}
        {!api && (
          <button
            onClick={start}
            disabled={loading || !mainFile}
            style={{
              width: "100%",
              height: 60,
              marginTop: 14,
              background: "#00cc44",
              borderRadius: 16,
              fontSize: 20,
              fontWeight: 900,
              border: "none",
              cursor: "pointer",
              opacity: !mainFile ? 0.5 : 1,
            }}
          >
            🧠 진단 시작
          </button>
        )}

        {progressText && <div style={{ marginTop: 10, color: "#aaa", fontWeight: 800 }}>{progressText}</div>}

        {/* 오류 */}
        {api?.ok === false && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 14,
              background: "#2a0000",
              border: "1px solid #ff4444",
              color: "#ffaaaa",
              fontWeight: 900,
              whiteSpace: "pre-line",
              lineHeight: 1.45,
            }}
          >
            오류: {api.error}
          </div>
        )}

        {/* QUESTION */}
        {isQuestion && api.ok === true && (
          <div style={{ marginTop: 14, padding: 14, borderRadius: 16, background: "#111", border: "1px solid #222" }}>
            <div style={{ fontWeight: 900, color: "#00ff88" }}>
              🌿 작물 추정: {api.crop_guess?.name}{" "}
              <span style={{ color: "#ffd400", fontSize: 13 }}>
                (신뢰도 {api.crop_guess.confidence}%)
              </span>
            </div>

            {!!api.observations?.length && (
              <div style={{ marginTop: 10, color: "#ddd", lineHeight: 1.45, whiteSpace: "pre-line" }}>
                {api.observations.map((o, i) => (
                  <div key={i}>• {o}</div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 10, color: "#ffd400", fontWeight: 900, whiteSpace: "pre-line" }}>
              {api.doctor_note}
            </div>

            <div style={{ marginTop: 12, fontSize: 18, fontWeight: 900 }}>❓ {api.question.text}</div>
            <div style={{ marginTop: 8, color: "#aaa", fontWeight: 800 }}>※ 선택하면 “색 + 체크”로 계속 유지됩니다.</div>

            {/* 선택 UI */}
            <div style={{ marginTop: 10 }}>
              {api.question.choices.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleSelect(c)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: 12,
                    marginBottom: 10,
                    borderRadius: 12,
                    border: selected.includes(c) ? "2px solid #00ff88" : "2px solid #00bfff",
                    background: selected.includes(c) ? "#002211" : "#000",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <span>{c}</span>
                  <span style={{ color: selected.includes(c) ? "#00ff88" : "#333", fontWeight: 900 }}>
                    {selected.includes(c) ? "✅" : "⬜️"}
                  </span>
                </button>
              ))}
            </div>

            {/* 기타 직접 입력 */}
            {selected.some((s) => s.includes("기타")) && (
              <textarea
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="재배 환경, 특이사항, 설명을 직접 입력해 주세요"
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: 12,
                  borderRadius: 12,
                  background: "#000",
                  border: "2px solid #00ff88",
                  color: "#fff",
                  fontSize: 15,
                  lineHeight: 1.5,
                  minHeight: 96,
                  outline: "none",
                }}
              />
            )}

            <button
              onClick={submitAnswer}
              disabled={loading || selected.length === 0}
              style={{
                width: "100%",
                height: 56,
                marginTop: 10,
                background: "#00cc44",
                borderRadius: 14,
                fontSize: 18,
                fontWeight: 900,
                border: "none",
                cursor: "pointer",
                opacity: selected.length === 0 ? 0.6 : 1,
              }}
            >
              다음 질문 받기 →
            </button>
          </div>
        )}

        {/* FINAL (안전 렌더링) */}
        {isFinal && api?.ok === true && (
          <div
            style={{
              marginTop: 14,
              padding: 16,
              borderRadius: 18,
              border: "3px solid #ffd400",
              background: "#111",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 900 }}>📌 최종 정리(가능성 기반)</div>

            {api.crop_guess?.name && (
              <div style={{ marginTop: 8, color: "#00ff88", fontWeight: 900 }}>
                🌿 작물: {api.crop_guess.name}{" "}
                {typeof api.crop_guess.confidence === "number" && (
                  <span style={{ color: "#ffd400", fontSize: 13 }}>
                    (신뢰도 {Math.round(api.crop_guess.confidence)}%)
                  </span>
                )}
      
     
              </div>
            )}

            {(api.observations ?? []).length > 0 && (
              <div style={{ marginTop: 10, color: "#ddd", lineHeight: 1.45 }}>
                {(api.observations ?? []).map((o, i) => (
                  <div key={i}>• {o}</div>
                ))}
              </div>
            )}

            {(api.possible_causes ?? []).length > 0 && (
              <>
                <div style={{ marginTop: 12, fontWeight: 900 }}>🧭 가능성(Top 3)</div>
                {(api.possible_causes ?? []).slice(0, 3).map((c, i) => (
                  <div key={i} style={{ marginTop: 6, color: "#ddd" }}>
                    • <b>{c.name}</b>
                    {typeof c.probability === "number" && ` (${c.probability}%)`}
                    {c.why && <div style={{ color: "#aaa", marginTop: 4 }}>- {c.why}</div>}
                  </div>
                ))}
              </>
            )}

            {(api.must_check ?? []).length > 0 && (
              <>
                <div style={{ marginTop: 12, fontWeight: 900 }}>🔍 반드시 확인</div>
                {(api.must_check ?? []).map((t, i) => (
                  <div key={i} style={{ marginTop: 6 }}>
                    • {t}
                  </div>
                ))}
              </>
            )}

            {(api.do_not ?? []).length > 0 && (
              <>
                <div style={{ marginTop: 12, fontWeight: 900, color: "#ffd400" }}>⛔ 지금은 피해야 할 행동</div>
                {(api.do_not ?? []).map((t, i) => (
                  <div key={i} style={{ marginTop: 6 }}>
                    • {t}
                  </div>
                ))}
              </>
            )}

            {(api.next_steps ?? []).length > 0 && (
              <>
                <div style={{ marginTop: 12, fontWeight: 900 }}>✅ 다음 단계</div>
                {(api.next_steps ?? []).map((t, i) => (
                  <div key={i} style={{ marginTop: 6 }}>
                    • {t}
                  </div>
                ))}
              </>
            )}

            {(api.need_119_if ?? []).length > 0 && (
              <>
                <div style={{ marginTop: 12, fontWeight: 900, color: "#ff6666" }}>☎️ 119 권장 조건</div>
                {(api.need_119_if ?? []).map((t, i) => (
                  <div key={i} style={{ marginTop: 6 }}>
                    • {t}
                  </div>
                ))}
              </>
            )}

            {api.followup_message && (
              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 14,
                  background: "#0b0b0b",
                  border: "1px solid #222",
                  color: "#ffd400",
                  fontWeight: 900,
                  whiteSpace: "pre-line",
                  lineHeight: 1.55,
                }}
              >
                {api.followup_message}
              </div>
            )}

            <div style={{ marginTop: 10, color: "#aaa", fontWeight: 800 }}>
              ※ 증상이 급격히 확산 중이거나 판단이 어려운 경우에만 하단 “농사톡톡 119”를 요청해 주세요.
            </div>
          </div>
        )}
      </div>

      {/* 119 고정 버튼 */}
      <div
        style={{
          position: "fixed",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
          width: "100%",
          maxWidth: 520,
          padding: "0 18px",
          pointerEvents: "none",
        }}
      >
        <a
          href={FORM_119_URL}
          target="_blank"
          rel="noreferrer"
          style={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            height: 58,
            borderRadius: 16,
            background: "#d90000",
            color: "#ffffff",
            fontSize: 18,
            fontWeight: 900,
            textDecoration: "none",
            boxShadow: "0 10px 26px rgba(217,0,0,0.45)",
          }}
        >
          🚨 농사톡톡 119 긴급출동
        </a>
      </div>
    </main>
  );
}