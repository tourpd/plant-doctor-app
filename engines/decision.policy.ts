// engines/decision.policy.ts
/**
 * 농사톡톡3 결정 헌법 (Decision Policy)
 *
 * 이 파일은 "판단 기준"만 정의한다.
 * - AI는 이 정책을 어길 수 없다.
 * - 엔진/라우트/UI는 반드시 이 파일을 참조한다.
 * - 병명을 맞히는 것이 아니라, 농민 피해를 막는 것이 목적이다.
 */

/* =====================================================
   1️⃣ 절대 확정 진단 금지 병해
   ===================================================== */
export const NO_FINAL_DIAGNOSIS_DISEASES = [
  "청고병",
  "세균성",
  "세균성시들음",
  "바이러스",
  "바이러스병",
  "더뎅이병",
  "토양전염",
];

/* =====================================================
   2️⃣ 사진 1장 기준 농약 출력 완전 금지
   ===================================================== */
export const NO_PESTICIDE_WITH_SINGLE_IMAGE = true;

/* =====================================================
   3️⃣ 무조건 ‘대화형 질문 모드’로 전환되는 키워드
   ===================================================== */
export const FORCE_DIALOGUE_KEYWORDS = [
  // 시들음 계열
  "시들",
  "시듦",
  "급격히",
  "축 처짐",
  "회복 안됨",

  // 세균/바이러스 의심
  "한쪽만",
  "갑자기",
  "연속 발생",
  "비 온 뒤",

  // 토양 전염 의심
  "뿌리",
  "줄기 하단",
  "포기째",
  "군데군데",
];

/* =====================================================
   4️⃣ 사진 부족 판정 조건
   ===================================================== */
export const REQUIRED_PHOTO_TYPES = [
  "전체",
  "근접",
  "줄기",
  "뿌리",
];

export const MIN_REQUIRED_PHOTO_COUNT = 3;

/* =====================================================
   5️⃣ 농약 출력 허용 조건 (아주 제한적)
   ===================================================== */
export const PESTICIDE_ALLOW_CONDITION = {
  minPhotoCount: MIN_REQUIRED_PHOTO_COUNT,
  requiredTypes: REQUIRED_PHOTO_TYPES,
  forbiddenDiseases: NO_FINAL_DIAGNOSIS_DISEASES,
};

/* =====================================================
   6️⃣ 위험 단계 분류
   ===================================================== */
export const RISK_LEVEL = {
  SAFE: "SAFE",                 // 일반 병해 가능
  NEED_MORE_INFO: "NEED_MORE_INFO", // 사진/정보 부족
  HIGH_RISK: "HIGH_RISK",       // 청고병·세균성 강력 의심
};

/* =====================================================
   7️⃣ 정책 판단 유틸 함수
   ===================================================== */

/**
 * 텍스트 기반 위험 병해 포함 여부
 */
export function containsHighRiskDisease(text: string): boolean {
  const normalized = text.replace(/\s+/g, "").toLowerCase();
  return NO_FINAL_DIAGNOSIS_DISEASES.some(d =>
    normalized.includes(d.replace(/\s+/g, "").toLowerCase())
  );
}

/**
 * 대화 모드 강제 여부 판단
 */
export function shouldForceDialogue(text: string): boolean {
  const normalized = text.replace(/\s+/g, "").toLowerCase();
  return FORCE_DIALOGUE_KEYWORDS.some(k =>
    normalized.includes(k.replace(/\s+/g, "").toLowerCase())
  );
}

/**
 * 농약 출력 가능 여부 판단
 */
export function canRecommendPesticide(params: {
  photoCount: number;
  diseaseName?: string;
}): boolean {
  if (NO_PESTICIDE_WITH_SINGLE_IMAGE && params.photoCount < MIN_REQUIRED_PHOTO_COUNT) {
    return false;
  }

  if (
    params.diseaseName &&
    NO_FINAL_DIAGNOSIS_DISEASES.includes(params.diseaseName)
  ) {
    return false;
  }

  return true;
}