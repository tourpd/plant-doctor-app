// app/api/vision/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { safeJson } from "@/lib/safeJson";
import { buildPestNextSteps } from "./utils/buildPestNextSteps";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* ======================
   고정 멘트 (절대 삭제/변경 금지)
====================== */
const FIXED_FOLLOWUP_MESSAGE = `
병해는 하루아침에 끝나지 않습니다.

방제 후 3~4일,
때로는 1주일 뒤의 모습이
진짜 판단의 기준이 됩니다.

언제든 다시 사진을 올려주세요.
한국농수산TV 포토닥터는
언제나 농민 곁에 있습니다.
`.trim();

/* ======================
   유틸
====================== */
async function toBase64DataUrl(file: File) {
  const ab = await file.arrayBuffer();
  const buffer = Buffer.from(ab);
  const base64 = buffer.toString("base64");
  return `data:${file.type || "image/jpeg"};base64,${base64}`;
}

type HistoryItem =
  | { role: "doctor"; text: string }
  | { role: "farmer"; qid: string; answer: string | string[] };

function historyToText(history: HistoryItem[]) {
  return (history || [])
    .map((h) => {
      if (h.role === "doctor") return `의사: ${h.text}`;
      const a = Array.isArray(h.answer) ? h.answer.join(", ") : h.answer;
      return `농민(답변) [${h.qid}]: ${a}`;
    })
    .join("\n");
}

/* ======================
   시스템 / 스키마
   ✅ phase: QUESTION | FINAL (NEED_PHOTO 금지)
====================== */
const CORE_SYSTEM = `
너는 한국 농업 현장에서 농민을 직접 상대해 온 '명의'다.
하지만 너는 '대화형 진단'을 한다.

[절대 금지]
- 농약/약제/제품명/처방/살포량/혼용 등 언급
- 병명 단정(확진처럼 말하지 말 것)
- 공포 조장 / 과잉 확신

[반드시]
- 사진에서 보이는 것을 먼저 “관찰 묘사”로 말한다.
- 질문은 한 번에 1개만 낸다.
- 최종도 “가능성(Top3)+왜+지금 피해야 할 행동+즉시 확인 포인트+119 조건”만.

[중요]
- phase는 QUESTION 또는 FINAL만 허용한다.
- NEED_PHOTO는 절대 사용하지 않는다.

[출력은 반드시 JSON 오브젝트 1개]
`.trim();

const OUTPUT_SCHEMA = `
[OUTPUT RULES]
- 응답은 반드시 JSON 오브젝트 1개만 출력한다.
- 마크다운/설명문/코드블록 금지
- 모든 key는 snake_case
- phase: QUESTION | FINAL 만 허용 (NEED_PHOTO 금지)
- 누락 값은 null
- JSON 외 텍스트 출력 금지

[JSON SHAPE]
{
  "phase": "QUESTION" | "FINAL",
  "primary_category": "PEST" | "DISEASE" | "ENVIRONMENT" | null,

  "crop_guess": { "name": string, "confidence": number } | null,
  "observations": string[] | null,
  "doctor_note": string | null,

  "question": { "id": string, "text": string, "choices": string[] } | null,
  "progress": { "asked": number, "target": number } | null,

  "possible_causes": { "name": string, "probability": number, "why": string }[] | null,
  "must_check": string[] | null,
  "do_not": string[] | null,
  "next_steps": string[] | null,
  "need_119_if": string[] | null,
  "followup_message": string | null
}
`.trim();

/* ======================
   ✅ 해충 강제 탐지 (방패)
====================== */
const PEST_KEYWORDS = ["해충", "벌레", "진딧물", "총채", "응애", "가루이", "나방", "유충"];

function detectPest(parsed: any) {
  const obsText = Array.isArray(parsed?.observations) ? parsed.observations.join(" ") : "";
  const doctorText = typeof parsed?.doctor_note === "string" ? parsed.doctor_note : "";
  const cat = String(parsed?.primary_category || "").toUpperCase();
  const byCategory = cat === "PEST";
  const byText =
    PEST_KEYWORDS.some((k) => obsText.includes(k)) ||
    PEST_KEYWORDS.some((k) => doctorText.includes(k));
  return byCategory || byText;
}

/* ======================
   🔧 확률 정규화: 0~1 → 0~100
====================== */
function normalizePercent(n: any): number | null {
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  const v = n <= 1 ? n * 100 : n;
  const r = Math.round(v);
  return Math.max(0, Math.min(100, r));
}

