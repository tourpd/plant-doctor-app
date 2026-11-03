// NCPMS 실시간 근거 — 진단할 때마다 NCPMS Open API 를 직접 불러 근거를 모음
//  ① 병해충상담: 같은 작물의 최근 전문가 상담(SVC41) 중 증상이 비슷한 것 → 상세 답변(SVC42)
//  ② 병해충검색: 1차 판정 후보 병·해충의 농진청 도감(SVC01/03 → SVC05/07) 증상·발생 조건
//  ③ 병해충예찰: 올해 같은 작물 최근 회차 예찰(SVC51 → SVC52) 에서 농민 지역(시도) 발생 병해충
// 하나가 실패해도 나머지는 계속 (errors 에 이유를 남김)
import {
  searchConsults, consultDetail, searchDiseases, searchPests, diseaseDetail, pestDetail,
  searchSurveys, surveyBySido, type ConsultCase, type PestSheet, NcpmsError,
} from "../ncpms/client";
import { cropKeys, sameCrop } from "./cases";

const errText = (e: any) => (e instanceof NcpmsError ? e.message : String(e?.message || e)).slice(0, 80);

async function embed(texts: string[], dims = 256): Promise<number[][] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !texts.length) return null;
  try {
    const r = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "text-embedding-3-small", dimensions: dims, input: texts.map((t) => t.slice(0, 1000)) }),
      signal: AbortSignal.timeout(8000),
    });
    const d = (await r.json())?.data;
    return Array.isArray(d) ? d.map((x: any) => x.embedding) : null;
  } catch {
    return null;
  }
}
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);

/** ① 같은 작물 최근 전문가 상담 중 비슷한 것 (답변 있는 것만) */
export async function liveConsultCases(crop: string, queryText: string, k = 3, errors: string[] = []): Promise<ConsultCase[]> {
  const keys = cropKeys(crop);
  if (!keys.length) return [];
  try {
    let hits = await searchConsults(keys[0], undefined, 50);
    hits = hits.filter((h) => !h.crop || sameCrop(h.crop, keys));
    if (!hits.length) return [];
    // 제목으로 1차 추림 (상세를 다 부르면 느려서): 증상 문장과 제목 임베딩 비교, 안 되면 최신순
    let order = hits.map((_, i) => i);
    const v = await embed([queryText, ...hits.map((h) => `${h.crop} ${h.title}`)]);
    if (v) {
      const q = v[0];
      order = hits.map((_, i) => ({ i, s: dot(q, v[i + 1]) })).sort((a, b) => b.s - a.s).map((x) => x.i);
    }
    const picked = order.slice(0, k * 2).map((i) => hits[i]);
    const details = await Promise.all(picked.map((h) => consultDetail(h.no).catch((e) => { errors.push(`상담상세 ${h.no}: ${errText(e)}`); return null; })));
    // 답이 "불명"뿐인 상담은 근거로 약하므로 뺌 (병해충 이름이 있으면 씀)
    return details.filter((d): d is ConsultCase => !!d && (!/불명/.test(d.category || "") || !!d.pest)).slice(0, k);
  } catch (e) {
    errors.push(`상담검색: ${errText(e)}`);
    return [];
  }
}

// 환경·생리 원인은 도감에 없으므로 찾지 않음
const NOT_PEST = /정상|건조|수분|과습|일소|고온|저온|냉해|동해|서리|결핍|과다|약해|비료|생리|양분|염류|모르|불명|기타/;
const normName = (s: string) => String(s || "").replace(/\(.*?\)|\s|병$/g, "");

