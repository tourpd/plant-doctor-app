import { NextResponse } from "next/server";
import OpenAI from "openai";

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

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "사진 속 작물의 병해 증상을 분석하고 조치 방법을 알려주세요." },
            {
              type: "input_image",
              image_base64: base64,
            }
          ]
        }
      ]
    });

    const result =
      response.output_text || JSON.stringify(response.output, null, 2);

    return NextResponse.json({
      success: true,
      result
    });

  } catch (err) {
    console.error("❌ OPENAI ERROR:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
