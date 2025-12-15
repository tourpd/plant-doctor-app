// app/api/vision/step2/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* =========================
   STEP2 시스템 프롬프트 (최종)
========================= */
const STEP2_SYSTEM_PROMPT = `
너는 대한민국 현장 농업기술사 수준의 AI다.
사진 + 농민의 선택 답변을 근거로
병해 가능성을 좁히고 실제 농사에 바로 쓰이는 처방을 제시한다.

[절대 규칙]
1. 병명은 단정하지 말고 "가능성"으로만 표현한다.
2. 반드시 작물 이름을 결과에 명시한다.
3. 농약은 반드시 "계열 → 실제 제품명 예시" 순서로 제시한다.
4. 교차살포를 고려해 계열이 겹치지 않게 설명한다.
5. 친환경/유기농 자재는 아래 제품을 반드시 포함하되, 일부만 랜덤으로 섞어 소개한다.
   - 친환경 살충제: 싹쓰리충
   - 유기농 살충제: 싹쓰리충 골드
   - 친환경·유기농 살균제: 멸규니
6. 지금 당장 할 행동을 농민 말투로 명확히 제시한다.
7. 결과 마지막에는 반드시:
   - 농사119 출동 안내
   - 농업기술센터
   - 인근 농약방 (전화번호 포함)
   을 넣는다.
8. 과장 금지, 광고 문구 금지, 현장 중심 설명.

[출력 JSON 형식 — 반드시 이 구조만 출력]
{
  "crop": {
    "name": string
  },
  "summary": string,
  "possible_causes": [
    { "name": string, "confidence": number }
  ],
  "immediate_actions": string[],
  "chemical_prescription": [
    {
      "category": string,
      "reason": string,
      "products": string[]
    }
  ],
  "eco_organic_products": [
    {
      "type": string,
      "name": string,
      "note": string
    }
  ],
  "support": {
    "agri_center": {
      "name": string,
      "phone": string
    },
    "pesticide_store": {
      "name": string,
      "phone": string
    }
  },
  "emergency_guide": string
}
`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { crop, observations, answers } = body;

    if (!crop || !observations || !answers || answers.length === 0) {
      return NextResponse.json(
        { ok: false, error: "STEP2 입력 데이터 부족" },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: STEP2_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `
[작물]
${crop}

[사진에서 관찰된 증상]
${observations.join("\n")}

[농민이 선택한 답변들]
${answers.map((a: any) => `- ${a.choice}`).join("\n")}

위 정보를 종합하여
현장에서 바로 쓸 수 있는 최종 진단과 처방을 만들어라.
          `,
        },
      ],
    });

    const raw = completion.choices[0].message.content || "{}";
    const jsonStart = raw.indexOf("{");
    const parsed = JSON.parse(raw.slice(jsonStart));

    return NextResponse.json({
      ok: true,
      step: "STEP2",
      ...parsed,
    });
  } catch (e: any) {
    console.error("STEP2 ERROR:", e);
    return NextResponse.json(
      {
        ok: false,
        error: "STEP2 추론 실패",
        detail: e.message,
      },
      { status: 500 }
    );
  }
}