/* ======================
   서버 로직
====================== */
export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const action = String(form.get("action") || "start");

    const image = form.get("image") as File | null;
    const images = (form.getAll("images") as File[]) || [];
    const allImages: File[] = [];
    if (image) allImages.push(image);
    for (const f of images) if (f) allImages.push(f);

    if (allImages.length === 0) {
      return NextResponse.json({ ok: false, error: "사진이 없습니다." }, { status: 400 });
    }

    const crop = String(form.get("crop") || "").trim();
    const region = String(form.get("region") || "").trim();

    // history
    let history: HistoryItem[] = [];
    const historyRaw = form.get("history") as string | null;
    if (historyRaw) {
      try {
        history = JSON.parse(historyRaw);
      } catch {
        history = [];
      }
    }

    // answer turn
    const qid = String(form.get("qid") || "").trim();
    const answerRaw = form.get("answer") as string | null;
    if (action === "answer" && qid && answerRaw) {
      let parsedAns: any = answerRaw;
      try {
        parsedAns = JSON.parse(answerRaw);
      } catch {
        parsedAns = answerRaw;
      }
      history = [...history, { role: "farmer", qid, answer: parsedAns }];
    }

    let location: any = null;
    const locationRaw = form.get("location") as string | null;
    if (locationRaw) {
      try {
        location = JSON.parse(locationRaw);
      } catch {
        location = null;
      }
    }

    // ✅ 모델에는 첫 1장만 넣는다 (추가사진 강제 흐름 없음)
    const firstImageUrl = await toBase64DataUrl(allImages[0]);
    const hx = historyToText(history);

    const userPrompt = `
[컨텍스트]
- 작물(농민 입력): ${crop || "미입력(추정 필요)"}
- 지역(농민 입력): ${region || "미입력(추정/질문 필요)"}
- 위치좌표(있으면 참고): ${location ? `lat=${location.lat}, lng=${location.lng}` : "미제공"}
- action: ${action}
- 대화 기록:
${hx || "(아직 없음)"}

[지시]
1) 사진 관찰 묘사(3~8줄) → doctor_note(2~5문장)
2) 질문은 딱 1개(choices 4~10개)
3) 해충이 명확하면: phase=FINAL로 바로 정리
4) phase는 QUESTION 또는 FINAL만. NEED_PHOTO는 절대 금지.
`.trim();

    console.log("[VISION] action =", action);
    console.log("[VISION] images count =", allImages.length);

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0.25,
      messages: [
        { role: "system", content: CORE_SYSTEM + "\n\n" + OUTPUT_SCHEMA },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: firstImageUrl } },
          ],
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "";
    const parsed = safeJson(raw) as any;

    // 파싱 실패 보호
    if (!parsed || !parsed.phase) {
      return NextResponse.json({
        ok: true,
        phase: "QUESTION",
        primary_category: null,
        crop_guess: { name: crop || "작물(추정 필요)", confidence: 50 },
        observations: ["사진을 받았습니다. 다만 정보가 더 필요합니다."],
        doctor_note: "사진만으로 단정하면 오판 위험이 있어요. 핵심부터 하나만 확인하겠습니다.",
        question: {
          id: "q_crop",
          text: "작물 이름을 정확히 선택해 주세요.",
          choices: ["고추", "오이", "딸기", "마늘", "양파", "배추/무", "토마토", "과수", "기타/모르겠습니다"],
        },
        progress: { asked: 1, target: 6 },
      });
    }

    // ✅ 혹시 모델이 NEED_PHOTO를 뱉어도 차단
    if (parsed.phase === "NEED_PHOTO") {
      parsed.phase = "QUESTION";
      parsed.question = parsed.question ?? {
        id: "q_env",
        text: "재배 환경은 어디에 더 가깝나요?",
        choices: ["하우스", "노지", "모르겠습니다", "기타(직접 입력)"],
      };
    }

    // ✅ 확률 전부 0~100으로 정규화 (UI는 그냥 %로 표기)
    if (Array.isArray(parsed.possible_causes)) {
      parsed.possible_causes = parsed.possible_causes.map((c: any) => ({
        ...c,
        probability: normalizePercent(c?.probability),
      }));
    }
    if (parsed.crop_guess && typeof parsed.crop_guess.confidence === "number") {
      parsed.crop_guess.confidence = normalizePercent(parsed.crop_guess.confidence);
    }

    // ✅ 해충 강제 감지: FINAL로 승격 + 자재 포함
    const pestDetected = detectPest(parsed);
    if (pestDetected && parsed.primary_category !== "DISEASE") {
      const next_steps = buildPestNextSteps({
        primaryName: parsed.primary_name,
        confidence: parsed.confidence,
        isGreenhouse: parsed.environment === "GREENHOUSE",
      });

      return NextResponse.json({
        ok: true,
        phase: "FINAL",
        primary_category: "PEST",
        primary_name: parsed.primary_name ?? null,
        confidence: normalizePercent(parsed.confidence),

        crop_guess: parsed.crop_guess ?? { name: crop || "작물", confidence: 60 },
        observations: parsed.observations || [],
        possible_causes: parsed.possible_causes || [],

        must_check: [
          "해충이 언제부터 보이기 시작했는지",
          "전체 포장인지 일부 개체인지",
          "하우스 재배인지 노지 재배인지",
          "최근 2~3일 사이 개체 수가 늘었는지",
        ],
        do_not: ["원인을 확정하지 않은 상태에서 반복 조치를 연속으로 하지 마세요."],
        next_steps: next_steps,

        organic_products: {
          category: "PEST",
          items: [
            { name: "싹쓰리충", material_type: "친환경자재", use_case: "초기 또는 일반 밀도의 해충 관리" },
            { name: "싹쓰리충 골드", material_type: "유기농자재", use_case: "해충 밀도가 높거나 빠른 확산이 보일 때" },
          ],
          note: "1회 시험 살포 후 2~3일간 해충 밀도 변화를 확인하세요.",
        },

        need_119_if: ["하루 이틀 사이 급격히 확산", "어린 묘/생육점까지 피해", "하우스 전체로 번짐"],
        followup_message: "해충은 초기에 눌러야 피해가 커지지 않습니다.\n2~3일 뒤 변화를 꼭 다시 확인해 주세요.",
      });
    }

    // FINAL이면 고정 멘트 보정 (병/환경 쪽)
    if (parsed.phase === "FINAL") {
      parsed.followup_message = FIXED_FOLLOWUP_MESSAGE;
    }

    return NextResponse.json({ ok: true, ...parsed });
  } catch (err) {
    console.error("[VISION API ERROR]", err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}