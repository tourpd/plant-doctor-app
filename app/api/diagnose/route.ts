// app/api/diagnose/route.ts

import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

export async function POST(req: Request) {          // ✅ 반드시 POST
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY missing" },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const file = form.get("image") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No image file uploaded" },
        { status: 400 }
      );
    }

    // File -> Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Vision 요청
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "이 사진의 작물 병해 또는 이상 증상을 분석하고 농민이 바로 조치할 수 있는 구체적인 처방을 한국어로 알려줘"
            },
            {
              type: "input_image",
              image: buffer
            }
          ]
        }
      ]
    });

    const text =
      response.output_text ||
      response.output?.[0]?.content?.[0]?.text ||
      "진단 결과를 생성하지 못했습니다.";

    return NextResponse.json({ result: text });

  } catch (err) {
    console.error("Diagnose error:", err);

    return NextResponse.json(
      { error: "AI 진단 서버 오류 발생" },
      { status: 500 }
    );
  }
}
