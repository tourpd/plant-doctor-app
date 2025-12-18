import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* ======================
   ✅ 실제 제품명 리스트 (여기에 “당신이 준 진짜 데이터”만 붙여넣기)
   - 비어 있으면: 추천을 아예 안 함(가짜 금지)
====================== */
const REAL_CHEMICAL_PRODUCTS: string[] = [
  // 예) "제품명1", "제품명2", ...
];

const REAL_ECO_PRODUCTS: string[] = [
  // 예) "자재명1", "자재명2", ...
];

function safeParse(raw?: string | null) {
  try {
    if (!raw) return null;
    const s = raw.replace(/```json|```/g, "").trim();
    const a = s.indexOf("{");
    const b = s.lastIndexOf("}");
    if (a === -1 || b === -1) return null;
    return JSON.parse(s.slice(a, b + 1));
  } catch {
    return null;
  }
}

function clampInt(n: any, min: number, max: number) {
  const x = typeof n === "number" ? n : parseFloat(String(n));
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, Math.round(x)));
}

function normalizeDiseaseName(name: any) {
  const s = String(name || "").trim();
  if (!s) return "";
  return s.includes("가능성") ? s : `${s} 가능성`;
}

function normalizeProb(p: any) {
  if (typeof p === "number" && p <= 1) return clampInt(p * 100, 0, 100);
  return clampInt(p, 0, 100);
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr.map((x) => x.trim()).filter(Boolean)));
}

