// NCPMS(국가농작물병해충관리시스템) Open API — 실제 호출
// 문서: ncpms.rda.go.kr/npms/OpenApiInfo.np (npms_api_manual.zip 과 같은 내용)
//   병해충검색  SVC01 병 검색 · SVC05 병 상세 · SVC03 해충 검색 · SVC07 해충 상세
//   병해충상담  SVC41 상담 검색 · SVC42 상담 상세(전문가 답변)
//   병해충예찰  SVC51 예찰 검색 · SVC52 예찰 상세(시도별) · SVC53 예찰 상세(시군구별)
// 열쇠: 환경변수 NCPMS_API_KEY (NCPMS 마이페이지 > Open API 신청내역, 펀토리 명의)
// 실패해도 진단은 멈추지 않음 — 모든 함수는 실패 시 null/빈 배열을 돌려줌.

const BASE = "http://ncpms.rda.go.kr/npmsAPI/service";
const TIMEOUT_MS = Number(process.env.NCPMS_TIMEOUT_MS || 6000);

export const NCPMS_ERRORS: Record<string, string> = {
  ERR_101: "인증키 없음",
  ERR_102: "NCPMS 관리자가 서비스를 중지함",
  ERR_103: "서비스코드 잘못됨",
  ERR_104: "이 서비스를 쓸 권한 없음(신청 항목 확인)",
  ERR_105: "인증받지 않은 도메인",
  ERR_201: "필요한 값이 없거나 잘못됨",
  ERR_901: "NCPMS 시스템 오류",
};

export class NcpmsError extends Error {
  constructor(public code: string, msg: string) { super(msg); }
}

// ── 짧은 메모리 캐시 (같은 작물·같은 병을 연달아 물어볼 때 NCPMS를 다시 부르지 않음)
const CACHE = new Map<string, { at: number; v: any }>();
function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return Promise.resolve(hit.v);
  return fn().then((v) => {
    if (v != null) {
      if (CACHE.size > 500) CACHE.delete(CACHE.keys().next().value as string);
      CACHE.set(key, { at: Date.now(), v });
    }
    return v;
  });
}
const H = 3600e3;

/** NCPMS 호출 한 번. 응답 JSON 의 service 부분을 돌려줌. 에러코드가 오면 NcpmsError */
export async function ncpmsCall(params: Record<string, string | number | undefined>): Promise<any> {
  const key = process.env.NCPMS_API_KEY;
  if (!key) throw new NcpmsError("NO_KEY", "NCPMS_API_KEY 없음");
  const q = new URLSearchParams({ apiKey: key, serviceType: "AA003" });
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
  const r = await fetch(`${BASE}?${q}`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  const raw = await r.text();
  const err = raw.match(/ERR_\d{3}/)?.[0];
  if (err) throw new NcpmsError(err, `${err} ${NCPMS_ERRORS[err] || ""}`.trim());
  let j: any;
  try { j = JSON.parse(raw); } catch { throw new NcpmsError("NOT_JSON", `JSON 아님 (HTTP ${r.status}): ${raw.slice(0, 120)}`); }
  return j?.service ?? j;
}

/** 목록 응답에서 항목 배열 꺼내기 (list 가 배열 / {item: …} / 한 건 모두 처리) */
export function listOf(s: any): any[] {
  let l = s?.list;
  if (l && !Array.isArray(l) && typeof l === "object" && "item" in l) l = l.item;
  return Array.isArray(l) ? l : l ? [l] : [];
}
const imgs = (x: any): string[] =>
  ([] as any[]).concat(x?.image ?? x ?? []).map((i) => (typeof i === "string" ? i : i?.image || i?.imageUrl || "")).filter(Boolean);
export const clean = (s: any, n = 400) =>
  String(s ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}/g, "[번호]").replace(/\s+/g, " ").trim().slice(0, n);

// ───────── 1. 병해충검색 ─────────
export type DiseaseHit = { kind: "병"; crop: string; name: string; key: number; thumb: string };
export type PestHit = { kind: "해충"; crop: string; name: string; key: number; thumb: string };

export function searchDiseases(cropName: string, sickNameKor?: string, displayCount = 20): Promise<DiseaseHit[]> {
  return cached(`01|${cropName}|${sickNameKor || ""}|${displayCount}`, 24 * H, async () =>
    listOf(await ncpmsCall({ serviceCode: "SVC01", cropName, sickNameKor, displayCount })).map((x) => ({
      kind: "병" as const, crop: clean(x.cropName, 30), name: clean(x.sickNameKor, 60), key: Number(x.sickKey), thumb: x.thumbImg || "",
    })).filter((x) => x.key));
}

export function searchPests(cropName: string, insectKorName?: string, displayCount = 20): Promise<PestHit[]> {
  return cached(`03|${cropName}|${insectKorName || ""}|${displayCount}`, 24 * H, async () =>
    listOf(await ncpmsCall({ serviceCode: "SVC03", cropName, insectKorName, displayCount })).map((x) => ({
      kind: "해충" as const, crop: clean(x.cropName, 30), name: clean(x.insectKorName, 60), key: Number(x.insectKey), thumb: x.thumbImg || "",
    })).filter((x) => x.key));
}

export type PestSheet = { kind: "병" | "해충"; crop: string; name: string; symptoms: string; condition: string; control: string; images: string[] };

