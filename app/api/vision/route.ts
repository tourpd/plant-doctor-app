// app/api/vision/route.ts

import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const image = form.get("image") as File | null;
    const crop = (form.get("crop") as string) || "미상";
    const province = (form.get("province") as string) || "";
    const city = (form.get("city") as string) || "";

    if (!image) return json({ ok: false, error: "사진이 없습니다." }, 400);

    // 이미지 base64 변환
    const buffer = Buffer.from(await image.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mime = image.type || "image/jpeg";
    const imageUrl = `data:${mime};base64,${base64}`;

    // ✅ 시스템 프롬프트
    const system = `
당신은 작물 병해충, 생리장해, 영양 문제를 진단하는 식물 병리 전문가이며,
사진으로 진단을 요청한 사람은 농민입니다.

응답은 반드시 아래 JSON 형식으로만 출력하세요.  
다른 설명, 코드 블럭, 여는 말/닫는 말은 포함하지 마세요.

📌 응답 JSON 형식:
{
  "ok": true,
  "crop": "작물 이름",
  "region": "도시 또는 시/군 정보",
  "observations": ["사진에서 보이는 증상 2~4개"],
  "possible_causes": [
    {
      "name": "질병 또는 해충 이름",
      "probability": 70,
      "why": "왜 그렇게 판단했는지 설명"
    },
    {
      "name": "다른 가능성",
      "probability": 30,
      "why": "그럴 가능성도 있는 이유"
    }
  ],
  "final_judgement": "가장 가능성 높은 문제 이름",
  "actions": {
    "doNow": ["지금 해야 할 일 2~3개"],
    "doNot": ["하지 말아야 할 일 1~2개"],
    "mustCheck": ["확인해볼 사항들 (흙 상태, 주변 작물 등)"]
  },
  "disclaimer": "이 결과는 참고용 AI 분석이며, 최종 판단과 책임은 농업인에게 있습니다.",
  "emergency_form_url": "https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform"
}

※ 확률은 반드시 총합 100%로 맞춰서 작성하세요.  
※ 항상 'disclaimer'와 'emergency_form_url' 필드를 포함하세요.
    `.trim();

    // 유저 프롬프트
    const user = `
작물: ${crop}
지역: ${province} ${city}

아래 이미지를 보고 위 JSON 형식에 맞춰 결과를 작성해주세요.  
내용은 반드시 농민이 이해하기 쉬운 쉬운 말로 써 주세요.
    `.trim();

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: user },
            { type: "image_url", image_url: { url: imageUrl } },
          ] as any,
        },
      ],
    });

    const output = response.choices[0]?.message?.content || "{}";
    const data = JSON.parse(output);

    return json(data);
  } catch (e: any) {
    console.error("❌ Vision API 오류:", e);
    return json({ ok: false, error: e?.message || "서버 오류 발생" }, 500);
  }
}