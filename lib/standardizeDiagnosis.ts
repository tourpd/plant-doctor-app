// lib/standardizeDiagnosis.ts

import {
  canonicalizeName,
  canonicalizeWhy,
} from "./nameNormalization";

export type PossibleCause = {
  name: string;
  probability?: number;
  why?: string;
};

export type DiagnosisLike = {
  ok?: boolean;
  final_judgement?: string;
  possible_causes?: PossibleCause[];
  observations?: string[];
  actions?: any;
  crop?: string;
  region?: string;
};

/**
 * ✅ 최종 표준화 적용 (route.ts에서 이것만 호출)
 * - final_judgement / possible_causes[].name / possible_causes[].why 를 표준화
 */
export function standardizeDiagnosis(result: DiagnosisLike): DiagnosisLike {
  if (!result || typeof result !== "object") return result;

  const crop = (result.crop || "").trim();

  // final_judgement
  if (typeof result.final_judgement === "string" && result.final_judgement.trim()) {
    result.final_judgement = canonicalizeName(result.final_judgement, crop);
  }

  // possible_causes
  if (Array.isArray(result.possible_causes)) {
    result.possible_causes = result.possible_causes.map((c) => {
      const name = typeof c?.name === "string" ? c.name : "";
      const why = typeof c?.why === "string" ? c.why : "";

      return {
        ...c,
        name: name ? canonicalizeName(name, crop) : name,
        why: why ? canonicalizeWhy(why) : why,
      };
    });
  }

  return result;
}