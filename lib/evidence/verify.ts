// 2단계 재판정: 1차 판정 + 전문가 상담 사례(사진 포함) + 진단 전 7일 날씨 → 다시 판정
import { findSimilarCases, fetchImageDataUrl, type ExpertCase } from "./cases";
import { getWeather, type WeatherSummary } from "./weather";

export const VERIFY_RULES = `
[2단계 재판정 규칙 — 근거로 다시 판정한다]
1. 농민 사진을 가장 중요하게 본다. 전문가 사례는 증상·사진이 농민 사진과 실제로 비슷할 때만 근거로 쓴다. 안 비슷하면 무시한다.
   비슷한 사례가 있으면 그 사례에서 전문가가 내린 판정을 강하게 고려한다.
2. 날씨와 맞지 않는 환경 원인은 1순위로 하지 않는다.
   - 최근 7일 강수 합계가 20mm 이상이거나 마지막 비가 3일 이내면 "건조 피해"를 1순위로 하지 않는다.
   - 낮 최고기온 평균이 28℃ 미만이면 "일소 피해", "고온 피해"를 1순위로 하지 않는다 (시설 하우스 작물은 예외로 검토 가능하되 why 에 하우스 근거를 쓴다).
   - 밤 최저기온이 5℃ 이하였으면 저온·냉해를 후보로 검토한다.
   - 비 온 날이 많고 습도가 높으면 곰팡이병·세균병·과습 피해를 후보로 검토한다.
   - 날씨 자료가 없으면 환경 원인(건조·일소·고온·과습)의 확률을 낮게 잡고 ask_questions 로 확인한다.
3. 건조·일소만 반복하는 판정을 피한다. 사진에 병반·곰팡이·벌레 흔적이 있으면 병해충을 먼저 본다.
4. 각 원인의 why 끝에 근거를 괄호로 쓴다. 예: "(사례 2와 증상 비슷)", "(최근 7일 강수 0mm, 최고 31℃)", "(사진 근거만)".
5. 출력 JSON 형식은 1차와 같고, "evidence_used": ["사례 2", "날씨"] 처럼 실제로 쓴 근거를 적는다.
`.trim();

export type Evidence = {
  cases: { id: number; crop: string; region: string; month: string; category: string; pest: string }[];
  case_images: number;
  weather: string | null;
};

export async function verifyWithEvidence(opts: {
  openai: any; system: string; imageUrl: string; crop: string; region: string; at: Date; first: any;
}): Promise<{ result: any; evidence: Evidence } | null> {
  const { openai, system, imageUrl, crop, region, at, first } = opts;
  const obs = (first?.observations || []).join(" ");
  const cands = (first?.possible_causes || []).map((c: any) => c?.name).filter(Boolean).join(", ");
  const [cases, weather] = await Promise.all([
    findSimilarCases(crop, `${crop} | 증상: ${obs} | 후보: ${cands}`, 5),
    getWeather(region, at),
  ]);
  if (!cases.length && !weather) return null;

  // 사례 사진 (상위 사례에서 최대 3장)
  const refImgs: { n: number; url: string }[] = [];
  for (let i = 0; i < cases.length && refImgs.length < 3; i++) {
    const src = cases[i].images?.[0];
    if (!src) continue;
    const d = await fetchImageDataUrl(src);
    if (d) refImgs.push({ n: i + 1, url: d });
  }
  const caseText = cases.map((c: ExpertCase, i) =>
    `[사례 ${i + 1}] ${c.crop} · ${c.sido} ${c.sigungu} · ${c.month} · 발병부위 ${c.part || "-"}${refImgs.some((r) => r.n === i + 1) ? " · (사진 첨부됨)" : ""}\n` +
    `  농민 증상: ${c.symptom.slice(0, 200)}\n  전문가 구분: ${c.category || "-"} / 병해충: ${c.pest || "-"}\n  전문가 소견: ${c.opinion.slice(0, 300)}`
  ).join("\n");

  const text =
    `작물: ${crop}\n지역: ${region}\n\n` +
    `[1차 판정]\n${JSON.stringify({ observations: first?.observations, possible_causes: first?.possible_causes, judgement_type: first?.judgement_type }, null, 0)}\n\n` +
    `[진단 전 7일 날씨]\n${weather ? weather.text : "자료 없음"}\n\n` +
    `[비슷한 농진청 전문가 상담 사례]\n${caseText || "없음"}\n\n` +
    `첫 번째 사진이 농민 사진이다. 그 뒤 사진은 순서대로 ${refImgs.map((r) => `사례 ${r.n}`).join(", ") || "없음"}의 사진이다.\n` +
    `위 근거로 다시 판정해 JSON 으로만 답하라.`;

  const content: any[] = [{ type: "text", text }, { type: "image_url", image_url: { url: imageUrl } }];
  for (const r of refImgs) content.push({ type: "image_url", image_url: { url: r.url, detail: "low" } });

  const resp = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `${system}\n\n${VERIFY_RULES}` },
      { role: "user", content },
    ],
  });
  const out = JSON.parse(resp.choices[0]?.message?.content || "null");
  if (!out || !Array.isArray(out.possible_causes) || !out.possible_causes.length) return null;
  return {
    result: out,
    evidence: {
      cases: cases.map((c) => ({ id: c.id, crop: c.crop, region: `${c.sido} ${c.sigungu}`.trim(), month: c.month, category: c.category, pest: c.pest })),
      case_images: refImgs.length,
      weather: weather?.text || null,
    },
  };
}
