import { NextResponse } from "next/server";
import OpenAI from "openai";

/**
 * 🔍 Diagnostic
 * 운영 서버에서 실제로 OPENAI_API_KEY 가 읽히는지 확인용 로그
 */
console.log(
  "✅ OPENAI_API_KEY LENGTH:",
  process.env.OPENAI_API_KEY
    ? process.env.OPENAI_API_KEY.length
    : "❌ UNDEFINED"
);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json({ error: "이미지가 없습니다." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const result = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "당신은 농작물 병해 진단 전문가입니다."
        },
        {
          role: "user",
          content: [
            { type: "text", text: "이 농작물 사진의 병해 증상을 분석하고 조치방법을 알려주세요." },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64}` }
            }
          ]
        }
      ]
    });

    return NextResponse.json({
      success: true,
      result: result.choices[0].message.content,
    });

  } catch (err) {
    console.error("❌ DIAGNOSE ERROR:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
