import { NextResponse } from "next/server";
import OpenAI from "openai";

// ==============================
// SYSTEM PROMPTS (기준점)
// ==============================
import { SYSTEM_PROMPT_VFINAL } from "../../prompts/system_prompt_vfinal";
import { GUARD_PROMPT_DIAGNOSIS } from "../../prompts/guard_prompt_diagnosis";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const image = form.get("image") as File | null;
    const cropName = (form.get("cropName") as string | null)?.trim();

    if (!image || !cropName) {
      return NextResponse.json(
        { ok: false, error: "이미지와 작물명이 필요합니다." },
        { status: 400 }
      );
    }

    /* =========================
       1️⃣ 이미지 → base64
    ========================= */
    const buffer = Buffer.from(await image.arrayBuffer());
    const base64 = buffer.toString("base64");
    const imageUrl = `data:image/jpeg;base64,${base64}`;

    /* =========================
       2️⃣ SYSTEM PROMPT
       👉 AI는 관찰만, 판단 금지
    ========================= */
    const SYSTEM_PROMPT = `
${SYSTEM_PROMPT_VFINAL}

${GUARD_PROMPT_DIAGNOSIS}

[중요 원칙]
- 사진만으로 확정 불가한 병(청고병, 더뎅이병, 세균성·바이러스병)은
  절대 확정 진단하지 말고 "추가 확인 필요"로 처리하라.
- 농약, 약제, 방제, 치료, 처방을 절대 언급하지 마라.
- 역할은 '관찰 설명'에만 한정된다.
`;

    /* =========================
       3️⃣ USER PROMPT (최종본)
       👉 농민 말투 · 짧게 · 질문으로 끝
    ========================= */
    const USER_PROMPT = `
작물명: ${cropName}

이 사진 1장을 보고
농부에게 말해주듯이
눈에 보이는 상태만 짧게 설명하라.

반드시 지켜라:
- 병명, 병 이름은 절대 말하지 말 것
- 추측, 단정, 판단 금지
- 농약, 약제, 방제, 치료 언급 금지
- “~처럼 보입니다 / ~로 보일 수 있습니다” 표현만 사용

형식:
- 3~4문장 이내
- 현장에서 바로 이해할 농부 말투
- 마지막 문장은 반드시 질문 1개로 끝낼 것
`;

    /* =========================
       4️⃣ OpenAI 호출
    ========================= */
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 800,
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

    /* =========================
       5️⃣ 기준점 반환
       👉 항상 동작
    ========================= */
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