// engines/pepper.engine.ts

type EngineResult =
  | { blocked: true; message: string; reason: string }
  | { blocked: false; message: string };

const normalize = (s: string) => s.replace(/\s+/g, "").toLowerCase();

const hasAny = (text: string, keywords: string[]) => {
  const t = normalize(text);
  return keywords.some(k => t.includes(normalize(k)));
};

/**
 * ✅ 핵심 철학
 * - “청고병이다”라고 맞추는 게 목표가 아님
 * - “청고병/세균성/바이러스 가능성이 있으면 확정·농약 금지”
 * - 대신 ‘추가 질문 + 추가 사진’을 강제로 요구해서 정확도를 올림
 */
export function pepperEngine(rawResult: string, cropName?: string): EngineResult {
  const crop = (cropName ?? "").trim();
  const t = rawResult ?? "";

  // ----------------------------
  // 1) 고추: 청고병/세균성/바이러스/시들음 “질문 모드” 트리거
  // ----------------------------
  const PEPPER_WILT_SIGNALS = [
    "시들", "급성", "갑자기", "한쪽만", "축늘어", "낮엔 시들", "밤엔 회복",
    "노랗게", "잎이 처짐", "줄기", "뿌리", "관부",
    // AI가 대충 붙이는 단어까지 포함 (이게 중요)
    "시들음병", "세균성", "바이러스", "역병", "청고병"
  ];

  // 사진/설명에서 “시들음 계열”로 보이면 무조건 질문 모드
  const pepperSuspectWilt =
    crop.includes("고추") &&
    hasAny(t, PEPPER_WILT_SIGNALS);

  if (pepperSuspectWilt) {
    return {
      blocked: true,
      reason: "PEPPER_WILT_HIGH_RISK",
      message: `📋 AI 진단 결과 (중요 안내)

지금 증상은 ‘고추 시들음’ 계열로 보이며,
이 구간에서는 **청고병(세균성 시들음병)·바이러스·뿌리/관부 문제**가
서로 매우 비슷하게 나타납니다.

✅ 그래서 지금 단계에서
❌ 병명을 확정하지 않습니다
❌ 농약을 추천하지 않습니다 (오진 시 피해가 커집니다)

━━━━━━━━━━━━━━
🧠 먼저 4가지 질문에 답해 주세요 (진단 정확도 급상승)
━━━━━━━━━━━━━━
1) 한 포기만 시들고 주변은 멀쩡한가요? (예/아니오)
2) 낮에는 더 시들고, 밤/아침엔 조금 회복되나요? (예/아니오)
3) 시든 줄기를 칼로 자르면 단면에서 ‘물기/점액’이 보이나요? (예/아니오)
4) 뿌리/관부(지제부)가 갈변·썩음·악취가 있나요? (예/아니오)

━━━━━━━━━━━━━━
📸 추가 사진 3장만 꼭 부탁드립니다 (이거 없으면 확정 불가)
━━━━━━━━━━━━━━
1️⃣ 줄기 하단(지제부) 전체 사진
2️⃣ 줄기 절단 단면 근접 (점액/갈변 확인)
3️⃣ 뿌리 전체(흙이 묻은 상태) + 관부 근접

👉 위 답변/사진을 올려주시면
‘청고병 가능성’ vs ‘기타 원인’을 확실히 갈라서 안내하겠습니다.

※ 농가 피해 방지를 위한 강제 보호 단계입니다.`
    };
  }