/** ② 1차 후보 병·해충의 농진청 도감 정보 */
export async function officialSheets(crop: string, candidates: string[], errors: string[] = []): Promise<PestSheet[]> {
  const keys = cropKeys(crop);
  const names = [...new Set(candidates.map((c) => String(c || "").trim()).filter((c) => c && !NOT_PEST.test(c)))].slice(0, 3);
  if (!keys.length || !names.length) return [];
  const one = async (name: string): Promise<PestSheet | null> => {
    const n = normName(name);
    try {
      const [ds, ps] = await Promise.all([
        searchDiseases(keys[0], undefined, 50).catch((e) => { errors.push(`병검색: ${errText(e)}`); return []; }),
        searchPests(keys[0], undefined, 50).catch((e) => { errors.push(`해충검색: ${errText(e)}`); return []; }),
      ]);
      const pool = [...ds, ...ps];
      const hit = pool.find((x) => normName(x.name) === n) || pool.find((x) => n.length >= 2 && (normName(x.name).includes(n) || n.includes(normName(x.name))));
      if (!hit) return null;
      return hit.kind === "병" ? await diseaseDetail(hit.key) : await pestDetail(hit.key);
    } catch (e) {
      errors.push(`도감 ${name}: ${errText(e)}`);
      return null;
    }
  };
  return (await Promise.all(names.map(one))).filter((x): x is PestSheet => !!x);
}

const SIDO: [RegExp, string][] = [
  [/서울/, "서울"], [/부산/, "부산"], [/대구/, "대구"], [/인천/, "인천"], [/광주/, "광주"], [/대전/, "대전"], [/울산/, "울산"], [/세종/, "세종"],
  [/경기/, "경기"], [/강원/, "강원"], [/충청북|충북/, "충북"], [/충청남|충남/, "충남"], [/전라북|전북/, "전북"], [/전라남|전남/, "전남"],
  [/경상북|경북/, "경북"], [/경상남|경남/, "경남"], [/제주/, "제주"],
];
const sidoOf = (s: string) => SIDO.find(([re]) => re.test(s || ""))?.[1] || "";

export type SurveyNow = { crop: string; round: string; date: string; sido: string; local: { pest: string; value: number }[]; national: { pest: string; value: number }[]; text: string };

/** ③ 올해 같은 작물 가장 최근 예찰 회차 — 농민 지역(시도)에서 나온 병해충 */
export async function surveyNow(crop: string, region: string, at: Date, errors: string[] = []): Promise<SurveyNow | null> {
  const keys = cropKeys(crop);
  if (!keys.length) return null;
  try {
    const year = String(new Date(at.getTime() + 9 * 3600e3).getUTCFullYear());
    const rounds = (await searchSurveys(year, undefined, 50)).filter((r) => sameCrop(r.crop, keys) || keys.some((k) => r.crop.includes(k)));
    if (!rounds.length) return null;
    const last = rounds.sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.round - a.round)[0];
    // 너무 오래된 회차(60일 넘음)는 지금 상황과 안 맞아 쓰지 않음
    if (last.date && at.getTime() - new Date(last.date).getTime() > 60 * 86400e3) return null;
    const rows = await surveyBySido(last.key);
    const sido = sidoOf(region);
    const local = rows.filter((r) => sido && sidoOf(r.sido) === sido && r.value > 0).sort((a, b) => b.value - a.value).slice(0, 6).map(({ pest, value }) => ({ pest, value }));
    const nat = new Map<string, number>();
    for (const r of rows) if (r.value > 0) nat.set(r.pest, (nat.get(r.pest) || 0) + r.value);
    const national = [...nat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([pest, value]) => ({ pest, value }));
    const fmt = (l: { pest: string; value: number }[]) => l.map((x) => `${x.pest}(${x.value})`).join(", ") || "발생 없음";
    return {
      crop: last.crop, round: `${last.kind} ${last.survey} ${last.round}회차`.trim(), date: last.date, sido, local, national,
      text: `${last.crop} ${last.kind} ${last.round}회차(${last.date}) — ${sido || "지역 미상"}: ${fmt(local)} / 전국 많이 나온 것: ${fmt(national)}`,
    };
  } catch (e) {
    errors.push(`예찰: ${errText(e)}`);
    return null;
  }
}
