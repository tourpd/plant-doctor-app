import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json(
        { error: "No image data provided" },
        { status: 400 }
      );
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "이 작물의 상태를 진단하고 병해/영양/생리 문제 여부와 조치 방법을 알려줘."
            },
            {
              type: "input_image",
              image_url: imageBase64,
              detail: "auto"   // ✅ 이 한 줄이 현재 막힌 100% 원인
            }
          ],
        },
      ],
    });

    return NextResponse.json({
      result: response.output_text,
    });

  } catch (err: any) {
    console.error("Diagnose API error", err);
    return NextResponse.json(
      { error: err.message || "Diagnose API failed" },
      { status: 500 }
    );
  }
}
