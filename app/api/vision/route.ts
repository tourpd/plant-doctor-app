// app/api/vision/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* =========================
   STEP1 시스템 프롬프트 (강제 질문형)
========================= */
const STEP1_SYSTEM_PROMPT = `
너는 농민을 직접 상대하는 대한민국 농업 병해 진단 AI다.
너의 역할은 "정답을 단정하는 것"이 아니라
"사진을 근거로 대화를 시작하고, 농민의 선택을 받아 진단 정확도를 높이는 것"이다.

[절대 규칙]
- 반드시 JSON만 출력한다.
- JSON 앞뒤에 설명, 인사, 문장, 코드블록, 마크다운을 절대 출력하지 않는다.
- 출력은 반드시 { 로 시작하고 } 로 끝나야 한다.
- 질문은 반드시 2~4개 생성한다.
- 각 질문은 객관식 선택지 3~4개를 포함해야 한다.
- 규칙을 어기면 실패다.

[출력 JSON 형식]
{
  "ok": true,
  "step": "STEP1",
  "crop": {
    "name": string,
    "confidence": number,
    "message": string
  },
  "observations": string[],
  "lead_message": string,
  "questions": [
    {
      "id": string,
      "question": string,
      "choices": string[]
    }
  ]
}
`;

/* =========================
   STEP2 시스템 프롬프트 (최종 판단)
========================= */
const STEP2_SYSTEM_PROMPT = `
너는 농민의 선택을 근거로 최종 판단을 내리는 농업 전문가 AI다.

[규칙]
- 반드시 JSON만 출력한다.
- STEP1에서 추정한 작물은 유지한다.
- 병해/충해 가능성을 확률로 제시한다.
- 즉시 실행 가능한 조치를 제시한다.
- 농약 / 친환경 / 유기농 처방을 모두 제시한다.
- 오진 가능성 안내(disclaimer)를 포함한다.

[출력 JSON 형식]
{
  "ok": true,
  "step": "STEP2",
  "crop": string,
  "result": {
    "summary": string,
    "disease_probabilities": [
      { "name": string, "probability": number }
    ],
    "immediate_actions": string[]
  },
  "products": {
    "chemical": string[],
    "eco": string[],
    "organic": string[]
  },
  "disclaimer": string
}
`;

/* =========================
   🔒 절대 안 깨지는 JSON 파서
========================= */
function safeJsonParse(raw: string) {
  const text = (raw || "").trim();

  // 1️⃣ 완전한 JSON인 경우
  try {
    return JSON.parse(text);
  } catch {}

  // 2️⃣ 앞뒤 잡문 섞인 경우 → JSON 부분만 추출
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    const sliced = text.slice(start, end + 1);
    return JSON.parse(sliced);
  }

  throw new Error("JSON 파싱 실패");
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File | null;
    const answersRaw = formData.get("answers");

    if (!image) {
      return NextResponse.json(
        { ok: false, error: "이미지가 없습니다." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const base64 = buffer.toString("base64");

    /* ======================
       STEP2 여부 판단 (엄격)
    ====================== */
    let answers: { id: string; choice: string }[] = [];

    if (answersRaw) {
      try {
        const parsed = JSON.parse(String(answersRaw));
        if (Array.isArray(parsed)) {
          answers = parsed.filter(
            (a) =>
              a &&
              typeof a === "object" &&
              typeof a.id === "string" &&
              typeof a.choice === "string" &&
              a.choice.trim().length > 0
          );
        }
      } catch {}
    }

    const isStep2 = answers.length > 0;
    const systemPrompt = isStep2
      ? STEP2_SYSTEM_PROMPT
      : STEP1_SYSTEM_PROMPT;

    const userPrompt = isStep2
      ? `
[농민이 선택한 답변]
${answers.map((a, i) => `${i + 1}. ${a.choice}`).join("\n")}

위 선택을 근거로 STEP2 JSON 형식의 최종 판단을 제시하십시오.
`
      : `
이 사진을 보고 반드시 STEP1 JSON 형식으로
질문 2~4개를 포함한 대화를 시작하십시오.
`;

    /* ======================
       모델 호출 (STEP1 실패 시 1회 재시도)
    ====================== */
    async function call(extra?: string) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1",
        temperature: 0.25,
        max_tokens: 1200,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: extra ? `${userPrompt}\n${extra}` : userPrompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64}`,
                },
              },
            ],
          },
        ],
      });

      const raw = completion.choices[0].message.content ?? "";
      console.log("🟡 RAW AI OUTPUT:", raw); // ← 문제 발생 시 여기만 보면 끝

      return safeJsonParse(raw);
    }

    let parsed = await call();

    // STEP1 질문 검증
    if (!isStep2) {
      const qLen = Array.isArray(parsed.questions)
        ? parsed.questions.length
        : 0;

      if (qLen < 2) {
        parsed = await call(
          "questions는 반드시 2~4개여야 하며 JSON만 출력하십시오."
        );
      }

      if (!parsed.questions || parsed.questions.length < 2) {
        return NextResponse.json(
          { ok: false, error: "STEP1 질문 생성 실패" },
          { status: 500 }
        );
      }
    }

    /* ======================
       ✅ 최종 응답 (브랜드 메타 포함)
    ====================== */
    return NextResponse.json({
      ...parsed,
      meta: {
        powered_by: "한국농수산TV",
        service: "포토닥터",
      },
    });
  } catch (e: any) {
    console.error("❌ API ERROR:", e);
    return NextResponse.json(
      {
        ok: false,
        error: "AI 처리 중 오류",
        detail: e?.message ?? String(e),
      },
      { status: 500 }
    );
  }
}