export function diseaseDetail(sickKey: number): Promise<PestSheet | null> {
  return cached(`05|${sickKey}`, 7 * 24 * H, async () => {
    const s = await ncpmsCall({ serviceCode: "SVC05", sickKey });
    if (!s?.sickNameKor) return null;
    return {
      kind: "병" as const, crop: clean(s.cropName, 30), name: clean(s.sickNameKor, 60),
      symptoms: clean(s.symptoms, 500), condition: clean(s.developmentCondition, 300),
      control: clean(s.preventionMethod || s.chemicalPrvnbeMth, 300), images: imgs(s.imageList).slice(0, 3),
    };
  });
}

export function pestDetail(insectKey: number): Promise<PestSheet | null> {
  return cached(`07|${insectKey}`, 7 * 24 * H, async () => {
    const s = await ncpmsCall({ serviceCode: "SVC07", insectKey });
    const name = clean(s?.insectSpeciesKor || s?.insectKorName, 60);
    if (!name) return null;
    return {
      kind: "해충" as const, crop: clean(s.cropName, 30), name,
      symptoms: clean(s.damageInfo || s.stleInfo, 500), condition: clean(s.ecologyInfo, 300),
      control: clean(s.preventMethod || s.chemicalPrvnbeMth, 300), images: [...imgs(s.imageList), ...imgs(s.spcsPhotoData)].slice(0, 3),
    };
  });
}

// ───────── 2. 병해충상담 ─────────
export type ConsultHit = { no: number; title: string; crop: string; date: string; realm: string; thumb: string };
export type ConsultCase = {
  id: number; crop: string; realm: string; sido: string; sigungu: string; month: string;
  part: string; symptom: string; category: string; pest: string; opinion: string; control: string; images: string[];
};

export function searchConsults(cropName: string, title?: string, displayCount = 50): Promise<ConsultHit[]> {
  return cached(`41|${cropName}|${title || ""}|${displayCount}`, 6 * H, async () =>
    listOf(await ncpmsCall({ serviceCode: "SVC41", cropName, dgnssReqSj: title, displayCount })).map((x) => ({
      no: Number(x.dgnssReqNo), title: clean(x.dgnssReqSj, 120), crop: clean(x.cropName, 30),
      date: String(x.registDatetm || "").slice(0, 10), realm: clean(x.realm, 20), thumb: x.thumbImg || "",
    })).filter((x) => x.no));
}

export function consultDetail(dgnssReqNo: number): Promise<ConsultCase | null> {
  return cached(`42|${dgnssReqNo}`, 7 * 24 * H, async () => {
    const d = await ncpmsCall({ serviceCode: "SVC42", dgnssReqNo });
    if (!d || !(d.dgnssOpin || d.dbyhs || d.answerSe)) return null; // 아직 답변 없는 상담은 근거로 안 씀
    return {
      id: dgnssReqNo, crop: clean(d.cropName, 30), realm: clean(d.realm, 20),
      sido: clean(d.sidoName, 20), sigungu: clean(d.sigunguName, 20), month: String(d.registDatetm || "").slice(0, 7),
      part: clean(d.priyClName, 40), symptom: clean(d.reqestCn, 400), category: clean(d.answerSe, 20),
      pest: clean(d.dbyhs, 60), opinion: clean(d.dgnssOpin, 500), control: clean(d.prvnbeMth, 300),
      images: imgs(d.imageList).slice(0, 3),
    };
  });
}

// ───────── 3. 병해충예찰 ─────────
export type SurveyRound = { key: string; year: string; kind: string; crop: string; survey: string; round: number; date: string };
export type SurveyRow = { sido: string; sidoCode: string; sigungu?: string; pest: string; value: number };

export function searchSurveys(year = String(new Date().getFullYear()), kncrCode?: string, displayCount = 50): Promise<SurveyRound[]> {
  return cached(`51|${year}|${kncrCode || ""}|${displayCount}`, 6 * H, async () =>
    listOf(await ncpmsCall({ serviceCode: "SVC51", searchExaminYear: year, searchKncrCode: kncrCode, displayCount })).map((x) => ({
      key: String(x.insectKey || ""), year: String(x.examinYear || ""), kind: clean(x.predictnSpchcknNm, 30),
      crop: clean(x.kncrNm, 30), survey: clean(x.examinSpchcknNm, 30), round: Number(x.examinTmrd) || 0,
      date: String(x.inputStdrDatetm || "").slice(0, 10),
    })).filter((x) => x.key));
}

export function surveyBySido(insectKey: string): Promise<SurveyRow[]> {
  return cached(`52|${insectKey}`, 24 * H, async () =>
    listOf(await ncpmsCall({ serviceCode: "SVC52", insectKey })).map((x) => ({
      sido: clean(x.sidoNm, 20), sidoCode: String(x.sidoCode || ""), pest: clean(x.dbyhsNm, 60), value: Number(x.inqireValue) || 0,
    })));
}

export function surveyBySigungu(insectKey: string, sidoCode: string): Promise<SurveyRow[]> {
  return cached(`53|${insectKey}|${sidoCode}`, 24 * H, async () =>
    listOf(await ncpmsCall({ serviceCode: "SVC53", insectKey, sidoCode })).map((x) => ({
      sido: "", sidoCode, sigungu: clean(x.sigunguNm, 20), pest: clean(x.dbyhsNm, 60), value: Number(x.inqireValue) || 0,
    })));
}
