// app/api/analyze/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

// SYSTEM PROMPTS
import { SYSTEM_PROMPT_VFINAL } from "../../prompts/system_prompt_vfinal";
import { GUARD_PROMPT_DIAGNOSIS } from "../../prompts/guard_prompt_diagnosis";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const image = form.get("image") as File;
    const cropName = (form.get("cropName") as string)?.trim();

    if (!image || !cropName) {
      return NextResponse.json(
        { ok: false, error: "이미지와 작물명이 필요합니다." },
        { status: 400 }
      );
    }

    // 이미지 → base64
    const buffer = Buffer.from(await image.arrayBuffer());
    const base64 = buffer.toString("base64");
    const imageUrl = `data:image/jpeg;base64,${base64}`;

    const SYSTEM_PROMPT = `
${SYSTEM_PROMPT_VFINAL}

${GUARD_PROMPT_DIAGNOSIS}

[중요 원칙]
- 사진만으로 확정 불가한 병(청고병, 더뎅이병, 세균성·바이러스병)은
  확정 진단하지 말고 반드시 "추가 확인 필요"로 처리하라.
- 농약 사용을 전제로 단정 짓지 마라.
`;

    const USER_PROMPT = `
작물명: ${cropName}

이 사진 1장을 기준으로
눈으로 관찰 가능한 증상만 설명하라.

반드시 지켜라:
- 병명을 단정하지 말 것
- "의심 가능" 수준까지만 언급
- 추가로 확인해야 할 사항을 질문 형태로 제시할 것
- 농약 추천은 하지 말 것
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 900,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: USER_PROMPT },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    });

    const rawResult = response.choices[0]?.message?.content;

    if (!rawResult) {
      return NextResponse.json(
        { ok: false, error: "AI 결과 생성 실패" },
        { status: 500 }
      );
    }

    // ✅ 엔진 처리 없음 (기준점 확보)
    return NextResponse.json({
      ok: true,
      result: rawResult,
    });
  } catch (err) {
    console.error("AI 분석 오류:", err);
    return NextResponse.json(
      { ok: false, error: "AI 분석 중 오류 발생" },
      { status: 500 }
    );
  }
}