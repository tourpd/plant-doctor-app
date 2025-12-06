export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "OPENAI_API_KEY not set" },
        { status: 500 }
      );
    }

    const formData = await req.formData();

    const file = formData.get("image") as File | null;
    const crop = (formData.get("crop") as string | null) ?? "";
    const symptom = (formData.get("symptom") as string | null) ?? "";

    if (!file) {
      return NextResponse.json(
        { ok: false, error: "이미지 파일이 없습니다." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Image = buffer.toString("base64");

    const completion = await client.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content:
            "당신은 한국 농민에게 실제 도움이 되는 병해충 처방 카드만 작성합니다. 길고 어려운 설명은 하지 않습니다.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `
아래 형식만 지켜 작성:

📸 작물:
✅ 병해/해충:
⚠ 위험도:

👉 지금 할 일
1.
2.
3.

🧪 약제/방제:
-

📌 주의:
-

작물: ${crop || "미입력"}
증상: ${symptom || "이미지 기반 판단"}
`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_completion_tokens: 700,
      temperature: 0.2,
    });

    const message = completion.choices?.[0]?.message?.content;

    if (!message) {
      return NextResponse.json(
        { ok: false, error: "AI 응답이 비어있습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      result: message,
    });
  } catch (err: any) {
    console.error("DIAGNOSE API ERROR:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "서버 오류" },
      { status: 500 }
    );
  }
}