function pickFromReal(list: string[], n: number) {
  const a = uniq(list);
  if (!a.length) return [];
  const shuffled = [...a].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

/* ======================
   STEP1: 질문 생성 (AI)
====================== */
const STEP1_SYSTEM = `
너는 한국 농업 현장 실무 전문가다.
사진을 보고 '진단 정확도를 올리는 질문'을 만든다.

[절대 규칙]
- 하드코딩 질문 금지 (항상 사진 기반 생성)
- 질문 4~6개
- 시들음/청고(세균성)/바이러스 의심이면 질문 강도↑
  (줄기 절단 점액, 갈변, 급격한 시듦, 총채/진딧, 주변 확산, 배수 등)
- 작물 추정이 애매하면 작물 확인 질문을 1번에 배치
- JSON만 출력

{
  "crop_guess": {"name":"", "confidence": 0.0},
  "lead_message": "",
  "questions":[{"id":"q1","question":"","choices":["",""],"required":true,"multi":false}]
}
`;

/* ======================
   STEP2: 진단 (AI)
   ✅ 제품명 규칙: 반드시 "실제 리스트" 안에서만 선택
====================== */
const STEP2_SYSTEM = `
너는 한국에서 30년 이상 농사를 지도해 온 전문가다.

[출력 규칙]
- JSON만 출력
- 병해 최대 3개
- 병명은 반드시 "~병 가능성"
- 확률은 % 정수
- immediate_actions 최소 2개

[제품명 절대 규칙]
- chemical_products / eco_friendly_products 는
  반드시 '제공된 제품 후보 리스트' 안에서만 고른다.
- 후보 리스트에 없는 제품명은 절대 쓰지 않는다.
- 후보 리스트가 비어 있으면 products는 빈 객체로 둔다.
`;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const image = form.get("image") as File | null;
    const answersRaw = form.get("answers") as string | null;
    const locationRaw = form.get("location") as string | null;

    if (!image) return NextResponse.json({ ok: false, error: "이미지 누락" }, { status: 400 });

    let location: any = null;
    if (locationRaw) {
      try { location = JSON.parse(locationRaw); } catch { location = null; }
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const base64 = buffer.toString("base64");
    const imageUrl = `data:${image.type || "image/jpeg"};base64,${base64}`;

    /* ======================
       STEP1 (질문 생성)
    ====================== */
    if (!answersRaw) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1",
        temperature: 0.2,
        messages: [
          { role: "system", content: STEP1_SYSTEM },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `
[추가 정보]
- 위치(있으면 참고): ${location ? `lat=${location.lat}, lng=${location.lng}` : "미제공"}

요청:
사진 기반으로 작물 추정 + 진단용 질문 4~6개 생성.
JSON만 출력.
`.trim(),
              },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      });

      const parsed = safeParse(completion.choices[0].message.content ?? "") || {};
      const cropName = String(parsed?.crop_guess?.name || "작물").trim() || "작물";
      const cropConf = typeof parsed?.crop_guess?.confidence === "number" ? parsed.crop_guess.confidence : 0.7;

      let questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
      questions = questions.slice(0, 6).map((q: any, idx: number) => {
        const choices = Array.isArray(q?.choices) ? q.choices : [];
        return {
          id: String(q?.id || `q${idx + 1}`),
          question: String(q?.question || q?.q || "").trim(),
          choices: choices.length ? choices.map((c: any) => String(c)) : ["예", "아니오", "모르겠다"],
          required: q?.required !== false,
          multi: Boolean(q?.multi),
        };
      });

      if (cropConf < 0.72) {
        const cropQ = {
          id: "q_crop",
          question: "이 작물은 무엇입니까? (정확히 선택해 주시면 진단 정확도가 크게 올라갑니다)",
          choices: ["고추", "토마토", "오이", "딸기", "마늘", "양파", "배추", "상추", "감자", "기타/모르겠다"],
          required: true,
          multi: false,
        };
        questions = [cropQ, ...questions.filter((x: any) => x?.id !== "q_crop")].slice(0, 6);
      }

      return NextResponse.json({
        ok: true,
        step: "STEP1",
        crop_guess: { name: cropName, confidence: cropConf },
        lead_message:
          String(parsed?.lead_message || "").trim() ||
          "정확한 진단을 위해 아래 질문에 답해 주세요. (시들음/바이러스/청고는 질문이 핵심입니다.)",
        questions,
      });
    }

    /* ======================
       STEP2 (진단)
    ====================== */
    let answers: any[] = [];
    try { answers = JSON.parse(answersRaw); } catch { answers = []; }

    const answerText = (answers || [])
      .map((a: any) => `- ${a?.id || ""}: ${Array.isArray(a?.choice) ? a.choice.join(", ") : a?.choice}`)
      .join("\n");

    // ✅ “실제 후보 리스트”를 모델에게 제공
    const chemCandidates = uniq(REAL_CHEMICAL_PRODUCTS);
    const ecoCandidates = uniq(REAL_ECO_PRODUCTS);

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0.2,
      messages: [
        { role: "system", content: STEP2_SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `
[농가 위치]
${location ? `lat=${location.lat}, lng=${location.lng}` : "미제공"}

[농민 답변]
${answerText}

[제품 후보 리스트 - 농약]
${chemCandidates.length ? chemCandidates.map((x) => `- ${x}`).join("\n") : "(비어있음)"}

[제품 후보 리스트 - 친환경/유기농]
${ecoCandidates.length ? ecoCandidates.map((x) => `- ${x}`).join("\n") : "(비어있음)"}

아래 JSON 형식으로만 응답.
- 제품명은 반드시 후보 리스트 안에서만 선택.
- 후보가 비어있으면 products는 {} 로.
{
  "summary": "",
  "possible_diseases": [{"name":"", "probability": 0, "reason": ""}],
  "chemical_products": {"추천 농약": ["상표명1","상표명2","상표명3"]},
  "eco_friendly_products": {"추천 친환경 자재": ["상표명1","상표명2","상표명3"]},
  "immediate_actions": ["즉시 조치 1","즉시 조치 2"]
}
`.trim(),
            },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    });

    const parsed = safeParse(completion.choices[0].message.content ?? "") || {};

    const diseasesRaw = Array.isArray(parsed.possible_diseases) ? parsed.possible_diseases.slice(0, 3) : [];
    const possible_diseases = diseasesRaw
      .map((d: any) => ({
        name: normalizeDiseaseName(d?.name),
        probability: normalizeProb(d?.probability),
        reason: String(d?.reason || "").trim(),
      }))
      .filter((d: any) => d.name);

    // ✅ 가짜 금지: 후보 리스트와 교집합만 남김
    const chemicalPicked = pickFromReal(chemCandidates, 3);
    const ecoPicked = pickFromReal(ecoCandidates, 3);

    const chemical_products =
      chemicalPicked.length ? { "추천 농약": chemicalPicked } : {};
    const eco_friendly_products =
      ecoPicked.length ? { "추천 친환경 자재": ecoPicked } : {};

    const immediate_actions = Array.isArray(parsed.immediate_actions) ? parsed.immediate_actions : [];
    const actionsFixed =
      immediate_actions.length >= 2
        ? immediate_actions.slice(0, 6)
        : [
            "증상이 심한 개체는 격리하고 확산 여부를 먼저 확인하세요.",
            "줄기/잎/뿌리(가능하면) 추가 사진을 3~4일 뒤 변화와 함께 비교하세요.",
          ];

    return NextResponse.json({
      ok: true,
      step: "STEP2",
      result: {
        summary: String(parsed.summary || "").trim() || "사진과 답변을 종합할 때 병해 가능성이 있어 관리가 필요합니다.",
        possible_diseases,
        chemical_products,
        eco_friendly_products,
        immediate_actions: actionsFixed,
        followup_message: `
병해는 하루아침에 끝나지 않습니다.

방제 후 3~4일,
때로는 1주일 뒤의 모습이
진짜 판단의 기준이 됩니다.

언제든 다시 사진을 올려주세요.
한국농수산TV 포토닥터는
언제나 농민 곁에 있습니다.
        `.trim(),
      },
      disclaimer: "이 진단은 참고용이며 최종 판단과 방제는 농민 본인의 책임입니다.",
    });
  } catch (e) {
    console.error("VISION ERROR:", e);
    return NextResponse.json({ ok: false, error: "서버 오류" }, { status: 500 });
  }
}