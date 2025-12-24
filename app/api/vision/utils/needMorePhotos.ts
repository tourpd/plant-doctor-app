// utils/needMorePhotos.ts

type NeedMorePhotosInput = {
  phase?: string;
  primary_category?: string;
  observations?: string[];
  confidence?: number;
};

/**
 * ❗ 원칙
 * - 기본값: 사진 더 필요 ❌
 * - GPT가 명시적으로 NEED_PHOTO를 준 경우만 true
 * - 해충(PEST)은 어떤 경우에도 false
 */
export function needMorePhotos(input: NeedMorePhotosInput): boolean {
  const phase = String(input?.phase || "").toUpperCase();
  const category = String(input?.primary_category || "").toUpperCase();
  const confidence = typeof input?.confidence === "number" ? input.confidence : 0;

  // 1️⃣ 해충은 절대 추가사진 요구 안 함
  if (category === "PEST") {
    return false;
  }

  // 2️⃣ GPT가 NEED_PHOTO를 명시했을 때만 허용
  if (phase === "NEED_PHOTO") {
    return true;
  }

  // 3️⃣ 그 외 모든 경우 → ❌ 추가사진 요구 안 함
  return false;
}