// app/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type PrimaryCategory = "DISEASE" | "PEST" | "ENVIRONMENT" | "GROWTH";
type CropGuess = { name: string; confidence: number };
type Progress = { asked: number; target: number };

type Question = {
  id: string;
  text: string;
  choices: string[];
  multi?: boolean;
  kind?: "CHOICE" | "FREE_TEXT";
};

type HistoryItem =
  | { role: "doctor"; text: string }
  | { role: "farmer"; qid: string; answer: string | string[]; kind?: "CHOICE" | "FREE_TEXT" };

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
          progress: Progress;
        }
      | {
          phase: "FINAL";
          primary_category?: PrimaryCategory | null;
          crop_guess: CropGuess;
          observations: string[];
          possible_causes: { name: string; probability: number; why: string }[];
          must_check: string[];
          do_not: string[];
          next_steps: string[];
          need_119_if: string[];
          followup_message: string;
        }
    ))
  | { ok: false; error: string };

const FORM_119_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform";

  export default function Page() {
  // ✅ farmer 답변만 누적되는 서버용 history
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // ✅ 의사(포토닥터) 멘트 전용 UI 메시지
  const [doctorMessages, setDoctorMessages] = useState<string[]>([]);

  // API 상태
  const [api, setApi] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // 입력값
  const [crop, setCrop] = useState("");
  const [region, setRegion] = useState("");

  // 이미지
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // 질문 응답 상태
  const [selected, setSelected] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");

  // 스크롤용 ref
  const questionRef = useRef<HTMLDivElement | null>(null);

  // 파생 상태
  const isQuestion = api?.ok === true && api.phase === "QUESTION";
  const isFinal = api?.ok === true && api.phase === "FINAL";
  const currentQ = isQuestion ? api.question : null;

  // ↓↓↓ 여기부터 기존 코드 그대로 이어서 사용 ↓↓↓


  const progressText = useMemo(() => {
    if (api?.ok !== true) return "";
    const p = (api as any).progress as Progress | undefined;
    if (!p) return "";
    return `진단 진행 ${p.asked}/${p.target}`;
  }, [api]);

  const phaseText = useMemo(() => {
    if (!api || api.ok !== true) return "";
    if (api.phase === "QUESTION") return "진단 중… (질문으로 정확도를 올리는 중)";
    if (api.phase === "FINAL") return "정리 완료";
    return "";
  }, [api]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (!f) return;

    setMainFile(f);
    setPreview(URL.createObjectURL(f));

    // 새 케이스 초기화
    setApi(null);
    setHistory([]);
    setSelected([]);
    setFreeText("");

    e.target.value = "";
  };

  const callApi = async (action: "start" | "answer", payload?: { qid: string; answer: any; kind?: "CHOICE" | "FREE_TEXT" }) => {
    if (!mainFile) {
      alert("사진을 먼저 선택해 주세요.");
      return;
    }

    setLoading(true);

    try {
      // ✅ 중요: answer일 때 history를 먼저 반영하고 그걸 그대로 서버로 보내야 함
      const nextHistory: HistoryItem[] = [...history];

      if (action === "answer" && payload) {
        nextHistory.push({
          role: "farmer",
          qid: payload.qid,
          answer: payload.answer,
          kind: payload.kind,
        });
      }

      const fd = new FormData();
      fd.append("action", action);
      fd.append("image", mainFile);

      if (crop.trim()) fd.append("crop", crop.trim());
      if (region.trim()) fd.append("region", region.trim());

      fd.append("history", JSON.stringify(nextHistory));

      if (action === "answer" && payload) {
        fd.append("qid", payload.qid);
        fd.append("answer", JSON.stringify(payload.answer));
      }

      const res = await fetch("/api/vision", { method: "POST", body: fd });

      const data = (await res.json()) as ApiResponse;

      // state commit
      setHistory(nextHistory);
      setApi(data);

      if (data.ok === true) {
        // 의사 멘트 누적(농부님이 “봤구나” 체감)
        if (data.phase === "QUESTION") {
          const doctorText = [
            `작물 추정: ${data.crop_guess?.name || "미상"} (신뢰도 ${Math.round((data.crop_guess?.confidence ?? 0) * 100)}%)`,
            ...(data.observations || []).map((x) => `• ${x}`),
            "",
            data.doctor_note || "",
          ]
            .filter(Boolean)
            .join("\n");
          setDoctorMessages((m) => [...m, doctorText]);
 

          setSelected([]);
          setFreeText("");

          // 질문 카드로 자동 스크롤
          setTimeout(() => {
            questionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 60);
        }
      }
    } catch (err) {
      setApi({ ok: false, error: "서버 호출 실패(네트워크/서버 오류)" });
    } finally {
      setLoading(false);
    }
  };

  const start = () => callApi("start");

  const toggle = (choice: string) => {
    if (!currentQ) return;
    const multi = !!currentQ.multi;

    if (!multi) {
      setSelected([choice]);
      return;
    }

    setSelected((prev) => (prev.includes(choice) ? prev.filter((x) => x !== choice) : [...prev, choice]));
  };

  const needEtcInput = useMemo(() => selected.some((s) => s.includes("기타")) || currentQ?.kind === "FREE_TEXT", [selected, currentQ]);

  const submit = () => {
    if (!currentQ) return;

    if (currentQ.kind === "FREE_TEXT") {
      const text = freeText.trim();
      if (!text) {
        alert("한 줄만이라도 적어주시면 다음 질문 정확도가 올라갑니다.");
        return;
      }
      callApi("answer", { qid: currentQ.id, answer: text, kind: "FREE_TEXT" });
      return;
    }

    if (selected.length === 0) {
      alert("답을 선택해 주세요.");
      return;
    }

    let answerToSend: string | string[] = currentQ.multi ? [...selected] : selected[0];

    if (needEtcInput) {
      const text = freeText.trim();
      if (!text) {
        alert("‘기타(직접 입력)’ 내용을 적어주세요.");
        return;
      }
      const arr = currentQ.multi ? [...selected] : [selected[0]];
      answerToSend = arr.map((x) => (x.includes("기타") ? `기타: ${text}` : x));
      if (!currentQ.multi) answerToSend = (answerToSend as string[])[0];
    }

    callApi("answer", { qid: currentQ.id, answer: answerToSend, kind: "CHOICE" });
  };

  // ✅ 버튼 눌렀을 때 “진단 중”이 질문 카드에도 남아있게
  type SpinnerProps = {
  loading: boolean;
  phaseText: string;
};

const Spinner = ({ loading, phaseText }: SpinnerProps) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      marginTop: 8,
      marginBottom: 14, // ✅ 다음 버튼과 간격 확보 (모바일 핵심)
      lineHeight: 1.4,
    }}
  >
    <div className="whirl" />
    <div
      style={{
        fontWeight: 900,
        color: "#ffd400",
        fontSize: 15,
        whiteSpace: "nowrap",
      }}
    >
      {loading ? "진단 중… 잠시만요" : phaseText}
    </div>
  </div>
);


  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: 16,
        paddingBottom: 120,
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        {/* Header */}
        <h1 style={{ textAlign: "center", fontSize: 34, color: "#00ff88", fontWeight: 900, marginTop: 8 }}>
          포토닥터
        </h1>

        <div style={{ textAlign: "center", fontSize: 14, color: "#FFD400", fontWeight: 800, lineHeight: 1.5 }}>
          한국농수산TV가 농부님을 위해 만든 AI 병해·생육 동반자입니다
        </div>

        {/* crop/region */}
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <input
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            placeholder="작물(선택) 예: 마늘/고추/장미"
            style={inputStyle}
          />
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="지역(선택) 예: 충남 홍성"
            style={inputStyle}
          />
        </div>

        {/* Upload */}
        <input id="mainFileInput" type="file" accept="image/*" onChange={onPick} style={{ display: "none" }} />
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

        {/* Preview (축소 고정 느낌) */}
        {preview && (
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                position: "relative",
                borderRadius: 16,
                overflow: "hidden",
                border: "3px solid #00ff88",
              }}
            >
              {/* ✅ 사진 너무 길면 UX가 죽음 → 높이 고정 + cover */}
              <img
                src={preview}
                alt="preview"
                style={{
                  width: "100%",
                  height: 200,
                  objectFit: "cover",
                  display: "block",
                }}
              />

              {/* ✅ 로딩이 “사진 위”가 아니라, 질문 카드에서도 보이지만
                  사진 위에도 얇게 한 번 더 보여줌 */}
              {loading && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(0,0,0,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div className="whirlBig" />
                </div>
              )}
            </div>

            {/* Start button */}
            {!api && (
              <button
                onClick={start}
                disabled={loading || !mainFile}
                style={{
                  width: "100%",
                  height: 58,
                  marginTop: 12,
                  background: mainFile ? "#00cc44" : "#0b3b1f",
                  borderRadius: 16,
                  fontSize: 18,
                  fontWeight: 900,
                  border: "none",
                  cursor: mainFile ? "pointer" : "not-allowed",
                }}
              >
                🧠 진단 시작
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {api?.ok === false && (
          <div style={errorBox}>
            오류: {api.error}
          </div>
        )}

        {/* QUESTION CARD */}
        {isQuestion && api.ok === true && (
          <div
            ref={questionRef}
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 18,
              background: "#0b0b0b",
              border: "1px solid #222",
            }}
          >


            <div style={{ marginTop: 10, fontWeight: 900, color: "#00ff88" }}>
              🌿 작물 추정: {api.crop_guess?.name || "미상"}{" "}
              <span style={{ color: "#ffd400", fontSize: 13 }}>
                (신뢰도 {Math.round((api.crop_guess?.confidence ?? 0) * 100)}%)
              </span>
            </div>

            {/* ✅ 사진을 봤다는 “관찰”이 맨 먼저 */}
            {!!api.observations?.length && (
              <div style={{ marginTop: 10, color: "#ddd", lineHeight: 1.5 }}>
                {api.observations.slice(0, 6).map((o, i) => (
                  <div key={i}>• {o}</div>
                ))}
              </div>
            )}

            {/* ✅ 농부님 공감/요약 멘트 */}
            <div style={{ marginTop: 10, color: "#ffd400", fontWeight: 900, whiteSpace: "pre-line", lineHeight: 1.55 }}>
              {api.doctor_note}
            </div>
                   {/* 🌀 진단 중 표시 – 질문 바로 위 */}
            {loading && (
              <div style={{ marginTop: 18, marginBottom: 9 }}>
                <Spinner loading={loading} phaseText={phaseText} />
              </div>
            )}
            {/* 질문 */}
            <div style={{ marginTop: 14, fontSize: 18, fontWeight: 900, lineHeight: 1.35 }}>
              <span style={{ color: "#ff4444" }}>❓</span> {api.question.text}
            </div>

            {/* 복수선택 안내 */}
            {api.question.multi && (
              <div style={{ marginTop: 6, color: "#9ad7ff", fontWeight: 900, fontSize: 13 }}>
                ※ 복수 선택 가능합니다.
              </div>
            )}
            

            {/* 선택지 / FREE_TEXT */}
            {api.question.kind === "FREE_TEXT" ? (
              <>
                <div style={{ marginTop: 10, color: "#ffd400", fontWeight: 900 }}>✍️ 농부님 의견</div>
                <textarea
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="예) 어제부터 갑자기 번짐 / 약 치고 더 심해짐 / 물을 많이 줬음 / 바이러스 같아 보임…"
                  style={textAreaStyle}
                />
                  {/* 🌀 진단 중 표시 – 질문 바로 위 */}
            {loading && (
              <div style={{ marginTop: 18, marginBottom: 9 }}>
                <Spinner loading={loading} phaseText={phaseText} />
              </div>
            )}
                <button onClick={submit} disabled={loading || freeText.trim().length === 0} style={primaryBtn(freeText.trim().length === 0)}>
                  다음 →
                </button>
              </>
            ) : (
              <>
                <div style={{ marginTop: 12 }}>
                  {api.question.choices.map((c) => {
                    const on = selected.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggle(c)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: 12,
                          marginBottom: 10,
                          borderRadius: 14,
                          border: on ? "2px solid #00ff88" : "2px solid #0b3bff",
                          background: on ? "#001f12" : "#000",
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
                        <span style={{ color: on ? "#00ff88" : "#333", fontWeight: 900 }}>{on ? "✅" : "⬜️"}</span>
                      </button>
                    );
                  })}
                </div>

                {/* 기타 입력(선택된 경우에만 노출) */}
                {needEtcInput && (
                  <textarea
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                    placeholder="‘기타’ 내용을 한 줄로 적어주세요(다음 질문에 반영됩니다)."
                    style={textAreaStyle}
                  />
                )}
                
                <button
                  onClick={submit}
                  disabled={loading || selected.length === 0}
                  style={primaryBtn(selected.length === 0)}
                >
                  다음 →
                </button>
              </>
            )}
          </div>
        )}

        {/* FINAL */}
        {isFinal && api.ok === true && (
          <div
            style={{
              marginTop: 14,
              padding: 16,
              borderRadius: 18,
              border: "3px solid #ffd400",
              background: "#0b0b0b",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontSize: 20, fontWeight: 900 }}>📌 최종 정리</div>
              <div style={{ color: "#aaa", fontWeight: 900, fontSize: 13 }}>완료</div>
            </div>

            <div style={{ marginTop: 10, color: "#00ff88", fontWeight: 900 }}>
              🌿 작물: {api.crop_guess?.name || "미상"}{" "}
              <span style={{ color: "#ffd400", fontSize: 13 }}>
                (신뢰도 {Math.round((api.crop_guess?.confidence ?? 0) * 100)}%)
              </span>
            </div>

            {(api.possible_causes ?? []).length > 0 && (
              <>
                <div style={{ marginTop: 12, fontWeight: 900 }}>🧭 가능성 Top3</div>
                {(api.possible_causes ?? []).slice(0, 3).map((c, i) => (
                  <div key={i} style={{ marginTop: 10, color: "#ddd" }}>
                    • <b>{c.name}</b> <span style={{ color: "#ffd400" }}>({c.probability}%)</span>
                    <div style={{ color: "#aaa", marginTop: 4, lineHeight: 1.55 }}>- {c.why}</div>
                  </div>
                ))}
              </>
            )}

            {(api.must_check ?? []).length > 0 && (
              <>
                <div style={{ marginTop: 14, fontWeight: 900 }}>🔍 반드시 확인</div>
                {(api.must_check ?? []).map((t, i) => (
                  <div key={i} style={{ marginTop: 6 }}>• {t}</div>
                ))}
              </>
            )}

            {(api.do_not ?? []).length > 0 && (
              <>
                <div style={{ marginTop: 14, fontWeight: 900, color: "#ffd400" }}>⛔ 지금은 피해야 할 행동</div>
                {(api.do_not ?? []).map((t, i) => (
                  <div key={i} style={{ marginTop: 6 }}>• {t}</div>
                ))}
              </>
            )}

            {(api.next_steps ?? []).length > 0 && (
              <>
                <div style={{ marginTop: 14, fontWeight: 900 }}>✅ 다음 단계</div>
                {(api.next_steps ?? []).map((t, i) => (
                  <div key={i} style={{ marginTop: 6 }}>• {t}</div>
                ))}
              </>
            )}

            {api.followup_message && (
              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 14,
                  background: "#000",
                  border: "1px solid #222",
                  color: "#ffd400",
                  fontWeight: 900,
                  whiteSpace: "pre-line",
                  lineHeight: 1.6,
                }}
              >
                {api.followup_message}
              </div>
            )}
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
          width: "100%",
          maxWidth: 520,
          padding: "0 16px",
          zIndex: 9999,
        }}
      >
        <a
          href={FORM_119_URL}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            height: 58,
            borderRadius: 16,
            background: "#d90000",
            color: "#fff",
            fontSize: 18,
            fontWeight: 900,
            textDecoration: "none",
            boxShadow: "0 10px 26px rgba(217,0,0,0.45)",
          }}
        >
          🚨 농사톡톡 119 긴급출동
        </a>
      </div>

      <style jsx global>{`
        .whirl {
          width: 18px;
          height: 18px;
          border-radius: 999px;
          border: 3px solid rgba(255, 212, 0, 0.25);
          border-top: 3px solid #ffd400;
          animation: spin 0.85s linear infinite;
        }
        .whirlBig {
          width: 36px;
          height: 36px;
          border-radius: 999px;
          border: 4px solid rgba(0, 255, 136, 0.25);
          border-top: 4px solid #00ff88;
          animation: spin 0.85s linear infinite;
          filter: drop-shadow(0 0 10px rgba(0, 255, 136, 0.25));
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: 12,
  borderRadius: 12,
  border: "1px solid #333",
  background: "#0b0b0b",
  color: "#fff",
  outline: "none",
};

const textAreaStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 10,
  padding: 12,
  borderRadius: 12,
  background: "#000",
  border: "2px solid #00ff88",
  color: "#fff",
  fontSize: 15,
  lineHeight: 1.6,
  minHeight: 96,
  outline: "none",
};

const errorBox: React.CSSProperties = {
  marginTop: 14,
  padding: 12,
  borderRadius: 14,
  background: "#2a0000",
  border: "1px solid #ff4444",
  color: "#ffaaaa",
  fontWeight: 900,
  whiteSpace: "pre-line",
  lineHeight: 1.45,
};

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    height: 56,
    marginTop: 12,
    background: "#00cc44",
    borderRadius: 14,
    fontSize: 18,
    fontWeight: 900,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
}
