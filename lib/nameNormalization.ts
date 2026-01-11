// lib/nameNormalization.ts

/** 텍스트 표준화(공백/특수문자/대소문자) */
export function norm(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[(){}\[\]<>.,:;'"`~!@#$%^&*+=/?\\|-]/g, "");
}

/**
 * ✅ 절대 “단독 출력 금지” 별칭 → 대표 표준명 매핑
 * - 키: 별칭/영문/학술/오타/현장용어
 * - 값: 대표 표준명(최종 출력)
 */
export const SYNONYM_TO_CANONICAL: Record<string, string> = {
  // ===== 노린재 계열 =====
  [norm("방패벌레")]: "노린재",
  [norm("쌀노린재")]: "노린재",
  [norm("콩노린재")]: "노린재",
  [norm("노린재")]: "노린재",
  [norm("shield bug")]: "노린재",
  [norm("shieldbug")]: "노린재",
  [norm("pentatomidae")]: "노린재",
  [norm("stink bug")]: "노린재",
  [norm("stinkbug")]: "노린재",

  // ===== 곰팡이병 명칭 통일(회색→잿빛) =====
  [norm("회색곰팡이병")]: "잿빛곰팡이병",
  [norm("잿빛곰팡이병")]: "잿빛곰팡이병",
  [norm("gray mold")]: "잿빛곰팡이병",
  [norm("grey mold")]: "잿빛곰팡이병",
  [norm("botrytis")]: "잿빛곰팡이병",
  [norm("botrytiscinerea")]: "잿빛곰팡이병",
};

/**
 * ✅ (선택) 작물별 Override
 * - 특정 작물에서는 표기를 다르게 하고 싶을 때만 사용
 */
export const CROP_OVERRIDES: Record<string, Record<string, string>> = {
  // "벼": {
  //   [norm("노린재")]: "노린재",
  // },
};

export function canonicalizeName(name: string, crop?: string) {
  const key = norm(name);

  // 1) 작물별 override 우선
  const cropKey = (crop || "").trim();
  if (cropKey && CROP_OVERRIDES[cropKey]?.[key]) {
    return CROP_OVERRIDES[cropKey][key];
  }

  // 2) 정확 매핑
  if (SYNONYM_TO_CANONICAL[key]) return SYNONYM_TO_CANONICAL[key];

  // 3) “문장형 name”에서도 감지 (예: "방패벌레(노린재) 피해 의심")
  for (const [synKey, canonical] of Object.entries(SYNONYM_TO_CANONICAL)) {
    if (synKey && key.includes(synKey)) return canonical;
  }

  // 4) 매핑 못하면 원문 유지
  return name;
}

export function canonicalizeWhy(why: string) {
  if (!why) return why;

  let out = why;

  // ✅ 문장 내 단독 별칭도 대표명으로 강제 치환
  const replacements: Array<[RegExp, string]> = [
    [/방패벌레/g, "노린재"],
    [/쌀노린재/g, "노린재"],
    [/콩노린재/g, "노린재"],
    [/Shield bug/gi, "노린재"],
    [/Pentatomidae/gi, "노린재"],

    [/회색곰팡이병/g, "잿빛곰팡이병"],
    [/gray mold/gi, "잿빛곰팡이병"],
    [/grey mold/gi, "잿빛곰팡이병"],
    [/Botrytis/gi, "잿빛곰팡이병"],
  ];

  for (const [re, rep] of replacements) out = out.replace(re, rep);

  return out;
}